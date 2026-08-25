import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
});

import { PostgrestClient } from "@supabase/postgrest-js";
import { TelegramClient } from "telegram";
import { NewMessage } from "telegram/events";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { savePresenceEntry, appendStatusLog } from "../lib/presence-store";
import { resolveCustomer, Customer } from "./customer-matcher";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = getRequiredEnv("TELEGRAM_API_HASH");
const session = getRequiredEnv("TELEGRAM_SESSION");

// Can be a dedicated group or fallback to TELEGRAM_CHAT_ID
const STATUS_CHAT_ID = process.env.TELEGRAM_STATUS_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "-627642374";
const telegramChatId = Number(STATUS_CHAT_ID);

const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabase = new PostgrestClient(`${supabaseUrl}/rest/v1`, {
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  },
});

const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
  connectionRetries: 5,
});

type ParsedStatusMessage = {
  customerUsername: string;
  status: "ONLINE" | "OFFLINE";
  eventTime: string;
  rawText: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

if (!Number.isInteger(apiId) || apiId <= 0) {
  throw new Error("Missing or invalid TELEGRAM_API_ID in .env.local");
}

async function main() {
  console.log("Connecting to Telegram Status Listener...");
  await client.connect();

  console.log("=================================");
  console.log("⚡ Real-Time Customer Status Listener Started");
  console.log("Watching Status Group:", STATUS_CHAT_ID);
  console.log("Supabase Presence Ingestion: ENABLED");
  console.log("Startup Recovery: scanning recent 200 messages");
  console.log("=================================");

  await recoverRecentStatusMessages();

  client.addEventHandler(async (event) => {
    await processTelegramStatusMessage(event.message);
  }, new NewMessage({}));

  console.log("Listening for real-time customer ONLINE/OFFLINE alerts...");
  await new Promise(() => {});
}

async function recoverRecentStatusMessages() {
  console.log("Scanning recent status messages for initial customer presence...");

  try {
    const messages = await client.getMessages(STATUS_CHAT_ID, {
      limit: 200,
    });
    messages.reverse();

    console.log(`Retrieved ${messages.length} recent messages from status chat.`);

    let updatedCount = 0;
    for (const msg of messages) {
      const result = await processTelegramStatusMessage(msg);
      if (result === "saved") updatedCount++;
    }

    console.log(`Initial status sync complete. ${updatedCount} customer status records updated.`);
  } catch (error) {
    console.error("Status message recovery failed:", error);
  }
}

async function processTelegramStatusMessage(
  message: Pick<Api.Message, "id" | "message"> & { chatId?: unknown }
): Promise<"saved" | "skipped" | "error"> {
  const text = message.message || "";
  if (!text) return "skipped";

  const upper = text.toUpperCase();
  const isOffline = upper.includes("OFFLINE") || upper.includes("DOWN") || upper.includes("DISCONNECTED");
  const isOnline = upper.includes("ONLINE") || upper.includes("RECOVERY") || upper.includes("RESTORED") || upper.includes("CONNECTED") || upper.includes("UP");

  if (!isOffline && !isOnline) {
    return "skipped";
  }

  const parsed = parseStatusMessage(text);
  if (!parsed) {
    return "skipped";
  }

  const telegramMessageId = Number(message.id);
  const customer = await findCustomer(parsed.customerUsername);

  if (!customer) {
    console.log(`[Status Listener] Customer not found for '${parsed.customerUsername}'`);
    return "error";
  }

  const statusEmoji = parsed.status === "ONLINE" ? "🟢" : "🔴";
  console.log(`\n${statusEmoji} CUSTOMER STATUS UPDATE [Msg #${telegramMessageId}]`);
  console.log(`Subscriber: ${customer.name || "Customer"} (${customer.pppoe_username})`);
  console.log(`Status: ${parsed.status} at ${parsed.eventTime}`);

  // 0. Update shared persistent presence file
  savePresenceEntry({
    customer_id: customer.id,
    pppoe_username: customer.pppoe_username,
    is_online: parsed.status === "ONLINE",
    status: parsed.status,
    last_status_change_at: parsed.eventTime,
    telegram_chat_id: telegramChatId,
    telegram_message_id: telegramMessageId,
    updated_at: new Date().toISOString(),
  });

  appendStatusLog({
    id: `status-${telegramMessageId || Date.now()}`,
    customer_id: customer.id,
    customer_name: customer.name || undefined,
    pppoe_username: customer.pppoe_username,
    status: parsed.status,
    event_time: parsed.eventTime,
    telegram_chat_id: telegramChatId,
    telegram_message_id: telegramMessageId,
    created_at: new Date().toISOString(),
  });

  // 1. Try to record in customer_status_logs table
  try {
    await supabase.from("customer_status_logs").insert({
      customer_id: customer.id,
      pppoe_username: customer.pppoe_username,
      status: parsed.status,
      event_time: parsed.eventTime,
      telegram_chat_id: telegramChatId,
      telegram_message_id: telegramMessageId,
    });
  } catch {
    // Ignore if table not yet created
  }

  // 2. Also try to update customers table directly if is_online column exists
  try {
    await supabase
      .from("customers")
      .update({
        is_online: parsed.status === "ONLINE",
        last_status_change_at: parsed.eventTime,
      })
      .eq("id", customer.id);
  } catch {
    // Ignore if column not yet created
  }

  return "saved";
}

function parseStatusMessage(text: string): ParsedStatusMessage | null {
  const customerUsername = getLineValue(text, "Customer");
  if (!customerUsername) return null;

  const upper = text.toUpperCase();
  let status: "ONLINE" | "OFFLINE" = "ONLINE";

  if (upper.includes("OFFLINE") || upper.includes("DISCONNECTED") || upper.includes("🔴")) {
    status = "OFFLINE";
  } else if (upper.includes("ONLINE") || upper.includes("RECOVERY") || upper.includes("RESTORED") || upper.includes("🟢")) {
    status = "ONLINE";
  }

  // Check explicit Status line if present
  const explicitStatus = getLineValue(text, "Status");
  if (explicitStatus) {
    if (explicitStatus.toUpperCase().includes("OFFLINE")) status = "OFFLINE";
    else if (explicitStatus.toUpperCase().includes("ONLINE")) status = "ONLINE";
  }

  // Extract Date & Time
  const dateStr = getLineValue(text, "Date");
  const timeStr = getLineValue(text, "Time");

  let eventTime = new Date().toISOString();
  if (dateStr && timeStr) {
    const kolkataDate = parseDateTimeKolkata(dateStr, timeStr);
    if (kolkataDate) {
      eventTime = kolkataDate.toISOString();
    }
  }

  return {
    customerUsername,
    status,
    eventTime,
    rawText: text,
  };
}

function getLineValue(text: string, label: string): string | null {
  const regex = new RegExp(`(?:^|[\\r\\n])[^\\r\\n:]*?${label}[\\s*~_]*:[\\s*~_]*([^\\r\\n]+)`, "i");
  const match = text.match(regex);
  if (!match) return null;
  return match[1].replace(/^[*\s~`_]+|[*\s~`_]+$/g, "").trim();
}

function parseDateTimeKolkata(dateStr: string, timeStr: string): Date | null {
  const cleanDate = dateStr.trim();
  const cleanTime = timeStr.trim();

  const matchDate = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const matchTime = cleanTime.match(/^(\d{2}):(\d{2}):(\d{2})$/);

  if (!matchDate || !matchTime) return null;

  const [, year, month, day] = matchDate;
  const [, hour, minute, second] = matchTime;

  const d = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function findCustomer(customerUsername: string): Promise<Customer | null> {
  return resolveCustomer(supabase, customerUsername);
}

main().catch((err) => {
  console.error("Status listener fatal error:", err);
});
