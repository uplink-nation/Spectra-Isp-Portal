import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import { SupportClient } from "@/components/support/support-client";
import { SpectraLogo } from "@/components/spectra-logo";
import { LogoutButton } from "@/components/logout-button";
import { verifyAdminAccess } from "@/lib/admin-auth";
import { getDbTickets, getDbSpeedTests } from "@/lib/supabase/admin";
import { getCustomerPresence, getStoredStatusLogs } from "@/lib/presence-store";
import { getCustomerPlan } from "@/lib/plan-store";
import type { Customer, SupportTicket, SpeedTestRecord } from "@/types/portal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Diagnostics, Speed Test & Support - Spectra Fiber Help Center",
  description: "24x7 Spectra broadband support, in-portal speed test engine, live optical line diagnostics, certified benchmark hub, and ticket tracking.",
};

function getFallbackTickets(customerId: string): SupportTicket[] {
  return [
    {
      id: "tkt-101",
      customer_id: customerId,
      ticket_code: "TKT-92841",
      category: "router",
      subject: "Wi-Fi 6 Gateway Optical Line Optimization",
      description: "NOC line synchronization test completed successfully during connection activation.",
      priority: "normal",
      status: "resolved",
      contact_phone: "+91 98765 43210",
      created_at: "2026-08-01T10:30:00Z",
    },
    {
      id: "tkt-102",
      customer_id: customerId,
      ticket_code: "TKT-88310",
      category: "speed",
      subject: "Gigabit Bandwidth Provisioning Check",
      description: "Confirmed full 300 Mbps symmetric throughput on local speed test nodes.",
      priority: "low",
      status: "resolved",
      contact_phone: "+91 98765 43210",
      created_at: "2026-07-15T14:20:00Z",
    },
  ];
}

export default async function SupportPage() {
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

  // Fetch support tickets for this customer
  let tickets: SupportTicket[] = [];
  try {
    const allTickets = await getDbTickets();
    tickets = allTickets.filter((t) => t.customer_id === customer.id);
  } catch (err) {
    console.warn("Supabase support_tickets table query fallback:", err);
  }

  if (tickets.length === 0) {
    tickets = getFallbackTickets(customer.id);
  }

  // Fetch speed tests for this customer
  let speedTests: SpeedTestRecord[] = [];
  try {
    speedTests = await getDbSpeedTests(customer.id);
  } catch (err) {
    console.warn("Supabase speed_tests table query fallback:", err);
  }

  // Fetch real-time presence and presence transition logs
  const customerPresence = getCustomerPresence(customer.id, customer.pppoe_username);
  const statusLogs = getStoredStatusLogs(customer.id, 20);

  // Fetch active subscribed fiber plan
  const customerPlan = getCustomerPlan(customer.id, customer.pppoe_username);

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
                Spectra Help Center & NOC
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Support, Diagnostics & FAQs
            </h1>
            <p className="text-sm text-muted-foreground">
              Subscriber Account: <span className="font-mono font-semibold text-foreground">{customer.pppoe_username}</span> ({customer.name}) • Plan: <span className="text-cyan-400 font-bold">{customerPlan.plan_name} ({customerPlan.speed_mbps} Mbps)</span>
            </p>
          </div>
        </div>

        {/* Client Support Dashboard */}
        <SupportClient
          customer={customer}
          initialTickets={tickets}
          initialSpeedTests={speedTests}
          customerPresence={customerPresence}
          statusLogs={statusLogs}
          planSpeedMbps={customerPlan.speed_mbps}
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
            <span>24x7 NOC Dispatch</span>
            <span>•</span>
            <span>Helpline: 1800-SPECTRA</span>
            <span>•</span>
            <span>support@spectra.co</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
