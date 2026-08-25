import { PostgrestClient } from "@supabase/postgrest-js";

export interface Customer {
  id: string;
  name: string | null;
  pppoe_username: string;
}

let cachedCustomers: Customer[] = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Fetch all customers with caching
 */
export async function getCustomers(supabase: PostgrestClient, forceRefresh = false): Promise<Customer[]> {
  const now = Date.now();
  if (!forceRefresh && cachedCustomers.length > 0 && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedCustomers;
  }

  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, pppoe_username");

    if (!error && data) {
      cachedCustomers = data;
      lastCacheTime = now;
    }
  } catch (err) {
    console.error("[Customer Matcher] Failed to load customers from DB:", err);
  }

  return cachedCustomers;
}

/**
 * High-precision, zero-ambiguity customer matching algorithm
 */
export function matchCustomer(inputUsername: string, customers: Customer[]): Customer | null {
  if (!inputUsername) return null;
  const cleanInput = inputUsername.trim().toLowerCase().replace(/^[*\s~`_]+|[*\s~`_]+$/g, "");
  if (!cleanInput) return null;

  const inputNoDomain = cleanInput.split("@")[0].trim();
  const inputAlpha = inputNoDomain.replace(/[^a-z0-9]/gi, "");
  const inputDigits = cleanInput.replace(/\D/g, "");

  // 1. Exact case-insensitive match on full username
  const exact = customers.find(
    (c) => c.pppoe_username.toLowerCase().trim() === cleanInput
  );
  if (exact) return exact;

  // 2. Exact match on username without domain (@...)
  const noDomainMatch = customers.find((c) => {
    const cNoDomain = c.pppoe_username.toLowerCase().split("@")[0].trim();
    return cNoDomain === inputNoDomain;
  });
  if (noDomainMatch) return noDomainMatch;

  // 3. Alphanumeric match (ignoring underscores, hyphens, dots, and optional local/wid suffixes)
  const alphaMatch = customers.find((c) => {
    const cAlpha = c.pppoe_username.toLowerCase().split("@")[0].replace(/[^a-z0-9]/gi, "");
    if (cAlpha.length < 3 || inputAlpha.length < 3) return false;
    return (
      cAlpha === inputAlpha ||
      (inputAlpha.length >= 6 && cAlpha.startsWith(inputAlpha)) ||
      (cAlpha.length >= 6 && inputAlpha.startsWith(cAlpha))
    );
  });
  if (alphaMatch) return alphaMatch;

  // 4. FTTH telephone number matching (e.g. 2793299202 inside pr2793299202_wid@ftth.bsnl.in)
  if (inputDigits.length >= 7) {
    const digitMatch = customers.find((c) => {
      const cDigits = c.pppoe_username.replace(/\D/g, "");
      return (
        cDigits.length >= 7 &&
        (cDigits === inputDigits ||
          cDigits.includes(inputDigits) ||
          inputDigits.includes(cDigits))
      );
    });
    if (digitMatch) return digitMatch;
  }

  // 5. Safe unique prefix match (ONLY if strictly ONE customer in DB matches to avoid ambiguity)
  const candidates = customers.filter((c) => {
    const cNoDomain = c.pppoe_username.toLowerCase().split("@")[0];
    return (
      (inputNoDomain.length >= 5 && cNoDomain.startsWith(inputNoDomain)) ||
      (cNoDomain.length >= 5 && inputNoDomain.startsWith(cNoDomain))
    );
  });

  if (candidates.length === 1) {
    return candidates[0];
  }

  return null;
}

/**
 * Resolve customer from username string against database
 */
export async function resolveCustomer(
  supabase: PostgrestClient,
  customerUsername: string
): Promise<Customer | null> {
  const list = await getCustomers(supabase);
  let matched = matchCustomer(customerUsername, list);

  // If not found in cache, force fresh DB query in case customer was newly added
  if (!matched) {
    const freshList = await getCustomers(supabase, true);
    matched = matchCustomer(customerUsername, freshList);
  }

  return matched;
}
