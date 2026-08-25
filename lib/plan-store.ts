import fs from "fs";
import path from "path";
import type { CustomerPlan, ISPPlan } from "@/types/portal";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { DEFAULT_ISP_PLANS } from "./plan-presets";

export { DEFAULT_ISP_PLANS };

declare global {
  var __spectra_customer_plans_map: Record<string, CustomerPlan> | undefined;
  var __spectra_isp_plans_catalog: ISPPlan[] | undefined;
}

if (!globalThis.__spectra_customer_plans_map) {
  globalThis.__spectra_customer_plans_map = {};
}

const DATA_DIR = path.resolve(process.cwd(), "telegram-sync", "data");
const CUSTOMER_PLANS_FILE = path.join(DATA_DIR, "customer_plans.json");
const ISP_PLANS_FILE = path.join(DATA_DIR, "isp_plans.json");

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
 * Get all available ISP plans catalog
 */
export function getAllIspPlans(): ISPPlan[] {
  if (globalThis.__spectra_isp_plans_catalog && globalThis.__spectra_isp_plans_catalog.length > 0) {
    return globalThis.__spectra_isp_plans_catalog;
  }

  try {
    ensureDataDir();
    if (fs.existsSync(ISP_PLANS_FILE)) {
      const raw = fs.readFileSync(ISP_PLANS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        globalThis.__spectra_isp_plans_catalog = parsed;
        return parsed;
      }
    }
  } catch {
    // Fallback to default presets
  }
  return DEFAULT_ISP_PLANS;
}

/**
 * Save / Update ISP plan catalog
 */
export function saveIspPlansCatalog(plans: ISPPlan[]) {
  globalThis.__spectra_isp_plans_catalog = plans;
  try {
    ensureDataDir();
    fs.writeFileSync(ISP_PLANS_FILE, JSON.stringify(plans, null, 2), "utf-8");
  } catch {
    // Ignore read-only FS errors in serverless
  }
}

/**
 * Read current customer plans map from persistent storage and memory
 */
export function getCustomerPlansMap(): Record<string, CustomerPlan> {
  const memMap = globalThis.__spectra_customer_plans_map || {};

  try {
    if (fs.existsSync(CUSTOMER_PLANS_FILE)) {
      const raw = fs.readFileSync(CUSTOMER_PLANS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return { ...parsed, ...memMap };
    }
  } catch {
    // Ignore read errors
  }
  return memMap;
}

/**
 * Save customer plans map to persistent storage and in-memory cache
 */
function saveCustomerPlansMap(map: Record<string, CustomerPlan>) {
  globalThis.__spectra_customer_plans_map = {
    ...(globalThis.__spectra_customer_plans_map || {}),
    ...map,
  };

  try {
    ensureDataDir();
    fs.writeFileSync(CUSTOMER_PLANS_FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch {
    // Ignore read-only FS errors in serverless
  }
}

/**
 * Default fallback plan when customer has no plan assigned
 */
export function getDefaultCustomerPlan(): CustomerPlan {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);

  return {
    plan_id: "plan-fiber-300",
    plan_name: "Spectra GigaFiber 300 Mbps Unlimited",
    speed_mbps: 300,
    upload_speed_mbps: 300,
    price_inr: 999,
    data_limit_gb: null,
    billing_cycle: "monthly",
    renewal_date: nextMonth.toISOString().split("T")[0],
    description: "Symmetric 300 Mbps Gigabit fiber with zero throttling and 24x7 SLA guarantee.",
  };
}

/**
 * Retrieve the active plan for a specific customer by ID or PPPoE username
 */
export function getCustomerPlan(
  customerId?: string,
  pppoeUsername?: string,
  dbPlanOverride?: Partial<CustomerPlan>
): CustomerPlan {
  if (dbPlanOverride?.plan_name && dbPlanOverride?.speed_mbps) {
    return {
      plan_id: dbPlanOverride.plan_id || `plan-${dbPlanOverride.speed_mbps}`,
      plan_name: dbPlanOverride.plan_name,
      speed_mbps: Number(dbPlanOverride.speed_mbps),
      upload_speed_mbps: Number(dbPlanOverride.upload_speed_mbps || dbPlanOverride.speed_mbps),
      price_inr: Number(dbPlanOverride.price_inr || 999),
      data_limit_gb: dbPlanOverride.data_limit_gb ? Number(dbPlanOverride.data_limit_gb) : null,
      billing_cycle: dbPlanOverride.billing_cycle || "monthly",
      renewal_date: dbPlanOverride.renewal_date,
      description: dbPlanOverride.description || `${dbPlanOverride.speed_mbps} Mbps Symmetric Fiber`,
    };
  }

  const map = getCustomerPlansMap();

  if (customerId && map[customerId]) {
    return map[customerId];
  }

  if (pppoeUsername) {
    const clean = pppoeUsername.toLowerCase().trim();
    if (map[clean]) return map[clean];
    const prefix = clean.split("@")[0].trim();
    if (prefix && map[prefix]) return map[prefix];
  }

  return getDefaultCustomerPlan();
}

/**
 * Set / Update plan for a customer persistently across restarts and sync to DB
 */
export async function setCustomerPlan(
  customerId: string,
  pppoeUsername: string | undefined,
  plan: CustomerPlan
): Promise<{ success: boolean; plan: CustomerPlan }> {
  // 1. Update in-memory & persistent JSON map
  const map = getCustomerPlansMap();
  map[customerId] = plan;
  if (pppoeUsername) {
    const clean = pppoeUsername.toLowerCase().trim();
    map[clean] = plan;
    const prefix = clean.split("@")[0].trim();
    if (prefix) map[prefix] = plan;
  }
  saveCustomerPlansMap(map);

  // 2. Try to sync to Supabase database customers table
  try {
    const supabase = getAdminSupabase();
    await supabase
      .from("customers")
      .update({
        plan_id: plan.plan_id,
        plan_name: plan.plan_name,
        plan_speed_mbps: plan.speed_mbps,
        plan_upload_mbps: plan.upload_speed_mbps,
        plan_price_inr: plan.price_inr,
        plan_data_limit_gb: plan.data_limit_gb,
        plan_renewal_date: plan.renewal_date,
      })
      .eq("id", customerId);
  } catch (dbErr) {
    // Non-fatal if columns don't exist yet in Supabase schema
    console.warn("[Plan Store] Note: Supabase update skipped:", dbErr);
  }

  return { success: true, plan };
}
