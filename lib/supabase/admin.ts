import { createClient } from "@supabase/supabase-js";
import type { Invoice, SupportTicket, SpeedTestRecord, UsageSessionRecord, CustomerStatusRecord, CustomerOnlineStatus, CustomerPlan, DbCustomerWithStats } from "@/types/portal";
import { getPresenceMap, savePresenceEntry, getStoredStatusLogs, appendStatusLog } from "@/lib/presence-store";
import { getCustomerPlan, setCustomerPlan } from "@/lib/plan-store";

export type { DbCustomerWithStats };

// Ensure Node 20 doesn't complain about WebSocket in serverless environments
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class DummyWebSocket {} as unknown as typeof WebSocket;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

/**
 * Creates an elevated Supabase service-role client that bypasses RLS
 * for central administrative and NOC operations.
 */
export function getAdminSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase configuration. Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// In-memory operational cache for invoices, tickets, speed tests, and status logs fallback if Supabase tables are not yet created in PostgREST
declare global {
  var __spectra_invoices_cache: Invoice[] | undefined;
  var __spectra_tickets_cache: SupportTicket[] | undefined;
  var __spectra_speed_tests_cache: SpeedTestRecord[] | undefined;
  var __spectra_status_logs_cache: CustomerStatusRecord[] | undefined;
  var __spectra_presence_map: Record<string, { is_online: boolean; last_status_change_at: string; status: CustomerOnlineStatus }> | undefined;
}

if (!globalThis.__spectra_invoices_cache) {
  globalThis.__spectra_invoices_cache = [];
}
if (!globalThis.__spectra_tickets_cache) {
  globalThis.__spectra_tickets_cache = [];
}
if (!globalThis.__spectra_speed_tests_cache) {
  globalThis.__spectra_speed_tests_cache = [];
}
if (!globalThis.__spectra_status_logs_cache) {
  globalThis.__spectra_status_logs_cache = [];
}
if (!globalThis.__spectra_presence_map) {
  globalThis.__spectra_presence_map = {};
}

/**
 * Format raw bytes into human readable format (GB / MB)
 */
function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 GB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1000) return `${(gb / 1024).toFixed(2)} TB`;
  return `${gb.toFixed(2)} GB`;
}

/**
 * Fetches all real subscribers from the database, joins with auth user emails,
 * and calculates their aggregated data usage.
 */
