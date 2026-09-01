import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { SpectraLogo } from "@/components/spectra-logo";
import { UsageCharts } from "@/components/usage-charts";
import { SubscriberSessionLog } from "@/components/subscriber-session-log";
import { PortalNav } from "@/components/portal-nav";
import { verifyAdminAccess } from "@/lib/admin-auth";
import { getCustomerPresence } from "@/lib/presence-store";
import { getCustomerPlan } from "@/lib/plan-store";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  type LucideIcon,
  Zap,
  Calendar,
  Clock,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// ==================================================
// TYPES
// ==================================================

type UsageSession = {
  id: string | number;
  session_started_at: string | null;
  session_ended_at: string | null;
  download_bytes: number | string | null;
  upload_bytes: number | string | null;
  total_bytes: number | string | null;
};

type Customer = {
  id: string;
  name: string;
  pppoe_username: string;
  plan_id?: string | null;
  plan_name?: string | null;
  plan_speed_mbps?: number | null;
  plan_upload_mbps?: number | null;
  plan_price_inr?: number | null;
  plan_data_limit_gb?: number | null;
  plan_renewal_date?: string | null;
  is_online?: boolean | null;
  last_status_change_at?: string | null;
};

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
};


// ==================================================
// DATABASE ERROR
// ==================================================

function getDatabaseErrorMessage(
  error: DatabaseError
) {
  if (error.code === "PGRST205") {
    return "The expected table was not found in Supabase. Run supabase/schema.sql in the Supabase SQL editor, then reload the API schema.";
  }

  return (
    error.message ??
    "Supabase returned an unknown database error."
  );
}


// ==================================================
// FORMAT BYTES
// ==================================================

function formatBytes(bytes: number) {

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(2)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(2)} MB`;
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(2)} GB`;
}


// ==================================================
// CONVERT DATABASE VALUE TO NUMBER
// ==================================================

function toBytes(
  value: number | string | null
) {

  const bytes =
    Number(value);

  return Number.isFinite(bytes)
    ? bytes
    : 0;
}


// ==================================================
// DATABASE ERROR SCREEN
// ==================================================

function DatabaseErrorScreen({
  error,
}: {
  error: DatabaseError;
}) {

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-xl rounded-2xl border border-destructive/30 bg-card/85 backdrop-blur-xl p-8 shadow-2xl spectra-glow text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </div>
        <p className="text-xs font-bold tracking-wider uppercase text-destructive">
          Database Configuration Required
        </p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Usage Data Unavailable
        </h1>

        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {getDatabaseErrorMessage(error)}
        </p>

        {error.details ? (
          <div className="mt-4 rounded-xl border border-border/60 bg-muted/50 p-3 text-xs font-mono text-muted-foreground">
            {error.details}
          </div>
        ) : null}
      </div>
    </main>
  );
}


// ==================================================
// HOME
// ==================================================

