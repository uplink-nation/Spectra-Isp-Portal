import fs from "fs";
import path from "path";
import type { CustomerStatusRecord, PresenceEntry } from "@/types/portal";

export type { PresenceEntry };

declare global {
  var __spectra_presence_entries: Record<string, PresenceEntry> | undefined;
  var __spectra_status_logs_cache: CustomerStatusRecord[] | undefined;
}

if (!globalThis.__spectra_presence_entries) {
  globalThis.__spectra_presence_entries = {};
}
if (!globalThis.__spectra_status_logs_cache) {
  globalThis.__spectra_status_logs_cache = [];
}

const DATA_DIR = path.resolve(process.cwd(), "telegram-sync", "data");
const PRESENCE_FILE = path.join(DATA_DIR, "presence.json");
const STATUS_LOGS_FILE = path.join(DATA_DIR, "status_logs.json");

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Read-only filesystem in serverless environments is expected
  }
}

/**
 * Read current presence map for all subscribers
 */
export function getPresenceMap(): Record<string, PresenceEntry> {
  const memMap = globalThis.__spectra_presence_entries || {};

  try {
    if (fs.existsSync(PRESENCE_FILE)) {
      const raw = fs.readFileSync(PRESENCE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return { ...parsed, ...memMap };
    }
  } catch {
    // Ignore read errors
  }
  return memMap;
}

/**
 * Save or update presence for a subscriber
 */
export function savePresenceEntry(entry: PresenceEntry) {
  const current = getPresenceMap();
  current[entry.customer_id] = entry;
  const clean = entry.pppoe_username.toLowerCase().trim();
  current[clean] = entry;
  const prefix = clean.split("@")[0].trim();
  if (prefix) current[prefix] = entry;

  globalThis.__spectra_presence_entries = current;

  try {
    ensureDataDir();
    fs.writeFileSync(PRESENCE_FILE, JSON.stringify(current, null, 2), "utf-8");
  } catch {
    // Ignore read-only FS errors in serverless
  }
}

/**
 * Get presence entry for a specific subscriber by ID or PPPoE username
 */
export function getCustomerPresence(
  customerId?: string,
  pppoeUsername?: string,
  dbOverride?: { is_online?: boolean; last_status_change_at?: string }
): PresenceEntry | null {
  const map = getPresenceMap();
  if (customerId && map[customerId]) return map[customerId];
  if (pppoeUsername) {
    const clean = pppoeUsername.toLowerCase().trim();
    if (map[clean]) return map[clean];
    const prefix = clean.split("@")[0].trim();
    if (prefix && map[prefix]) return map[prefix];
  }

  if (dbOverride && typeof dbOverride.is_online === "boolean") {
    return {
      customer_id: customerId || "",
      pppoe_username: pppoeUsername || "",
      is_online: dbOverride.is_online,
      status: dbOverride.is_online ? "ONLINE" : "OFFLINE",
      last_status_change_at: dbOverride.last_status_change_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Read historical status transition logs
 */
export function getStoredStatusLogs(
  customerId?: string,
  limit = 100
): CustomerStatusRecord[] {
  let logs: CustomerStatusRecord[] = globalThis.__spectra_status_logs_cache || [];

  try {
    if (fs.existsSync(STATUS_LOGS_FILE)) {
      const raw = fs.readFileSync(STATUS_LOGS_FILE, "utf-8");
      const parsed: CustomerStatusRecord[] = JSON.parse(raw);
      // Merge unique by id
      const existingIds = new Set(logs.map((l) => l.id));
      for (const p of parsed) {
        if (!existingIds.has(p.id)) {
          logs.push(p);
        }
      }
    }
  } catch {
    // Ignore read errors
  }

  if (customerId) {
    logs = logs.filter((l) => l.customer_id === customerId);
  }
  return logs.slice(0, limit);
}

/**
 * Append a status transition log
 */
export function appendStatusLog(log: CustomerStatusRecord) {
  const current = getStoredStatusLogs(undefined, 500);
  const updated = [log, ...current.filter((l) => l.id !== log.id)].slice(0, 500);
  globalThis.__spectra_status_logs_cache = updated;

  try {
    ensureDataDir();
    fs.writeFileSync(STATUS_LOGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch {
    // Ignore read-only FS errors in serverless
  }
}