export async function getAllDbCustomers(): Promise<DbCustomerWithStats[]> {
  const supabase = getAdminSupabase();

  // 1. Fetch all customers from DB
  const { data: dbCustomers, error: custErr } = await supabase
    .from("customers")
    .select("*")
    .order("name", { ascending: true });

  if (custErr) {
    console.error("Error fetching customers from database:", custErr);
    return [];
  }

  if (!dbCustomers || dbCustomers.length === 0) {
    return [];
  }

  // 2. Fetch auth users to map emails
  const emailByAuthId = new Map<string, string>();
  try {
    const { data: authData } = await supabase.auth.admin.listUsers();
    if (authData?.users) {
      for (const u of authData.users) {
        if (u.email) {
          emailByAuthId.set(u.id, u.email);
        }
      }
    }
  } catch (authErr) {
    console.warn("Could not list auth users for email mapping:", authErr);
  }

  // 3. Fetch usage sessions aggregation & session count
  const usageByCustomerId = new Map<string, number>();
  const sessionsCountByCustomerId = new Map<string, number>();
  try {
    const { data: sessions } = await supabase
      .from("usage_sessions")
      .select("customer_id, download_bytes, upload_bytes, total_bytes");

    if (sessions && sessions.length > 0) {
      for (const s of sessions) {
        const custId = s.customer_id;
        const bytes =
          Number(s.total_bytes) ||
          Number(s.download_bytes || 0) + Number(s.upload_bytes || 0);
        const current = usageByCustomerId.get(custId) || 0;
        usageByCustomerId.set(custId, current + bytes);
        sessionsCountByCustomerId.set(custId, (sessionsCountByCustomerId.get(custId) || 0) + 1);
      }
    }
  } catch (usageErr) {
    console.warn("Could not aggregate usage sessions:", usageErr);
  }

  // 4. Fetch speed tests summary by customer
  const speedTestsCountByCustomerId = new Map<string, number>();
  const latestSpeedTestByCustomerId = new Map<string, { mbps: number; ping: number }>();
  try {
    const { data: tests } = await supabase
      .from("speed_tests")
      .select("customer_id, download_mbps, ping_ms, created_at")
      .order("created_at", { ascending: false });

    if (tests && tests.length > 0) {
      for (const t of tests) {
        const custId = t.customer_id;
        speedTestsCountByCustomerId.set(custId, (speedTestsCountByCustomerId.get(custId) || 0) + 1);
        if (!latestSpeedTestByCustomerId.has(custId)) {
          latestSpeedTestByCustomerId.set(custId, {
            mbps: Number(t.download_mbps || 0),
            ping: Number(t.ping_ms || 0),
          });
        }
      }
    }
  } catch (speedErr) {
    console.warn("Could not aggregate speed tests:", speedErr);
  }

  // 5. Fetch presence status by customer from persistent store and Supabase
  const presenceByCustomerId = new Map<string, { is_online: boolean; last_status_change_at?: string; status: CustomerOnlineStatus }>();

  // a. Load from shared presence store
  const persistentPresenceMap = getPresenceMap();
  for (const [, val] of Object.entries(persistentPresenceMap)) {
    if (val.customer_id) {
      presenceByCustomerId.set(val.customer_id, {
        is_online: val.is_online,
        last_status_change_at: val.last_status_change_at,
        status: val.status,
      });
    }
  }

  // b. Merge from Supabase if table exists
  try {
    const { data: statusRows } = await supabase
      .from("customer_status_logs")
      .select("customer_id, status, event_time")
      .order("event_time", { ascending: false });

    if (statusRows && statusRows.length > 0) {
      for (const row of statusRows) {
        const custId = String(row.customer_id);
        if (!presenceByCustomerId.has(custId)) {
          presenceByCustomerId.set(custId, {
            is_online: row.status === "ONLINE",
            last_status_change_at: (row.event_time as string) || undefined,
            status: row.status as CustomerOnlineStatus,
          });
        }
      }
    }
  } catch (statusErr) {
    console.warn("Could not query customer_status_logs:", statusErr);
  }

  // Merge in-memory presence map
  const inMemoryMap = globalThis.__spectra_presence_map || {};
  for (const [custId, val] of Object.entries(inMemoryMap)) {
    if (!presenceByCustomerId.has(custId)) {
      presenceByCustomerId.set(custId, val);
    }
  }

  // 6. Combine data
  return dbCustomers.map((c) => {
    const authEmail = c.auth_user_id ? emailByAuthId.get(c.auth_user_id) : undefined;
    const totalBytes = usageByCustomerId.get(c.id) || 0;
    const latestSpeed = latestSpeedTestByCustomerId.get(c.id);
    const presence = presenceByCustomerId.get(c.id);

    const isOnline = presence ? presence.is_online : (c.is_online ?? false);
    const lastStatusChange = presence?.last_status_change_at || c.last_status_change_at;
    const plan = getCustomerPlan(c.id, c.pppoe_username, {
      plan_id: c.plan_id,
      plan_name: c.plan_name,
      speed_mbps: c.plan_speed_mbps,
      upload_speed_mbps: c.plan_upload_mbps,
      price_inr: c.plan_price_inr,
      data_limit_gb: c.plan_data_limit_gb,
      renewal_date: c.plan_renewal_date,
    });

    return {
      id: c.id,
      name: c.name,
      pppoe_username: c.pppoe_username,
      email: authEmail || c.email || `${c.pppoe_username.toLowerCase()}@spectra.net`,
      created_at: c.created_at,
      totalUsageBytes: totalBytes,
      totalUsageFormatted: formatBytes(totalBytes),
      totalSessionsCount: sessionsCountByCustomerId.get(c.id) || 0,
      totalSpeedTestsCount: speedTestsCountByCustomerId.get(c.id) || 0,
      latestSpeedTestMbps: latestSpeed?.mbps,
      latestSpeedTestPing: latestSpeed?.ping,
      is_online: isOnline,
      last_status_change_at: lastStatusChange,
      status_text: (isOnline ? "ONLINE" : "OFFLINE") as CustomerOnlineStatus,
      plan: plan,
      plan_name: plan.plan_name,
      plan_speed_mbps: plan.speed_mbps,
      plan_upload_mbps: plan.upload_speed_mbps,
      plan_price_inr: plan.price_inr,
      plan_data_limit_gb: plan.data_limit_gb,
      plan_renewal_date: plan.renewal_date,
    };
  });
}

/**
 * Checks if the invoices and support_tickets tables exist in Supabase PostgREST schema
 */
export async function getSchemaStatus(): Promise<{
  invoicesTableReady: boolean;
  ticketsTableReady: boolean;
  needsSqlSetup: boolean;
}> {
  const supabase = getAdminSupabase();
  let invoicesReady = false;
  let ticketsReady = false;

  try {
    const { error: invErr } = await supabase.from("invoices").select("id").limit(1);
    if (!invErr || invErr.code !== "PGRST205") {
      invoicesReady = true;
    }
  } catch {
    invoicesReady = false;
  }

  try {
    const { error: tktErr } = await supabase.from("support_tickets").select("id").limit(1);
    if (!tktErr || tktErr.code !== "PGRST205") {
      ticketsReady = true;
    }
  } catch {
    ticketsReady = false;
  }

  return {
    invoicesTableReady: invoicesReady,
    ticketsTableReady: ticketsReady,
    needsSqlSetup: !invoicesReady || !ticketsReady,
  };
}

