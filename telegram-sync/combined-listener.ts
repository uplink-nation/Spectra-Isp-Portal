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

// Groups
const USAGE_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-1003972724689";
const STATUS_CHAT_ID = process.env.TELEGRAM_STATUS_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "-627642374";

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

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

if (!Number.isInteger(apiId) || apiId <= 0) {
  throw new Error("Missing or invalid TELEGRAM_API_ID in .env.local");
}

async function main() {
  console.log("Connecting to Spectra Unified Telegram Monitor...");
  await client.connect();

  console.log("=================================================");
  console.log("⚡ Spectra Unified Telegram NOC & Usage Listener Active");
  console.log("📊 Usage Sessions Chat:", USAGE_CHAT_ID);
  console.log("📶 Customer Online/Offline Status Chat:", STATUS_CHAT_ID);
  console.log("Supabase Telemetry Sync: ENABLED");
  console.log("=================================================");

  // 1. Initial historical recoveries
  await Promise.all([
    recoverRecentUsageMessages(),
    recoverRecentStatusMessages(),
  ]);

  // 2. Realtime event listener
  client.addEventHandler(async (event) => {
    const text = event.message.message || "";
    const upper = text.toUpperCase();

    // Check if usage session message
    if (upper.includes("PPPOE SESSION ENDED")) {
      await processUsageMessage(event.message);
    }

    // Check if presence status message
    if (upper.includes("CUSTOMER OFFLINE") || upper.includes("CUSTOMER ONLINE") || upper.includes("CUSTOMER RECOVERY")) {
      await processStatusMessage(event.message);
    }
  }, new NewMessage({}));

  console.log("\n👂 Actively listening for realtime Usage and Online/Offline events...");
  await new Promise(() => {});
}

// -------------------------------------------------------------
// 1. USAGE SESSIONS PROCESSING
// -------------------------------------------------------------
async function recoverRecentUsageMessages() {
  console.log("Scanning recent usage sessions...");
  try {
    const messages = await client.getMessages(USAGE_CHAT_ID, { limit: 100, reverse: true });
    for (const m of messages) {
      if ((m.message || "").toUpperCase().includes("PPPOE SESSION ENDED")) {
        await processUsageMessage(m);
      }
    }
    console.log("Usage session initial sync completed.");
  } catch (err) {
    console.error("Usage recovery error:", err);
  }
}

async function processUsageMessage(message: Api.Message) {
  const text = message.message || "";
  const telegramMessageId = Number(message.id);
  const parsed = parseUsageMessage(text);
  if (!parsed) return;

  // Duplicate check
  const { data: existing } = await supabase
    .from("usage_sessions")
    .select("id")
    .eq("telegram_message_id", telegramMessageId)
    .maybeSingle();

  if (existing) return;

  const customer = await findCustomer(parsed.customerUsername);
  if (!customer) return;

  const usageRow = {
    customer_id: customer.id,
    pppoe_username: customer.pppoe_username,
    session_started_at: parsed.sessionStartedAt,
    session_ended_at: parsed.sessionEndedAt,
    download_bytes: parsed.downloadBytes,
    upload_bytes: parsed.uploadBytes,
    telegram_chat_id: Number(USAGE_CHAT_ID),
    telegram_message_id: telegramMessageId,
  };

  const { error } = await supabase.from("usage_sessions").insert(usageRow);
  if (!error) {
    console.log(`✅ [Usage Recorded] ${customer.name || customer.pppoe_username}: ${formatBytesHuman(parsed.totalBytes)}`);
  }
}

// -------------------------------------------------------------
// 2. ONLINE / OFFLINE STATUS PROCESSING
// -------------------------------------------------------------
async function recoverRecentStatusMessages() {
  console.log("Scanning recent status events...");
  try {
    const messages = await client.getMessages(STATUS_CHAT_ID, { limit: 100, reverse: true });
    for (const m of messages) {
      const upper = (m.message || "").toUpperCase();
      if (upper.includes("CUSTOMER OFFLINE") || upper.includes("CUSTOMER ONLINE") || upper.includes("CUSTOMER RECOVERY")) {
        await processStatusMessage(m);
      }
    }
    console.log("Status presence initial sync completed.");
  } catch (err) {
    console.error("Status recovery error:", err);
  }
}

async function processStatusMessage(message: Api.Message) {
  const text = message.message || "";
  const telegramMessageId = Number(message.id);
  const parsed = parseStatusMessage(text);
  if (!parsed) return;

  const customer = await findCustomer(parsed.customerUsername);
  if (!customer) return;

  const statusEmoji = parsed.status === "ONLINE" ? "🟢" : "🔴";
  console.log(`${statusEmoji} [Presence Update] ${customer.name || customer.pppoe_username} -> ${parsed.status} (${parsed.eventTime})`);

  // 0. Update shared persistent presence file
  savePresenceEntry({
    customer_id: customer.id,
    pppoe_username: customer.pppoe_username,
    is_online: parsed.status === "ONLINE",
    status: parsed.status,
    last_status_change_at: parsed.eventTime,
    telegram_chat_id: Number(STATUS_CHAT_ID),
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
    telegram_chat_id: Number(STATUS_CHAT_ID),
    telegram_message_id: telegramMessageId,
    created_at: new Date().toISOString(),
  });

  // Insert into customer_status_logs
  try {
    const { error: logErr } = await supabase.from("customer_status_logs").insert({
      customer_id: customer.id,
      pppoe_username: customer.pppoe_username,
      status: parsed.status,
      event_time: parsed.eventTime,
      telegram_chat_id: Number(STATUS_CHAT_ID),
      telegram_message_id: telegramMessageId,
    });
    if (logErr) {
      console.warn("⚠️ [Supabase customer_status_logs Insert Note]:", logErr.message || logErr);
    }
  } catch (e) {
    console.warn("⚠️ [Supabase status log error]:", e);
  }

  // Update customers.is_online
  try {
    const { error: custErr } = await supabase
      .from("customers")
      .update({
        is_online: parsed.status === "ONLINE",
        last_status_change_at: parsed.eventTime,
      })
      .eq("id", customer.id);
    if (custErr) {
      console.warn("⚠️ [Supabase customers.is_online Update Note]:", custErr.message || custErr);
    }
  } catch (e) {
    console.warn("⚠️ [Supabase customers update error]:", e);
  }
}

