import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { SpectraLogo } from "@/components/spectra-logo";
import { verifyAdminAccess } from "@/lib/admin-auth";
import {
  getAllDbCustomers,
  getDbInvoices,
  getDbTickets,
  getDbSpeedTests,
  getDbUsageSessions,
  getDbCustomerStatusLogs,
  getSchemaStatus,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Central Admin & NOC Operations - Spectra Fiber Portal",
  description:
    "Centrally manage real subscribers, monitor speedtest & bandwidth telemetry, inspect usage session history, dispatch monthly invoices, and triage live user support tickets.",
};

export default async function AdminPage() {
  // Enforce strict Server-Side Role-Based Access Control
  const { isAdmin, user, customer: currentCustomer } = await verifyAdminAccess();

  if (!user) {
    redirect("/auth/login");
  }

  // If user is not an authorized administrator, immediately redirect to subscriber portal
  if (!isAdmin) {
    redirect("/");
  }

  const operatorName = currentCustomer?.name || "NOC Administrator";
  const operatorUsername = currentCustomer?.pppoe_username || "admin_noc";

  // Fetch real database records in parallel
  const [customers, invoices, tickets, speedTests, usageSessions, statusLogs, schemaStatus] = await Promise.all([
    getAllDbCustomers(),
    getDbInvoices(),
    getDbTickets(),
    getDbSpeedTests(),
    getDbUsageSessions(undefined, 400),
    getDbCustomerStatusLogs(undefined, 200),
    getSchemaStatus(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/10 via-background to-background" />

      {/* Dedicated Admin NOC Top Navigation */}
      <AdminNav
        operatorName={operatorName}
        operatorUsername={operatorUsername}
      />

      {/* Main Admin Command Center */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full space-y-8">
        {/* Admin Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                Spectra NOC & Central Admin Operations
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Central Command Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage database subscribers, monitor live speed tests & usage sessions, dispatch invoices & bills, and triage incoming user support tickets.
            </p>
          </div>
        </div>

        {/* Client Admin Dashboard */}
        <AdminDashboard
          initialCustomers={customers}
          initialInvoices={invoices}
          initialTickets={tickets}
          initialSpeedTests={speedTests}
          initialUsageSessions={usageSessions}
          initialStatusLogs={statusLogs}
          schemaStatus={schemaStatus}
        />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/60 bg-card/40 py-6 text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SpectraLogo size="sm" showTagline={false} />
            <span>&copy; 2026 Spectra Broadband NOC Admin Console. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Database Subscribers: {customers.length} Active</span>
            <span>•</span>
            <span>NOC Telegram Alert Channel: Connected</span>
            <span>•</span>
            <span>Automated Billing Dispatch: Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