/**
 * Fetches all invoices across all subscribers
 */
export async function getDbInvoices(): Promise<Invoice[]> {
  const supabase = getAdminSupabase();

  try {
    const { data: dbInvoices, error } = await supabase
      .from("invoices")
      .select("*, customers(name, pppoe_username)")
      .order("period_start", { ascending: false });

    if (!error && dbInvoices && dbInvoices.length > 0) {
      const formatted: Invoice[] = dbInvoices.map((inv: Record<string, unknown>) => {
        const cust = inv.customers as { name?: string; pppoe_username?: string } | null;
        return {
          id: String(inv.id),
          customer_id: String(inv.customer_id),
          invoice_number: String(inv.invoice_number),
          plan_name: String(inv.plan_name),
          period_start: String(inv.period_start),
          period_end: String(inv.period_end),
          issue_date: String(inv.issue_date),
          due_date: String(inv.due_date),
          base_amount: Number(inv.base_amount),
          cgst_amount: Number(inv.cgst_amount || 0),
          sgst_amount: Number(inv.sgst_amount || 0),
          total_amount: Number(inv.total_amount),
          status: inv.status as Invoice["status"],
          payment_method: (inv.payment_method as string) || null,
          transaction_ref: (inv.transaction_ref as string) || null,
          paid_at: (inv.paid_at as string) || null,
          customer_name: cust?.name || "Subscriber",
          pppoe_username: cust?.pppoe_username || "N/A",
          created_at: (inv.created_at as string) || new Date().toISOString(),
        };
      });

      // Update operational cache
      globalThis.__spectra_invoices_cache = formatted;
      return formatted;
    }
  } catch (err) {
    console.warn("Could not query public.invoices in Supabase:", err);
  }

  // Fallback to operational cache if table not ready
  if (globalThis.__spectra_invoices_cache && globalThis.__spectra_invoices_cache.length > 0) {
    return globalThis.__spectra_invoices_cache;
  }

  return [];
}

/**
 * Fetches all support tickets across all subscribers
 */
export async function getDbTickets(): Promise<SupportTicket[]> {
  const supabase = getAdminSupabase();

  try {
    const { data: dbTickets, error } = await supabase
      .from("support_tickets")
      .select("*, customers(name, pppoe_username)")
      .order("created_at", { ascending: false });

    if (!error && dbTickets && dbTickets.length > 0) {
      const formatted: SupportTicket[] = dbTickets.map((t: Record<string, unknown>) => {
        const cust = t.customers as { name?: string; pppoe_username?: string } | null;
        return {
          id: String(t.id),
          customer_id: String(t.customer_id),
          ticket_code: String(t.ticket_code),
          category: t.category as SupportTicket["category"],
          subject: String(t.subject),
          description: String(t.description),
          priority: t.priority as SupportTicket["priority"],
          status: t.status as SupportTicket["status"],
          contact_phone: (t.contact_phone as string) || null,
          resolution_notes: (t.resolution_notes as string) || null,
          assigned_to: (t.assigned_to as string) || null,
          customer_name: cust?.name || "Subscriber",
          pppoe_username: cust?.pppoe_username || "N/A",
          created_at: (t.created_at as string) || new Date().toISOString(),
          updated_at: (t.updated_at as string) || (t.created_at as string),
        };
      });

      // Update operational cache
      globalThis.__spectra_tickets_cache = formatted;
      return formatted;
    }
  } catch (err) {
    console.warn("Could not query public.support_tickets in Supabase:", err);
  }

  // Fallback to operational cache
  if (globalThis.__spectra_tickets_cache && globalThis.__spectra_tickets_cache.length > 0) {
    return globalThis.__spectra_tickets_cache;
  }

  return [];
}

/**
 * Creates a single invoice in the database
 */