// -------------------------------------------------------------
// PARSER HELPERS
// -------------------------------------------------------------
function parseUsageMessage(text: string) {
  const customerUsername = getLineValue(text, "Customer");
  const sessionDurationText = getLineValue(text, "Session");
  const download = parseDataAmount(getLineValue(text, "Download"));
  const upload = parseDataAmount(getLineValue(text, "Upload"));
  const total = parseDataAmount(getLineValue(text, "Total"));
  const endedText = getLineValue(text, "Ended");

  if (!customerUsername || !sessionDurationText || download === null || upload === null || total === null || !endedText) {
    return null;
  }

  const sessionDurationMs = parseSessionDuration(sessionDurationText);
  const sessionEndedDate = parseKolkataTimestamp(endedText);

  if (sessionDurationMs === null || !sessionEndedDate) return null;

  const sessionStartedDate = new Date(sessionEndedDate.getTime() - sessionDurationMs);

  return {
    customerUsername,
    sessionDurationText,
    sessionDurationMs,
    downloadBytes: download,
    uploadBytes: upload,
    totalBytes: total,
    sessionEndedAt: sessionEndedDate.toISOString(),
    sessionStartedAt: sessionStartedDate.toISOString(),
  };
}

function parseStatusMessage(text: string) {
  const customerUsername = getLineValue(text, "Customer");
  if (!customerUsername) return null;

  const upper = text.toUpperCase();
  let status: "ONLINE" | "OFFLINE" = "ONLINE";

  if (upper.includes("OFFLINE") || upper.includes("DISCONNECTED") || upper.includes("🔴")) {
    status = "OFFLINE";
  } else if (upper.includes("ONLINE") || upper.includes("RECOVERY") || upper.includes("RESTORED") || upper.includes("🟢")) {
    status = "ONLINE";
  }

  const dateStr = getLineValue(text, "Date");
  const timeStr = getLineValue(text, "Time");

  let eventTime = new Date().toISOString();
  if (dateStr && timeStr) {
    const kolkataDate = parseDateTimeKolkata(dateStr, timeStr);
    if (kolkataDate) eventTime = kolkataDate.toISOString();
  }

  return {
    customerUsername,
    status,
    eventTime,
  };
}

function getLineValue(text: string, label: string): string | null {
  const regex = new RegExp(`(?:^|[\\r\\n])[^\\r\\n:]*?${label}[\\s*~_]*:[\\s*~_]*([^\\r\\n]+)`, "i");
  const match = text.match(regex);
  if (!match) return null;
  return match[1].replace(/^[*\s~`_]+|[*\s~`_]+$/g, "").trim();
}

function parseSessionDuration(value: string): number | null {
  const clean = value.trim();
  const complexMatch = clean.match(/^(?:(\d+)w)?(?:(\d+)d)?(?:(\d+):([0-5]?\d):([0-5]?\d))$/i);
  if (complexMatch) {
    const weeks = Number(complexMatch[1] || 0);
    const days = Number(complexMatch[2] || 0);
    const hours = Number(complexMatch[3] || 0);
    const minutes = Number(complexMatch[4] || 0);
    const seconds = Number(complexMatch[5] || 0);
    return (((weeks * 7 + days) * 24 + hours) * 3600 + minutes * 60 + seconds) * 1000;
  }

  const standardMatch = clean.match(/^(\d+):([0-5]?\d):([0-5]?\d)$/);
  if (standardMatch) {
    const hours = Number(standardMatch[1]);
    const minutes = Number(standardMatch[2]);
    const seconds = Number(standardMatch[3]);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  return null;
}

function parseDataAmount(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^([\d.]+)\s*(GB|MB|KB|B)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = match[2].toUpperCase();
  if (unit === "GB") return Math.round(amount * 1024 * 1024 * 1024);
  if (unit === "MB") return Math.round(amount * 1024 * 1024);
  if (unit === "KB") return Math.round(amount * 1024);
  return Math.round(amount);
}

function parseKolkataTimestamp(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTimeKolkata(dateStr: string, timeStr: string): Date | null {
  const matchDate = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const matchTime = timeStr.trim().match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!matchDate || !matchTime) return null;

  const [, year, month, day] = matchDate;
  const [, hour, minute, second] = matchTime;
  const d = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function findCustomer(customerUsername: string): Promise<Customer | null> {
  return resolveCustomer(supabase, customerUsername);
}

function formatBytesHuman(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

main().catch(console.error);