export default async function Home() {

  const supabase =
    await createClient();


  // ==================================================
  // LOGGED-IN USER
  // ==================================================

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();


  if (!user) {
    redirect("/auth/login");
  }

  const { isAdmin } = await verifyAdminAccess();


  // ==================================================
  // CUSTOMER
  // ==================================================

  let customer: Customer | null = null;
  let customerError: DatabaseError | null = null;

  const initialCustQuery = await supabase
    .from("customers")
    .select(
      "id, name, pppoe_username, plan_id, plan_name, plan_speed_mbps, plan_upload_mbps, plan_price_inr, plan_data_limit_gb, plan_renewal_date, is_online, last_status_change_at"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle<Customer>();

  if (initialCustQuery.error) {
    // If extended columns don't exist yet in Supabase, fallback to base columns
    const fallbackCustQuery = await supabase
      .from("customers")
      .select("id, name, pppoe_username")
      .eq("auth_user_id", user.id)
      .maybeSingle<Customer>();

    if (fallbackCustQuery.error) {
      return <DatabaseErrorScreen error={fallbackCustQuery.error} />;
    }
    customer = fallbackCustQuery.data;
  } else {
    customer = initialCustQuery.data;
  }

  // Get real-time connection presence status for this subscriber from Supabase & presence store
  let dbStatusIsOnline: boolean | undefined = customer?.is_online ?? undefined;
  let dbLastStatusChangeAt: string | undefined = customer?.last_status_change_at ?? undefined;

  if (customer) {
    try {
      const { data: latestLog } = await supabase
        .from("customer_status_logs")
        .select("status, event_time")
        .eq("customer_id", customer.id)
        .order("event_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestLog) {
        dbStatusIsOnline = latestLog.status === "ONLINE";
        dbLastStatusChangeAt = (latestLog.event_time as string) || dbLastStatusChangeAt;
      }
    } catch {
      // Ignore if table not yet created
    }
  }

  const presence = customer
    ? getCustomerPresence(customer.id, customer.pppoe_username, {
        is_online: dbStatusIsOnline,
        last_status_change_at: dbLastStatusChangeAt,
      })
    : null;
  const isOnline = dbStatusIsOnline ?? (presence ? presence.is_online : false);
  const lastStatusChange = dbLastStatusChangeAt || presence?.last_status_change_at;

  // Get active subscribed fiber plan & SLA metrics
  const plan = customer
    ? getCustomerPlan(customer.id, customer.pppoe_username, {
        plan_id: customer.plan_id ?? undefined,
        plan_name: customer.plan_name ?? undefined,
        speed_mbps: customer.plan_speed_mbps ?? undefined,
        upload_speed_mbps: customer.plan_upload_mbps ?? undefined,
        price_inr: customer.plan_price_inr ?? undefined,
        data_limit_gb: customer.plan_data_limit_gb ?? undefined,
        renewal_date: customer.plan_renewal_date ?? undefined,
      })
    : null;


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


  // ==================================================
  // GET LATEST SESSIONS
  //
  // IMPORTANT:
  // No current-month filter here.
  //
  // This guarantees that the latest session appears
  // even if timezone conversion crosses a month boundary.
  // ==================================================

  const {
    data: sessions,
    error: sessionsError,
  } =
    await supabase
      .from("usage_sessions")
      .select(
        `
        id,
        session_started_at,
        session_ended_at,
        download_bytes,
        upload_bytes,
        total_bytes
        `
      )
      .eq(
        "customer_id",
        customer.id
      )
      .order(
        "session_ended_at",
        {
          ascending: false,
        }
      )
      .limit(100);


  if (sessionsError) {

    return (
      <DatabaseErrorScreen
        error={sessionsError}
      />
    );
  }


  const usageSessions:
    UsageSession[] =
    sessions ?? [];


  // ==================================================
  // CURRENT MONTH
  //
  // Calculate current-month totals in IST.
  // ==================================================

  const now =
    new Date();


  const currentYear =
    Number(
      new Intl.DateTimeFormat(
        "en-IN",
        {
          timeZone:
            "Asia/Kolkata",
          year: "numeric",
        }
      ).format(now)
    );


  const currentMonth =
    Number(
      new Intl.DateTimeFormat(
        "en-IN",
        {
          timeZone:
            "Asia/Kolkata",
          month: "numeric",
        }
      ).format(now)
    );


  // ==================================================
  // FILTER CURRENT MONTH IN IST
  // ==================================================

  const currentMonthSessions =
    usageSessions.filter(
      (session) => {

        if (
          !session.session_ended_at
        ) {
          return false;
        }

        const parts =
          new Intl.DateTimeFormat(
            "en-IN",
            {
              timeZone:
                "Asia/Kolkata",
              year: "numeric",
              month: "numeric",
            }
          ).formatToParts(
            new Date(
              session.session_ended_at
            )
          );

        const year =
          Number(
            parts.find(
              (p) =>
                p.type ===
                "year"
            )?.value
          );

        const month =
          Number(
            parts.find(
              (p) =>
                p.type ===
                "month"
            )?.value
          );

        return (
          year === currentYear &&
          month === currentMonth
        );
      }
    );


  // ==================================================
  // CURRENT MONTH TOTALS
  // ==================================================

  const downloadBytes =
    currentMonthSessions.reduce(
      (
        total,
        session
      ) =>
        total +
        toBytes(
          session.download_bytes
        ),
      0
    );


  const uploadBytes =
    currentMonthSessions.reduce(
      (
        total,
        session
      ) =>
        total +
        toBytes(
          session.upload_bytes
        ),
      0
    );


  const totalBytes =
    currentMonthSessions.reduce(
      (
        total,
        session
      ) => {

        const storedTotal =
          toBytes(
            session.total_bytes
          );

        if (
          storedTotal > 0
        ) {
          return (
            total +
            storedTotal
          );
        }

        return (
          total +
          toBytes(
            session.download_bytes
          ) +
          toBytes(
            session.upload_bytes
          )
        );
      },
      0
    );


  // ==================================================
  // MONTH NAME
  // ==================================================

  const monthName =
    new Intl.DateTimeFormat(
      "en-IN",
      {
        timeZone:
          "Asia/Kolkata",
        month: "long",
        year: "numeric",
      }
    ).format(now);


  // ==================================================
  // PAGE
  // ==================================================

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-background to-background" />

      {/* Persistent Portal Navigation */}
      <PortalNav
        customerName={customer.name}
        pppoeUsername={customer.pppoe_username}
        isAdmin={isAdmin}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full">


        {/* SPECTRA BRANDED HEADER */}

        <header className="mb-8 overflow-hidden rounded-2xl border border-border/80 bg-card/85 backdrop-blur-xl shadow-xl spectra-glow transition-all">

          {/* Top brand accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600" />

          <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <SpectraLogo size="md" />

                {isOnline ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>BROADBAND LINK ONLINE • ACTIVE</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <span className="size-2 rounded-full bg-rose-500" />
                    <span>BROADBAND LINK OFFLINE • DISCONNECTED</span>
                  </div>
                )}
              </div>

              <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Welcome, {customer.name}
              </h1>
            </div>

            <div className="flex items-center">
              <div className="w-full sm:w-auto rounded-xl border border-border/80 bg-background/60 px-4 py-2.5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  PPPoE Subscriber Account
                </p>
                <p className="text-xs sm:text-sm font-semibold font-mono text-cyan-600 dark:text-cyan-400 truncate">
                  {customer.pppoe_username}
                </p>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 divide-x-0 sm:divide-x border-t border-border/60">

            <HeaderStat
              label="Billing Period"
              value={monthName}
              icon={Calendar}
            />

            <HeaderStat
              label="Month Sessions"
              value={`${currentMonthSessions.length}`}
              icon={Database}
            />

            <HeaderStat
              label="Latest Records"
              value={`${usageSessions.length}`}
              icon={Clock}
            />

            <HeaderStat
              label="Connection Link"
              value={isOnline ? "🟢 Online" : "🔴 Offline"}
              icon={isOnline ? Wifi : WifiOff}
            />

          </div>

        </header>

        {/* OFFLINE LINK ALERT (If disconnected) */}
        {!isOnline && (
          <div className="mb-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 sm:p-5 text-rose-600 dark:text-rose-400 flex items-start sm:items-center justify-between gap-4 backdrop-blur-xl animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-500 shrink-0">
                <WifiOff className="size-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Fiber Link Reported Disconnected / Offline</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lastStatusChange ? `Last disconnect logged at ${new Date(lastStatusChange).toLocaleTimeString("en-IN")}` : "Router connection is currently not active with the ISP gateway."} If your optical terminal is powered on, run a diagnostic speed test or raise a NOC ticket.
                </p>
              </div>
            </div>
            <a
              href="/support"
              className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-colors whitespace-nowrap shadow-sm"
            >
              Diagnose / NOC Ticket
            </a>
          </div>
        )}


        {/* SUBSCRIBED FIBER PLAN & SPEED SLA CARD */}
        {plan && (
          <section className="mb-8 overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-card/85 to-card/85 p-6 backdrop-blur-xl shadow-xl spectra-glow transition-all">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500 text-slate-950 shadow-sm">
                    Active Subscription
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    24x7 Guaranteed Fiber SLA
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                    <Zap className="size-6 text-cyan-500" />
                    {plan.plan_name}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                    {plan.description || "True symmetric high-speed Gigabit fiber with unlimited bandwidth and zero speed throttling."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                  <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
                    <span className="text-foreground font-bold">₹{plan.price_inr}</span> / month + GST
                  </div>
                  <span className="text-border">•</span>
                  <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
                    <span className="text-foreground font-bold">
                      {plan.data_limit_gb ? `${plan.data_limit_gb} GB FUP` : "Unlimited Data (No FUP)"}
                    </span>
                  </div>
                  {plan.renewal_date && (
                    <>
                      <span className="text-border">•</span>
                      <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
                        Next Renewal: <span className="text-cyan-400 font-bold">{plan.renewal_date}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Speed SLA Gauge Callout */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <div className="rounded-2xl border border-cyan-500/40 bg-background/80 p-4 text-center min-w-[140px]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Bandwidth SLA
                  </p>
                  <p className="text-3xl font-black font-mono tracking-tight text-cyan-500 mt-0.5">
                    {plan.speed_mbps}
                    <span className="text-xs font-bold text-muted-foreground ml-1">Mbps</span>
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-400 mt-0.5">
                    Symmetric Up/Down
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <a
                    href="/support"
                    className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs text-center transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5"
                  >
                    <Activity className="size-3.5" />
                    <span>Test Speed SLA</span>
                  </a>
                  <a
                    href="/invoices"
                    className="px-4 py-2 rounded-xl border border-border/80 bg-background/60 hover:bg-muted text-foreground font-semibold text-xs text-center transition-colors"
                  >
                    View Invoices
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* USAGE CARDS */}

        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">

          <UsageCard
            icon={Activity}
            title="Total Usage"
            value={formatBytes(
              totalBytes
            )}
            description={
              monthName
            }
            accentColor="cyan"
          />


          <UsageCard
            icon={ArrowDownToLine}
            title="Download Usage"
            value={formatBytes(
              downloadBytes
            )}
            description={
              monthName
            }
            accentColor="blue"
          />


          <UsageCard
            icon={ArrowUpFromLine}
            title="Upload Usage"
            value={formatBytes(
              uploadBytes
            )}
            description={
              monthName
            }
            accentColor="indigo"
          />

        </section>


        {/* USAGE ANALYTICS & CHARTS */}

        <section className="mt-8">
          <UsageCharts
            sessions={usageSessions}
            monthName={monthName}
          />
        </section>


        {/* USAGE OVERVIEW */}

        <section className="mt-8 rounded-2xl border border-border/80 bg-card/85 p-6 sm:p-8 backdrop-blur-xl shadow-xl spectra-glow">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <div className="flex items-center gap-2">
                <Zap className="size-5 text-cyan-500" />
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Usage Breakdown
                </h2>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Data consumption analytics for{" "}
                <span className="font-semibold text-foreground">{monthName}</span>
              </p>

            </div>


            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 shadow-sm">

              <Database
                aria-hidden="true"
                className="size-4"
              />
              {currentMonthSessions.length}{" "}
              recorded sessions

            </div>

          </div>


          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">

            <UsageBreakdown
              label="Download Share"
              value={totalBytes > 0 ? Math.round((downloadBytes / totalBytes) * 100) : 0}
              barColor="from-cyan-500 to-blue-500"
            />

            <UsageBreakdown
              label="Upload Share"
              value={totalBytes > 0 ? Math.round((uploadBytes / totalBytes) * 100) : 0}
              barColor="from-indigo-500 to-purple-500"
            />

            <UsageBreakdown
              label="Average Session Size"
              value={currentMonthSessions.length > 0 ? Math.round(totalBytes / currentMonthSessions.length / (1024 * 1024)) : 0}
              suffix=" MB"
              barColor="from-emerald-500 to-cyan-500"
            />

          </div>


        </section>


        {/* RECENT SESSIONS WITH MONTH-WISE FILTER */}
        <div className="mt-8">
          <SubscriberSessionLog
            sessions={usageSessions}
            customerName={customer.name}
            pppoeUsername={customer.pppoe_username}
            defaultMonthName={monthName}
          />
        </div>

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
            <span>24x7 NOC Helpdesk: 1800-SPECTRA</span>
            <span>•</span>
            <span>support@spectra.co</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


// ==================================================
// HEADER STAT
// ==================================================

function HeaderStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
}) {

  return (

    <div className="bg-card/40 px-5 py-4 backdrop-blur-sm">

      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-3.5 text-cyan-500" />}
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>

      <p className="mt-1 text-base font-bold text-foreground">
        {value}
      </p>

    </div>
  );
}


// ==================================================
// USAGE BREAKDOWN
// ==================================================

function UsageBreakdown({
  label,
  value,
  suffix = "%",
  barColor = "from-cyan-500 to-blue-500",
}: {
  label: string;
  value: number;
  suffix?: string;
  barColor?: string;
}) {

  return (

    <div className="rounded-xl border border-border/70 bg-background/50 p-4 shadow-sm">

      <div className="flex items-center justify-between gap-3">

        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>

        <p className="text-base font-bold text-foreground font-mono">
          {value}
          {suffix}
        </p>

      </div>

      {suffix === "%" ? (
        <div className="mt-3 h-2.5 rounded-full bg-border/60 overflow-hidden">

          <div
            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
            style={{
              width: `${Math.min(
                Math.max(value, 0),
                100
              )}%`,
            }}
          />

        </div>
      ) : null}

    </div>
  );
}


// ==================================================
// USAGE CARD
// ==================================================

function UsageCard({
  icon: Icon,
  title,
  value,
  description,
  accentColor = "cyan",
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  description: string;
  accentColor?: "cyan" | "blue" | "indigo";
}) {

  const colorStyles = {
    cyan: "from-cyan-500/10 to-blue-500/5 text-cyan-500 border-cyan-500/20",
    blue: "from-blue-500/10 to-indigo-500/5 text-blue-500 border-blue-500/20",
    indigo: "from-indigo-500/10 to-purple-500/5 text-indigo-500 border-indigo-500/20",
  };

  return (

    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/85 p-6 backdrop-blur-xl shadow-xl spectra-glow transition-all duration-300 hover:scale-[1.01] hover:border-cyan-500/40">

      <div className="flex items-start justify-between gap-4">

        <div className="space-y-2">

          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>

          <p className="text-3xl font-black tracking-tight text-foreground">
            {value}
          </p>

          <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {description}
          </div>

        </div>

        <div className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${colorStyles[accentColor]} border shadow-md transition-transform duration-300`}>
          <Icon
            aria-hidden="true"
            className="size-6"
          />
        </div>

      </div>

    </div>
  );
}