export async function createDbInvoice(payload: {
  customer_id: string;
  plan_name: string;
  period_start: string;
  period_end: string;
  issue_date: string;
  due_date: string;
  base_amount: number;
  status?: "paid" | "pending" | "overdue";
  payment_method?: string;
  transaction_ref?: string;
  customer_name?: string;
  pppoe_username?: string;
}): Promise<Invoice> {
  const supabase = getAdminSupabase();

  const cgst = Number((payload.base_amount * 0.09).toFixed(2));
  const sgst = Number((payload.base_amount * 0.09).toFixed(2));
  const total = Number((payload.base_amount + cgst + sgst).toFixed(2));
  const invoiceNumber = `INV-${payload.period_start.substring(0, 7)}-${Math.floor(10000 + Math.random() * 90000)}`;

  const newInvoiceData = {
    customer_id: payload.customer_id,
    invoice_number: invoiceNumber,
    plan_name: payload.plan_name,
    period_start: payload.period_start,
    period_end: payload.period_end,
    issue_date: payload.issue_date,
    due_date: payload.due_date,
    base_amount: payload.base_amount,
    cgst_amount: cgst,
    sgst_amount: sgst,
    total_amount: total,
    status: payload.status || "pending",
    payment_method: payload.payment_method || null,
    transaction_ref: payload.transaction_ref || null,
    paid_at: payload.status === "paid" ? new Date().toISOString() : null,
  };

  let savedInvoice: Invoice = {
    id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ...newInvoiceData,
    customer_name: payload.customer_name || "Subscriber",
    pppoe_username: payload.pppoe_username || "N/A",
    created_at: new Date().toISOString(),
  };

  try {
    const { data: inserted, error } = await supabase
      .from("invoices")
      .insert(newInvoiceData)
      .select("*, customers(name, pppoe_username)")
      .single();

    if (!error && inserted) {
      const cust = inserted.customers as { name?: string; pppoe_username?: string } | null;
      savedInvoice = {
        id: String(inserted.id),
        customer_id: String(inserted.customer_id),
        invoice_number: String(inserted.invoice_number),
        plan_name: String(inserted.plan_name),
        period_start: String(inserted.period_start),
        period_end: String(inserted.period_end),
        issue_date: String(inserted.issue_date),
        due_date: String(inserted.due_date),
        base_amount: Number(inserted.base_amount),
        cgst_amount: Number(inserted.cgst_amount || 0),
        sgst_amount: Number(inserted.sgst_amount || 0),
        total_amount: Number(inserted.total_amount),
        status: inserted.status as Invoice["status"],
        payment_method: (inserted.payment_method as string) || null,
        transaction_ref: (inserted.transaction_ref as string) || null,
        paid_at: (inserted.paid_at as string) || null,
        customer_name: cust?.name || payload.customer_name || "Subscriber",
        pppoe_username: cust?.pppoe_username || payload.pppoe_username || "N/A",
        created_at: (inserted.created_at as string) || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn("Could not insert invoice to public.invoices table in Supabase:", err);
  }

  // Always update operational memory cache
  const currentCache = globalThis.__spectra_invoices_cache || [];
  globalThis.__spectra_invoices_cache = [savedInvoice, ...currentCache.filter((i) => i.id !== savedInvoice.id)];

  return savedInvoice;
}

/**
 * Generates and dispatches batch monthly invoices for all active DB subscribers
 */
export async function batchCreateDbInvoices(payload: {
  period_start: string;
  period_end: string;
  issue_date: string;
  due_date: string;
  plan_name?: string;
  base_amount?: number;
}): Promise<{ count: number; invoices: Invoice[] }> {
  const supabase = getAdminSupabase();
  const customers = await getAllDbCustomers();

  if (customers.length === 0) {
    throw new Error("No subscribers found in database to generate invoices for.");
  }

  const plan_name = payload.plan_name || "Spectra GigaFiber 300 Mbps Unlimited";
  const base_amount = Number(payload.base_amount || 999.0);
  const cgst = Number((base_amount * 0.09).toFixed(2));
  const sgst = Number((base_amount * 0.09).toFixed(2));
  const total = Number((base_amount + cgst + sgst).toFixed(2));
  const yearMonth = payload.period_start.substring(0, 7);

  const generatedInvoices: Invoice[] = [];

  for (const cust of customers) {
    const pppoeSuffix =
      cust.pppoe_username.replace(/\D/g, "").slice(-4) ||
      String(Math.floor(1000 + Math.random() * 9000));
    const invoiceNumber = `INV-${yearMonth}-SP${pppoeSuffix}`;

    const newInvPayload = {
      customer_id: cust.id,
      invoice_number: invoiceNumber,
      plan_name: plan_name,
      period_start: payload.period_start,
      period_end: payload.period_end,
      issue_date: payload.issue_date,
      due_date: payload.due_date,
      base_amount: base_amount,
      cgst_amount: cgst,
      sgst_amount: sgst,
      total_amount: total,
      status: "pending" as const,
    };

    let savedInv: Invoice = {
      id: `inv-${yearMonth}-${cust.id.slice(0, 8)}`,
      ...newInvPayload,
      customer_name: cust.name,
      pppoe_username: cust.pppoe_username,
      created_at: new Date().toISOString(),
    };

    try {
      const { data: inserted, error } = await supabase
        .from("invoices")
        .upsert(newInvPayload, { onConflict: "invoice_number" })
        .select()
        .single();

      if (!error && inserted) {
        savedInv = {
          ...savedInv,
          id: String(inserted.id),
          created_at: inserted.created_at || savedInv.created_at,
        };
      }
    } catch {
      // ignore
    }

    generatedInvoices.push(savedInv);
  }

  // Update operational cache
  const currentCache = globalThis.__spectra_invoices_cache || [];
  const generatedMap = new Map(generatedInvoices.map((i) => [i.invoice_number, i]));
  const remaining = currentCache.filter((i) => !generatedMap.has(i.invoice_number));
  globalThis.__spectra_invoices_cache = [...generatedInvoices, ...remaining];

  return {
    count: generatedInvoices.length,
    invoices: generatedInvoices,
  };
}

/**
 * Marks an invoice as settled / paid offline
 */
export async function markDbInvoicePaid(payload: {
  invoice_id: string;
  payment_method?: string;
  transaction_ref?: string;
}): Promise<Invoice | null> {
  const supabase = getAdminSupabase();
  const paymentMethod = payload.payment_method || "Cash / Direct Bank Transfer";
  const transactionRef =
    payload.transaction_ref ||
    `SETTLE-NOC-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowStr = new Date().toISOString();

  let updatedInvoice: Invoice | null = null;

  try {
    const { data: updated, error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: nowStr,
        payment_method: paymentMethod,
        transaction_ref: transactionRef,
      })
      .eq("id", payload.invoice_id)
      .select("*, customers(name, pppoe_username)")
      .single();

    if (!error && updated) {
      const cust = updated.customers as { name?: string; pppoe_username?: string } | null;
      updatedInvoice = {
        id: String(updated.id),
        customer_id: String(updated.customer_id),
        invoice_number: String(updated.invoice_number),
        plan_name: String(updated.plan_name),
        period_start: String(updated.period_start),
        period_end: String(updated.period_end),
        issue_date: String(updated.issue_date),
        due_date: String(updated.due_date),
        base_amount: Number(updated.base_amount),
        cgst_amount: Number(updated.cgst_amount || 0),
        sgst_amount: Number(updated.sgst_amount || 0),
        total_amount: Number(updated.total_amount),
        status: "paid",
        payment_method: paymentMethod,
        transaction_ref: transactionRef,
        paid_at: nowStr,
        customer_name: cust?.name || "Subscriber",
        pppoe_username: cust?.pppoe_username || "N/A",
        created_at: (updated.created_at as string) || nowStr,
      };
    }
  } catch (err) {
    console.warn("Could not update invoice in Supabase table:", err);
  }

  // Update operational cache
  if (globalThis.__spectra_invoices_cache) {
    globalThis.__spectra_invoices_cache = globalThis.__spectra_invoices_cache.map((inv) => {
      if (inv.id === payload.invoice_id) {
        const item: Invoice = {
          ...inv,
          status: "paid",
          paid_at: nowStr,
          payment_method: paymentMethod,
          transaction_ref: transactionRef,
        };
        if (!updatedInvoice) updatedInvoice = item;
        return item;
      }
      return inv;
    });
  }

  return updatedInvoice;
}

/**
 * Creates a support ticket in the database
 */
export async function createDbTicket(payload: {
  customer_id: string;
  category: SupportTicket["category"];
  subject: string;
  description: string;
  priority?: SupportTicket["priority"];
  contact_phone?: string | null;
  customer_name?: string;
  pppoe_username?: string;
}): Promise<SupportTicket> {
  const supabase = getAdminSupabase();

  const ticketCode = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
  const newTicketData = {
    customer_id: payload.customer_id,
    ticket_code: ticketCode,
    category: payload.category || "general",
    subject: payload.subject.trim(),
    description: payload.description.trim(),
    priority: payload.priority || "normal",
    status: "open" as const,
    contact_phone: payload.contact_phone || null,
  };

  let savedTicket: SupportTicket = {
    id: `tkt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ...newTicketData,
    customer_name: payload.customer_name || "Subscriber",
    pppoe_username: payload.pppoe_username || "N/A",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data: inserted, error } = await supabase
      .from("support_tickets")
      .insert(newTicketData)
      .select("*, customers(name, pppoe_username)")
      .single();

    if (!error && inserted) {
      const cust = inserted.customers as { name?: string; pppoe_username?: string } | null;
      savedTicket = {
        id: String(inserted.id),
        customer_id: String(inserted.customer_id),
        ticket_code: String(inserted.ticket_code),
        category: inserted.category as SupportTicket["category"],
        subject: String(inserted.subject),
        description: String(inserted.description),
        priority: inserted.priority as SupportTicket["priority"],
        status: inserted.status as SupportTicket["status"],
        contact_phone: (inserted.contact_phone as string) || null,
        resolution_notes: (inserted.resolution_notes as string) || null,
        assigned_to: (inserted.assigned_to as string) || null,
        customer_name: cust?.name || payload.customer_name || "Subscriber",
        pppoe_username: cust?.pppoe_username || payload.pppoe_username || "N/A",
        created_at: (inserted.created_at as string) || new Date().toISOString(),
        updated_at: (inserted.updated_at as string) || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn("Could not insert ticket into Supabase table:", err);
  }

  // Always update operational cache
  const currentCache = globalThis.__spectra_tickets_cache || [];
  globalThis.__spectra_tickets_cache = [savedTicket, ...currentCache.filter((t) => t.id !== savedTicket.id)];

  return savedTicket;
}

/**
 * Updates a support ticket (status, priority, resolution notes, assigned technician)
 */
export async function updateDbTicket(payload: {
  ticket_id: string;
  status?: SupportTicket["status"];
  priority?: SupportTicket["priority"];
  resolution_notes?: string;
  assigned_to?: string;
}): Promise<SupportTicket | null> {
  const supabase = getAdminSupabase();
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.status) updatePayload.status = payload.status;
  if (payload.priority) updatePayload.priority = payload.priority;
  if (payload.resolution_notes !== undefined) updatePayload.resolution_notes = payload.resolution_notes;
  if (payload.assigned_to !== undefined) updatePayload.assigned_to = payload.assigned_to;

  let updatedTicket: SupportTicket | null = null;

  try {
    const { data: updated, error } = await supabase
      .from("support_tickets")
      .update(updatePayload)
      .eq("id", payload.ticket_id)
      .select("*, customers(name, pppoe_username)")
      .single();

    if (!error && updated) {
      const cust = updated.customers as { name?: string; pppoe_username?: string } | null;
      updatedTicket = {
        id: String(updated.id),
        customer_id: String(updated.customer_id),
        ticket_code: String(updated.ticket_code),
        category: updated.category as SupportTicket["category"],
        subject: String(updated.subject),
        description: String(updated.description),
        priority: updated.priority as SupportTicket["priority"],
        status: updated.status as SupportTicket["status"],
        contact_phone: (updated.contact_phone as string) || null,
        resolution_notes: (updated.resolution_notes as string) || null,
        assigned_to: (updated.assigned_to as string) || null,
        customer_name: cust?.name || "Subscriber",
        pppoe_username: cust?.pppoe_username || "N/A",
        created_at: (updated.created_at as string) || new Date().toISOString(),
        updated_at: (updated.updated_at as string) || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn("Could not update ticket in Supabase:", err);
  }

  // Update operational cache
  if (globalThis.__spectra_tickets_cache) {
    globalThis.__spectra_tickets_cache = globalThis.__spectra_tickets_cache.map((t) => {
      if (t.id === payload.ticket_id) {
        const item: SupportTicket = {
          ...t,
          status: payload.status || t.status,
          priority: payload.priority || t.priority,
          resolution_notes:
            payload.resolution_notes !== undefined ? payload.resolution_notes : t.resolution_notes,
          assigned_to: payload.assigned_to !== undefined ? payload.assigned_to : t.assigned_to,
          updated_at: new Date().toISOString(),
        };
        if (!updatedTicket) updatedTicket = item;
        return item;
      }
      return t;
    });
  }

  return updatedTicket;
}

/**
 * Fetches all speed test records (optionally filtered by customer) with customer names
 */
export async function getDbSpeedTests(customerId?: string): Promise<SpeedTestRecord[]> {
  const supabase = getAdminSupabase();

  try {
    let query = supabase
      .from("speed_tests")
      .select("*, customers(name, pppoe_username)")
      .order("created_at", { ascending: false });

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      const records: SpeedTestRecord[] = data.map((item) => {
        const cust = item.customers as { name?: string; pppoe_username?: string } | null;
        return {
          id: String(item.id),
          customer_id: String(item.customer_id),
          pppoe_username: cust?.pppoe_username || String(item.pppoe_username),
          customer_name: cust?.name || "Subscriber",
          download_mbps: Number(item.download_mbps),
          upload_mbps: Number(item.upload_mbps),
          ping_ms: Number(item.ping_ms),
          jitter_ms: Number(item.jitter_ms),
          server_name: String(item.server_name),
          server_location: (item.server_location as string) || null,
          client_ip: (item.client_ip as string) || null,
          isp_name: String(item.isp_name || "Spectra Fiber"),
          grade: (item.grade as SpeedTestRecord["grade"]) || "A+",
          engine: String(item.engine || "cloudflare"),
          created_at: String(item.created_at || new Date().toISOString()),
        };
      });

      // Sync with memory cache
      globalThis.__spectra_speed_tests_cache = records;
      return records;
    }
  } catch (err) {
    console.warn("Could not query speed_tests from Supabase:", err);
  }

  // Fallback to operational cache
  const cache = globalThis.__spectra_speed_tests_cache || [];
  if (customerId) {
    return cache.filter((t) => t.customer_id === customerId);
  }
  return cache;
}

/**
 * Fetches all usage sessions across all subscribers (or filtered by customer)
 */
export async function getDbUsageSessions(customerId?: string, limit = 300): Promise<UsageSessionRecord[]> {
  const supabase = getAdminSupabase();

  try {
    let query = supabase
      .from("usage_sessions")
      .select("*, customers(name, pppoe_username)")
      .order("session_ended_at", { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      return data.map((item) => {
        const cust = item.customers as { name?: string; pppoe_username?: string } | null;
        const downBytes = Number(item.download_bytes || 0);
        const upBytes = Number(item.upload_bytes || 0);
        const totBytes = Number(item.total_bytes) || downBytes + upBytes;

        return {
          id: String(item.id),
          customer_id: String(item.customer_id),
          pppoe_username: cust?.pppoe_username || String(item.pppoe_username || "N/A"),
          customer_name: cust?.name || "Subscriber",
          session_started_at: String(item.session_started_at),
          session_ended_at: item.session_ended_at ? String(item.session_ended_at) : null,
          download_bytes: downBytes,
          upload_bytes: upBytes,
          total_bytes: totBytes,
          created_at: item.created_at ? String(item.created_at) : undefined,
        };
      });
    }
  } catch (err) {
    console.warn("Could not fetch usage_sessions:", err);
  }

  return [];
}

/**
 * Creates and persists a speed test record in the database
 */
export async function createDbSpeedTest(payload: {
  customer_id: string;
  pppoe_username: string;
  download_mbps: number;
  upload_mbps: number;
  ping_ms: number;
  jitter_ms: number;
  server_name: string;
  server_location?: string | null;
  client_ip?: string | null;
  isp_name?: string;
  grade: SpeedTestRecord["grade"];
  engine?: string;
}): Promise<SpeedTestRecord> {
  const supabase = getAdminSupabase();

  let savedRecord: SpeedTestRecord = {
    id: `st-${Date.now()}`,
    customer_id: payload.customer_id,
    pppoe_username: payload.pppoe_username,
    download_mbps: payload.download_mbps,
    upload_mbps: payload.upload_mbps,
    ping_ms: payload.ping_ms,
    jitter_ms: payload.jitter_ms,
    server_name: payload.server_name,
    server_location: payload.server_location || null,
    client_ip: payload.client_ip || null,
    isp_name: payload.isp_name || "Spectra Fiber",
    grade: payload.grade,
    engine: payload.engine || "cloudflare",
    created_at: new Date().toISOString(),
  };

  try {
    const { data: inserted, error } = await supabase
      .from("speed_tests")
      .insert({
        customer_id: payload.customer_id,
        pppoe_username: payload.pppoe_username,
        download_mbps: payload.download_mbps,
        upload_mbps: payload.upload_mbps,
        ping_ms: payload.ping_ms,
        jitter_ms: payload.jitter_ms,
        server_name: payload.server_name,
        server_location: payload.server_location || null,
        client_ip: payload.client_ip || null,
        isp_name: payload.isp_name || "Spectra Fiber",
        grade: payload.grade,
        engine: payload.engine || "cloudflare",
      })
      .select()
      .single();

    if (!error && inserted) {
      savedRecord = {
        id: String(inserted.id),
        customer_id: String(inserted.customer_id),
        pppoe_username: String(inserted.pppoe_username),
        download_mbps: Number(inserted.download_mbps),
        upload_mbps: Number(inserted.upload_mbps),
        ping_ms: Number(inserted.ping_ms),
        jitter_ms: Number(inserted.jitter_ms),
        server_name: String(inserted.server_name),
        server_location: (inserted.server_location as string) || null,
        client_ip: (inserted.client_ip as string) || null,
        isp_name: String(inserted.isp_name || "Spectra Fiber"),
        grade: (inserted.grade as SpeedTestRecord["grade"]) || "A+",
        engine: String(inserted.engine || "cloudflare"),
        created_at: (inserted.created_at as string) || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn("Could not insert speed_test into Supabase:", err);
  }

  // Update operational cache
  const currentCache = globalThis.__spectra_speed_tests_cache || [];
  globalThis.__spectra_speed_tests_cache = [savedRecord, ...currentCache.filter((t) => t.id !== savedRecord.id)];

  return savedRecord;
}

/**
 * Record a real-time online / offline status event for a customer
 */
export async function recordDbCustomerStatus(payload: {
  customer_id: string;
  pppoe_username: string;
  status: CustomerOnlineStatus;
  event_time?: string;
  telegram_chat_id?: number | null;
  telegram_message_id?: number | null;
}): Promise<CustomerStatusRecord> {
  const supabase = getAdminSupabase();
  const eventTime = payload.event_time || new Date().toISOString();

  let savedRecord: CustomerStatusRecord = {
    id: `status-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customer_id: payload.customer_id,
    pppoe_username: payload.pppoe_username,
    status: payload.status,
    event_time: eventTime,
    telegram_chat_id: payload.telegram_chat_id || null,
    telegram_message_id: payload.telegram_message_id || null,
    created_at: new Date().toISOString(),
  };

  try {
    const { data: inserted, error } = await supabase
      .from("customer_status_logs")
      .insert({
        customer_id: payload.customer_id,
        pppoe_username: payload.pppoe_username,
        status: payload.status,
        event_time: eventTime,
        telegram_chat_id: payload.telegram_chat_id || null,
        telegram_message_id: payload.telegram_message_id || null,
      })
      .select()
      .single();

    if (!error && inserted) {
      savedRecord = {
        id: String(inserted.id),
        customer_id: String(inserted.customer_id),
        pppoe_username: String(inserted.pppoe_username),
        status: inserted.status as CustomerOnlineStatus,
        event_time: String(inserted.event_time || eventTime),
        telegram_chat_id: (inserted.telegram_chat_id as number) || null,
        telegram_message_id: (inserted.telegram_message_id as number) || null,
        created_at: String(inserted.created_at || new Date().toISOString()),
      };
    }
  } catch (err) {
    console.warn("Could not insert customer_status_log into Supabase:", err);
  }

  // Update shared persistent store & in-memory cache
  savePresenceEntry({
    customer_id: payload.customer_id,
    pppoe_username: payload.pppoe_username,
    is_online: payload.status === "ONLINE",
    status: payload.status,
    last_status_change_at: eventTime,
    telegram_chat_id: payload.telegram_chat_id,
    telegram_message_id: payload.telegram_message_id,
    updated_at: new Date().toISOString(),
  });
  appendStatusLog(savedRecord);

  if (!globalThis.__spectra_presence_map) globalThis.__spectra_presence_map = {};
  globalThis.__spectra_presence_map[payload.customer_id] = {
    is_online: payload.status === "ONLINE",
    last_status_change_at: eventTime,
    status: payload.status,
  };

  const currentLogs = globalThis.__spectra_status_logs_cache || [];
  globalThis.__spectra_status_logs_cache = [savedRecord, ...currentLogs];

  return savedRecord;
}

/**
 * Fetch status presence logs across subscribers or for a single subscriber
 */
export async function getDbCustomerStatusLogs(
  customerId?: string,
  limit = 100
): Promise<CustomerStatusRecord[]> {
  const supabase = getAdminSupabase();

  try {
    let query = supabase
      .from("customer_status_logs")
      .select("*, customers(name, pppoe_username)")
      .order("event_time", { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      return data.map((row) => ({
        id: String(row.id),
        customer_id: String(row.customer_id),
        customer_name: (row.customers as { name?: string })?.name || undefined,
        pppoe_username: String(row.pppoe_username),
        status: row.status as CustomerOnlineStatus,
        event_time: String(row.event_time),
        telegram_chat_id: (row.telegram_chat_id as number) || null,
        telegram_message_id: (row.telegram_message_id as number) || null,
        created_at: String(row.created_at),
      }));
    }
  } catch (err) {
    console.warn("Error querying customer_status_logs from Supabase:", err);
  }

  // Fallback to shared presence store and in-memory cache
  const storedLogs = getStoredStatusLogs(customerId, limit);
  if (storedLogs.length > 0) return storedLogs;

  let logs = globalThis.__spectra_status_logs_cache || [];
  if (customerId) {
    logs = logs.filter((l) => l.customer_id === customerId);
  }
  return logs.slice(0, limit);
}

/**
 * Admin action to assign or customize a subscriber's fiber plan
 */
export async function updateCustomerPlan(
  customerId: string,
  pppoeUsername: string | undefined,
  planPayload: CustomerPlan
): Promise<{ success: boolean; plan: CustomerPlan }> {
  return setCustomerPlan(customerId, pppoeUsername, planPayload);
}

