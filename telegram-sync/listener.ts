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
import { resolveCustomer, Customer } from "./customer-matcher";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = getRequiredEnv("TELEGRAM_API_HASH");
const session = getRequiredEnv("TELEGRAM_SESSION");

const WATCHED_CHAT_ID = getRequiredEnv("TELEGRAM_CHAT_ID");
const telegramChatId = Number(WATCHED_CHAT_ID);

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

type TelegramUsageMessage = Pick<Api.Message, "id" | "message"> & {
  chatId?: unknown;
};

type ParsedUsageMessage = {
  customerUsername: string;
  sessionDurationText: string;
  sessionDurationMs: number;
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
  sessionEndedAt: string;
  sessionStartedAt: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name} in .env.local`);
  }

  return value;
}

if (!Number.isInteger(apiId) || apiId <= 0) {
  throw new Error("Missing or invalid TELEGRAM_API_ID in .env.local");
}

if (!Number.isFinite(telegramChatId)) {
  throw new Error("Missing or invalid TELEGRAM_CHAT_ID in .env.local");
}

async function main() {
  console.log("Connecting to Telegram...");

  await client.connect();

  console.log("=================================");
  console.log("Telegram listener started");
  console.log("Watching group:", WATCHED_CHAT_ID);
  console.log("Supabase ingestion: enabled");
  console.log("Startup recovery: scanning recent 500 messages");
  console.log("=================================");

  await recoverRecentMessages();

  client.addEventHandler(async (event) => {
    await safelyProcessTelegramMessage(event.message);
  }, new NewMessage({}));

  console.log("Listening for real-time Telegram PPPoE session events...");

  await new Promise(() => {});
}

async function recoverRecentMessages() {
  console.log("Recovering recent Telegram messages...");

  try {
    const messages = await client.getMessages(WATCHED_CHAT_ID, {
      limit: 500,
      reverse: true,
    });

    console.log(`Retrieved ${messages.length} messages from Telegram group.`);

    let importedCount = 0;
    let skippedCount = 0;

    for (const message of messages) {
      const result = await safelyProcessTelegramMessage(message);
      if (result === "imported") importedCount++;
      else if (result === "skipped") skippedCount++;
    }

    console.log(`Recovery complete: ${importedCount} sessions imported, ${skippedCount} already synced or non-usage.`);
  } catch (error) {
    console.error("Historical message recovery failed:", error);
  }
}

async function safelyProcessTelegramMessage(
  message: TelegramUsageMessage
): Promise<"imported" | "skipped" | "error"> {
  try {
    return await processTelegramMessage(message);
  } catch (error) {
    console.error("Telegram message processing error:", error);
    return "error";
  }
}

async function processTelegramMessage(
  message: TelegramUsageMessage
): Promise<"imported" | "skipped" | "error"> {
  const messageChatId = getMessageChatId(message);

  if (messageChatId !== null && String(messageChatId) !== String(WATCHED_CHAT_ID)) {
    return "skipped";
  }

  const text = message.message || "";

  if (!text.toUpperCase().includes("PPPOE SESSION ENDED")) {
    return "skipped";
  }

  const telegramMessageId = Number(message.id);

  if (!Number.isFinite(telegramMessageId)) {
    console.log("COULD NOT PARSE PPPoE USAGE MESSAGE: invalid Telegram message ID");
    return "error";
  }

  const parsed = parseUsageMessage(text);

  if (!parsed) {
    console.log(`COULD NOT PARSE PPPoE USAGE MESSAGE [Msg ${telegramMessageId}]:\n${text}`);
    return "error";
  }

  const existingUsage = await findExistingUsage(supabase, telegramMessageId);

  if (existingUsage === "error") {
    console.log("Skipping because usage duplicate check failed.");
    return "error";
  }

  if (existingUsage) {
    return "skipped";
  }

  logUsageMessage(telegramMessageId, parsed);

  const customer = await findCustomer(supabase, parsed.customerUsername);

  if (customer === "error") {
    console.log("Skipping because customer lookup failed.");
    return "error";
  }

  if (!customer) {
    console.log(`CUSTOMER NOT FOUND: ${parsed.customerUsername}`);
    return "error";
  }

  console.log(`Customer matched: ${customer.name || "Subscriber"} (${customer.pppoe_username})`);

  // Omit total_bytes because Postgres computes it automatically via GENERATED ALWAYS column
  const usageRow = {
    customer_id: customer.id,
    pppoe_username: customer.pppoe_username,
    session_started_at: parsed.sessionStartedAt,
    session_ended_at: parsed.sessionEndedAt,
    download_bytes: parsed.downloadBytes,
    upload_bytes: parsed.uploadBytes,
    telegram_chat_id: telegramChatId,
    telegram_message_id: telegramMessageId,
  };

  const { error: insertError } = await supabase
    .from("usage_sessions")
    .insert(usageRow);

  if (insertError) {
    if (insertError.code === "23505") {
      console.log(`Telegram message ${telegramMessageId} already imported concurrently.`);
      return "skipped";
    }

    console.log("Usage insert failed:", formatSupabaseError(insertError));
    return "error";
  }

  console.log(`✅ USAGE SAVED SUCCESSFULLY [Msg ${telegramMessageId}]: ${customer.pppoe_username} - ${formatBytesHuman(parsed.totalBytes)}`);
  return "imported";
}

function getMessageChatId(message: TelegramUsageMessage): number | null {
  if (message.chatId === undefined || message.chatId === null) {
    return null;
  }

  const value = Number(String(message.chatId));

  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
}

function parseUsageMessage(text: string): ParsedUsageMessage | null {
  const customerUsername = getLineValue(text, "Customer");
  const sessionDurationText = getLineValue(text, "Session");
  const download = parseDataAmount(getLineValue(text, "Download"));
  const upload = parseDataAmount(getLineValue(text, "Upload"));
  const total = parseDataAmount(getLineValue(text, "Total"));
  const endedText = getLineValue(text, "Ended");

  if (
    !customerUsername ||
    !sessionDurationText ||
    download === null ||
    upload === null ||
    total === null ||
    !endedText
  ) {
    return null;
  }

  const sessionDurationMs = parseSessionDuration(sessionDurationText);
  const sessionEndedDate = parseKolkataTimestamp(endedText);

  if (sessionDurationMs === null || !sessionEndedDate) {
    return null;
  }

  const sessionStartedDate = new Date(
    sessionEndedDate.getTime() - sessionDurationMs
  );

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

function getLineValue(text: string, label: string): string | null {
  const regex = new RegExp(`(?:^|[\\r\\n])[^\\r\\n:]*?${label}[\\s*~_]*:[\\s*~_]*([^\\r\\n]+)`, "i");
  const match = text.match(regex);
  if (!match) return null;
  return match[1].replace(/^[*\s~`_]+|[*\s~`_]+$/g, "").trim();
}

function parseDataAmount(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^([\d.]+)\s*(GB|MB|KB|B)$/i);

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);

  if (!Number.isFinite(amount)) {
    return null;
  }

  const unit = match[2].toUpperCase();

  if (unit === "GB") {
    return Math.round(amount * 1024 * 1024 * 1024);
  }

  if (unit === "MB") {
    return Math.round(amount * 1024 * 1024);
  }

  if (unit === "KB") {
    return Math.round(amount * 1024);
  }

  return Math.round(amount);
}

/**
 * Supports all session duration variations:
 * - 3d03:55:10 (days d + HH:MM:SS)
 * - 1w2d03:55:10 (weeks w + days d + HH:MM:SS)
 * - 04:13:58 (HH:MM:SS)
 * - 23:54:12 (HH:MM:SS)
 * - 00:00:13 (HH:MM:SS)
 * - 1d4h30m12s (compact)
 */
function parseSessionDuration(value: string): number | null {
  const clean = value.trim();

  // Format 1: (weeks w)? (days d)? (hours):(minutes):(seconds)
  // Matches "1d00:47:34", "3d03:55:10", "1w 2d 04:12:30", "01:26:13"
  const complexMatch = clean.match(/^(?:(\d+)\s*w)?\s*(?:(\d+)\s*d)?\s*(\d+):([0-5]?\d):([0-5]?\d)$/i);
  if (complexMatch) {
    const weeks = Number(complexMatch[1] || 0);
    const days = Number(complexMatch[2] || 0);
    const hours = Number(complexMatch[3] || 0);
    const minutes = Number(complexMatch[4] || 0);
    const seconds = Number(complexMatch[5] || 0);
    return (((weeks * 7 + days) * 24 + hours) * 3600 + minutes * 60 + seconds) * 1000;
  }

  // Format 2: compact (e.g. 1d4h30m12s, 30m, 4h, etc)
  let totalSeconds = 0;
  let matchedAny = false;
  const w = clean.match(/(\d+)\s*w/i);
  if (w) { totalSeconds += Number(w[1]) * 7 * 86400; matchedAny = true; }
  const d = clean.match(/(\d+)\s*d/i);
  if (d) { totalSeconds += Number(d[1]) * 86400; matchedAny = true; }
  const h = clean.match(/(\d+)\s*h/i);
  if (h) { totalSeconds += Number(h[1]) * 3600; matchedAny = true; }
  const m = clean.match(/(\d+)\s*m/i);
  if (m) { totalSeconds += Number(m[1]) * 60; matchedAny = true; }
  const s = clean.match(/(\d+)\s*s/i);
  if (s) { totalSeconds += Number(s[1]); matchedAny = true; }

  if (matchedAny) return totalSeconds * 1000;
  return null;
}

function parseKolkataTimestamp(value: string): Date | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

async function findExistingUsage(
  db: PostgrestClient,
  telegramMessageId: number
): Promise<boolean | "error"> {
  const { data, error } = await db
    .from("usage_sessions")
    .select("id")
    .eq("telegram_chat_id", telegramChatId)
    .eq("telegram_message_id", telegramMessageId)
    .maybeSingle();

  if (error) {
    console.log("Usage duplicate check failed:", formatSupabaseError(error));
    return "error";
  }

  return Boolean(data);
}

async function findCustomer(
  db: PostgrestClient,
  customerUsername: string
): Promise<Customer | null | "error"> {
  try {
    const customer = await resolveCustomer(db, customerUsername);
    return customer;
  } catch (err) {
    console.log("Customer lookup error:", err);
    return "error";
  }
}

function logUsageMessage(
  telegramMessageId: number,
  parsed: ParsedUsageMessage
) {
  console.log(`\n--- [Telegram Msg #${telegramMessageId}] ---`);
  console.log(`Customer: ${parsed.customerUsername}`);
  console.log(`Session Duration: ${parsed.sessionDurationText} (${Math.round(parsed.sessionDurationMs / 1000)}s)`);
  console.log(`Data: Download=${formatBytesHuman(parsed.downloadBytes)} | Upload=${formatBytesHuman(parsed.uploadBytes)} | Total=${formatBytesHuman(parsed.totalBytes)}`);
  console.log(`Start: ${parsed.sessionStartedAt} -> End: ${parsed.sessionEndedAt}`);
}

function formatBytesHuman(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function formatSupabaseError(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}) {
  return {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  };
}

main().catch((error) => {
  console.error("Telegram listener fatal error:", error);
});
