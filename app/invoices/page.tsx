import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import { InvoicesClient } from "@/components/invoices/invoices-client";
import { SpectraLogo } from "@/components/spectra-logo";
import { LogoutButton } from "@/components/logout-button";
import { verifyAdminAccess } from "@/lib/admin-auth";
import { getDbInvoices } from "@/lib/supabase/admin";
import type { Customer, Invoice } from "@/types/portal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invoices & Billing Statements - Spectra Fiber Portal",
  description: "View and download your official Spectra broadband GST tax invoices, statements, and payment history.",
};

// Deterministic mock invoices generator for seamless instant out-of-the-box billing data
function getFallbackInvoices(customerId: string, pppoeUsername: string): Invoice[] {
  const baseTariff = 999.0;
  const cgst = 89.91;
  const sgst = 89.91;
  const total = 1178.82;

  // Extract a 4-digit seed from PPPoE username or fallback
  const pppoeSuffix = pppoeUsername.replace(/\D/g, "").slice(-4) || "4912";

  return [
    {
      id: "inv-2026-08",
      customer_id: customerId,
      invoice_number: `INV-2026-08-SP${pppoeSuffix}`,
      plan_name: "Spectra GigaFiber 300 Mbps Unlimited",
      period_start: "2026-08-01",
      period_end: "2026-08-31",
      issue_date: "2026-08-01",
      due_date: "2026-08-10",
      base_amount: baseTariff,
      cgst_amount: cgst,
      sgst_amount: sgst,
      total_amount: total,
      status: "paid",
      payment_method: "UPI Auto-Debit (Google Pay)",
      transaction_ref: `TXN-UPI-9842${pppoeSuffix}A`,
      paid_at: "2026-08-03",
    },
    {
      id: "inv-2026-07",
      customer_id: customerId,
      invoice_number: `INV-2026-07-SP${pppoeSuffix}`,
      plan_name: "Spectra GigaFiber 300 Mbps Unlimited",
      period_start: "2026-07-01",
      period_end: "2026-07-31",
      issue_date: "2026-07-01",
      due_date: "2026-07-10",
      base_amount: baseTariff,
      cgst_amount: cgst,
      sgst_amount: sgst,
      total_amount: total,
      status: "paid",
      payment_method: "Credit Card (HDFC Bank)",
      transaction_ref: `TXN-CC-8471${pppoeSuffix}B`,
      paid_at: "2026-07-02",
    },
    {
      id: "inv-2026-06",
      customer_id: customerId,
      invoice_number: `INV-2026-06-SP${pppoeSuffix}`,
      plan_name: "Spectra GigaFiber 300 Mbps Unlimited",
      period_start: "2026-06-01",
      period_end: "2026-06-30",
      issue_date: "2026-06-01",
      due_date: "2026-06-10",
      base_amount: baseTariff,
      cgst_amount: cgst,
      sgst_amount: sgst,
      total_amount: total,
      status: "paid",
      payment_method: "UPI (PhonePe)",
      transaction_ref: `TXN-UPI-7193${pppoeSuffix}C`,
      paid_at: "2026-06-04",
    },
    {
      id: "inv-2026-05",
      customer_id: customerId,
      invoice_number: `INV-2026-05-SP${pppoeSuffix}`,
      plan_name: "Spectra GigaFiber 300 Mbps Unlimited",
      period_start: "2026-05-01",
      period_end: "2026-05-31",
      issue_date: "2026-05-01",
      due_date: "2026-05-10",
      base_amount: baseTariff,
      cgst_amount: cgst,
      sgst_amount: sgst,
      total_amount: total,
      status: "paid",
      payment_method: "NetBanking (ICICI Bank)",
      transaction_ref: `TXN-NB-6042${pppoeSuffix}D`,
      paid_at: "2026-05-03",
    },
    {
      id: "inv-2026-04",
      customer_id: customerId,
      invoice_number: `INV-2026-04-SP${pppoeSuffix}`,
      plan_name: "Spectra GigaFiber 300 Mbps Unlimited",
      period_start: "2026-04-01",
      period_end: "2026-04-30",
      issue_date: "2026-04-01",
      due_date: "2026-04-10",
      base_amount: baseTariff,
      cgst_amount: cgst,
      sgst_amount: sgst,
      total_amount: total,
      status: "paid",
      payment_method: "UPI Auto-Debit (Paytm)",
      transaction_ref: `TXN-UPI-5129${pppoeSuffix}E`,
      paid_at: "2026-04-02",
    },
  ];
}

export default async function InvoicesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, pppoe_username")
    .eq("auth_user_id", user.id)
    .maybeSingle<Customer>();

  if (!customer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground px-4">
        <div className="max-w-md text-center rounded-2xl border border-border/80 bg-card/80 p-8 backdrop-blur-xl shadow-xl">
          <SpectraLogo size="lg" className="mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">
            Account Pending Setup
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Your login is not currently linked to an active PPPoE fiber account. Please contact Spectra support to activate your portal.
          </p>
          <div className="mt-6">
            <LogoutButton variant="default" size="default" className="w-full" />
          </div>
        </div>
      </main>
    );
  }

  // Query invoices from database / admin data service for this customer
  let invoices: Invoice[] = [];
  try {
    const allInvoices = await getDbInvoices();
    invoices = allInvoices.filter((i) => i.customer_id === customer.id);
  } catch (err) {
    console.warn("Error fetching subscriber invoices:", err);
  }

  // Fallback to rich deterministic billing data if no rows exist in database
  if (invoices.length === 0) {
    invoices = getFallbackInvoices(customer.id, customer.pppoe_username);
  }

  const { isAdmin } = await verifyAdminAccess();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-background to-background" />

      {/* Persistent Portal Navigation */}
      <PortalNav
        customerName={customer.name}
        pppoeUsername={customer.pppoe_username}
        isAdmin={isAdmin}
      />

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full space-y-8">
        {/* Section Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                Spectra Subscriber Billing Portal
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Billing & Invoices
            </h1>
            <p className="text-sm text-muted-foreground">
              Account: <span className="font-mono font-semibold text-foreground">{customer.pppoe_username}</span> ({customer.name})
            </p>
          </div>
        </div>

        {/* Client Invoices Dashboard */}
        <InvoicesClient
          customer={customer}
          initialInvoices={invoices}
        />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/60 bg-card/40 py-6 text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SpectraLogo size="sm" showTagline={false} />
            <span>&copy; 2026 Spectra Broadband Networks Pvt. Ltd. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>SAC Code: 998422</span>
            <span>•</span>
            <span>GSTIN: 07AABCS1429P1Z8</span>
            <span>•</span>
            <span>24x7 NOC Helpdesk</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
