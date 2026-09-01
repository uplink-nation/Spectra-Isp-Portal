"use client";

import { useState, useMemo, useEffect } from "react";
import type {
  Invoice,
  SupportTicket,
  InvoiceStatus,
  TicketPriority,
  TicketStatus,
  TicketCategory,
  SpeedTestRecord,
  UsageSessionRecord,
  CustomerStatusRecord,
  CustomerPlan,
  ISPPlan,
  DbCustomerWithStats,
} from "@/types/portal";
import { DEFAULT_ISP_PLANS } from "@/lib/plan-presets";
import { formatINR, generateInvoicePdf } from "@/components/invoices/invoice-pdf-generator";
import {
  shareSpeedTestToNocWhatsApp,
  downloadSpeedTestPdf,
} from "@/components/support/speedtest-share";
import type { SpeedTestResult } from "@/components/support/speed-test";
import {
  Receipt,
  Headphones,
  Users,
  Send,
  PlusCircle,
  CheckCircle2,
  Search,
  Download,
  Check,
  X,
  MessageSquare,
  Loader2,
  Mail,
  HardDrive,
  RefreshCw,
  UserPlus,
  Gauge,
  Activity,
  Zap,
  BarChart3,
  Calendar,
  Eye,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminDashboardProps {
  initialCustomers: DbCustomerWithStats[];
  initialInvoices: Invoice[];
  initialTickets: SupportTicket[];
  initialSpeedTests?: SpeedTestRecord[];
  initialUsageSessions?: UsageSessionRecord[];
  initialStatusLogs?: CustomerStatusRecord[];
  schemaStatus?: {
    invoicesTableReady: boolean;
    ticketsTableReady: boolean;
    needsSqlSetup: boolean;
  };
}

export function AdminDashboard({
  initialCustomers,
  initialInvoices,
  initialTickets,
  initialSpeedTests = [],
  initialUsageSessions = [],
  initialStatusLogs = [],
}: AdminDashboardProps) {
  const [customers, setCustomers] = useState<DbCustomerWithStats[]>(initialCustomers);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets);
  const [speedTests, setSpeedTests] = useState<SpeedTestRecord[]>(initialSpeedTests);
  const [usageSessions, setUsageSessions] = useState<UsageSessionRecord[]>(initialUsageSessions);
  const [statusLogs, setStatusLogs] = useState<CustomerStatusRecord[]>(initialStatusLogs);

  const [activeTab, setActiveTab] = useState<
    "subscribers" | "plans" | "speedtests" | "usage" | "billing" | "tickets"
  >("subscribers");

  // Plan Editor & Catalog states
  const [editingPlanCustomer, setEditingPlanCustomer] = useState<DbCustomerWithStats | null>(null);
  const [editPlanPresetId, setEditPlanPresetId] = useState<string>("plan-fiber-300");
  const [editPlanName, setEditPlanName] = useState<string>("Spectra GigaFiber 300 Mbps Unlimited");
  const [editPlanSpeed, setEditPlanSpeed] = useState<number>(300);
  const [editPlanUploadSpeed, setEditPlanUploadSpeed] = useState<number>(300);
  const [editPlanPrice, setEditPlanPrice] = useState<number>(999);
  const [editPlanDataLimit, setEditPlanDataLimit] = useState<string>("unlimited");
  const [editPlanRenewalDate, setEditPlanRenewalDate] = useState<string>("");
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planSuccessMsg, setPlanSuccessMsg] = useState<string | null>(null);
  const [planCatalog] = useState<ISPPlan[]>(DEFAULT_ISP_PLANS);

  // Subscribers search & filter
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [subscriberStatusFilter, setSubscriberStatusFilter] = useState<"all" | "online" | "offline">("all");

  // Speedtests filters & search
  const [speedTestSearch, setSpeedTestSearch] = useState("");
  const [speedTestGradeFilter, setSpeedTestGradeFilter] = useState<"all" | "A+" | "A" | "B" | "C">("all");
  const [speedTestCustomerFilter, setSpeedTestCustomerFilter] = useState<string>("all");
  const [speedTestMonthFilter, setSpeedTestMonthFilter] = useState<string>("all");

  // Usage sessions filters & search
  const [usageSearch, setUsageSearch] = useState("");
  const [usageCustomerFilter, setUsageCustomerFilter] = useState<string>("all");
  const [usageMonthFilter, setUsageMonthFilter] = useState<string>("all");

  // Invoices filters & search
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [invoiceCustomerFilter, setInvoiceCustomerFilter] = useState<string>("all");

  // Tickets filters & search
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<"all" | TicketStatus>("all");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<"all" | TicketPriority>("all");
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<"all" | TicketCategory>("all");
  const [ticketCustomerFilter, setTicketCustomerFilter] = useState<string>("all");

  // Modals & Drawers
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSingleInvoiceModal, setShowSingleInvoiceModal] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState<Invoice | null>(null);
  const [selectedTicketToEdit, setSelectedTicketToEdit] = useState<SupportTicket | null>(null);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [inspectSubscriber, setInspectSubscriber] = useState<DbCustomerWithStats | null>(null);
  const [inspectModalSubTab, setInspectModalSubTab] = useState<"speed" | "usage" | "invoices" | "tickets" | "presence">("speed");
  const [inspectSpeedMonthFilter, setInspectSpeedMonthFilter] = useState<string>("all");
  const [inspectUsageMonthFilter, setInspectUsageMonthFilter] = useState<string>("all");

  // Form states: Batch generator
  const [batchMonth, setBatchMonth] = useState("2026-09");
  const [batchPlanName, setBatchPlanName] = useState("Spectra GigaFiber 300 Mbps Unlimited");
  const [batchBaseAmount, setBatchBaseAmount] = useState(999.0);
  const [batchDueDate, setBatchDueDate] = useState("2026-09-10");
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);

  // Form states: Single invoice
  const [singleCustomerId, setSingleCustomerId] = useState(customers[0]?.id || "");
  const [singlePlanName, setSinglePlanName] = useState("Spectra GigaFiber 300 Mbps Unlimited");
  const [singleBaseAmount, setSingleBaseAmount] = useState(999.0);
  const [singlePeriodStart, setSinglePeriodStart] = useState("2026-09-01");
  const [singlePeriodEnd, setSinglePeriodEnd] = useState("2026-09-30");
  const [singleDueDate, setSingleDueDate] = useState("2026-09-10");
  const [singleStatus, setSingleStatus] = useState<"pending" | "paid">("pending");
  const [isCreatingSingle, setIsCreatingSingle] = useState(false);
  const [singleSuccessMsg, setSingleSuccessMsg] = useState<string | null>(null);

  // Form states: Mark paid
  const [paidPaymentMethod, setPaidPaymentMethod] = useState("Cash / Direct Bank Transfer");
  const [paidTransactionRef, setPaidTransactionRef] = useState("");
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // Form states: Ticket note & status edit
  const [editTicketStatus, setEditTicketStatus] = useState<TicketStatus>("in_progress");
  const [editTicketPriority, setEditTicketPriority] = useState<TicketPriority>("normal");
  const [editTicketTechnician, setEditTicketTechnician] = useState("");
  const [editTicketNotes, setEditTicketNotes] = useState("");
  const [isUpdatingTicket, setIsUpdatingTicket] = useState(false);

  // Form states: Create Ticket on behalf of user
  const [newTicketCustomerId, setNewTicketCustomerId] = useState(customers[0]?.id || "");
  const [newTicketCategory, setNewTicketCategory] = useState<TicketCategory>("speed");
  const [newTicketPriority, setNewTicketPriority] = useState<TicketPriority>("normal");
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketDescription, setNewTicketDescription] = useState("");
  const [newTicketPhone, setNewTicketPhone] = useState("");
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);

  // Refresh states
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick action: Download PDF
  const handleDownloadInvoicePdf = (inv: Invoice) => {
    const cust = customers.find((c) => c.id === inv.customer_id) || {
      id: inv.customer_id,
      name: inv.customer_name || "Subscriber",
      pppoe_username: inv.pppoe_username || "N/A",
      email: `${(inv.pppoe_username || "subscriber").toLowerCase()}@spectra.net`,
    };
    generateInvoicePdf({ customer: cust, invoice: inv });
  };

  // Quick action: Open Send Invoice for specific subscriber
  const handleOpenSendInvoiceForCustomer = (customerId: string) => {
    setSingleCustomerId(customerId);
    setShowSingleInvoiceModal(true);
  };

  // Quick action: Open Create Ticket for specific subscriber
  const handleOpenCreateTicketForCustomer = (customerId: string) => {
    setNewTicketCustomerId(customerId);
    setShowCreateTicketModal(true);
  };

  // Quick action: Filter Invoices by customer
  const handleFilterInvoicesByCustomer = (customerId: string) => {
    setInvoiceCustomerFilter(customerId);
    setActiveTab("billing");
  };

  // Quick action: Filter Tickets by customer
  const handleFilterTicketsByCustomer = (customerId: string) => {
    setTicketCustomerFilter(customerId);
    setActiveTab("tickets");
  };

  // Quick action: Filter Speed Tests by customer
  const handleFilterSpeedTestsByCustomer = (customerId: string) => {
    setSpeedTestCustomerFilter(customerId);
    setActiveTab("speedtests");
  };

  // Quick action: Filter Usage Sessions by customer
  const handleFilterUsageByCustomer = (customerId: string) => {
    setUsageCustomerFilter(customerId);
    setActiveTab("usage");
  };

  // Plan Management: Open Edit Plan Modal for subscriber
  const handleOpenEditPlan = (cust: DbCustomerWithStats) => {
    setEditingPlanCustomer(cust);
    setPlanSuccessMsg(null);
    const currentSpeed = cust.plan_speed_mbps || 300;
    const currentName = cust.plan_name || `${currentSpeed} Mbps Symmetric Fiber`;
    const currentPrice = cust.plan_price_inr || 999;
    const currentUpload = cust.plan_upload_mbps || currentSpeed;
    const currentLimit = cust.plan_data_limit_gb ? String(cust.plan_data_limit_gb) : "unlimited";
    const currentRenewal = cust.plan_renewal_date || "";

    setEditPlanName(currentName);
    setEditPlanSpeed(currentSpeed);
    setEditPlanUploadSpeed(currentUpload);
    setEditPlanPrice(currentPrice);
    setEditPlanDataLimit(currentLimit);
    setEditPlanRenewalDate(currentRenewal);

    const matchingPreset = planCatalog.find(
      (p) => p.download_speed_mbps === currentSpeed || p.name === currentName
    );
    if (matchingPreset) {
      setEditPlanPresetId(matchingPreset.id);
    } else {
      setEditPlanPresetId("custom");
    }
  };

  const handleSelectPresetPlan = (preset: ISPPlan) => {
    setEditPlanPresetId(preset.id);
    setEditPlanName(preset.name);
    setEditPlanSpeed(preset.download_speed_mbps);
    setEditPlanUploadSpeed(preset.upload_speed_mbps);
    setEditPlanPrice(preset.price_inr);
    setEditPlanDataLimit(preset.data_limit_gb ? String(preset.data_limit_gb) : "unlimited");
  };

  const handleSavePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlanCustomer) return;
    setIsSavingPlan(true);
    setPlanSuccessMsg(null);

    try {
      const dataLimitGb = editPlanDataLimit === "unlimited" || !editPlanDataLimit ? null : Number(editPlanDataLimit);
      const planPayload: CustomerPlan = {
        plan_id: editPlanPresetId,
        plan_name: editPlanName,
        speed_mbps: Number(editPlanSpeed),
        upload_speed_mbps: Number(editPlanUploadSpeed),
        price_inr: Number(editPlanPrice),
        data_limit_gb: dataLimitGb,
        billing_cycle: "monthly",
        renewal_date: editPlanRenewalDate || undefined,
        description: `${editPlanSpeed} Mbps Symmetric Fiber with 24x7 SLA guarantee`,
      };

      const res = await fetch("/api/admin/customers/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: editingPlanCustomer.id,
          pppoeUsername: editingPlanCustomer.pppoe_username,
          plan: planPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update customer plan");

      // Update customer in local state
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === editingPlanCustomer.id
            ? {
                ...c,
                plan: planPayload,
                plan_name: planPayload.plan_name,
                plan_speed_mbps: planPayload.speed_mbps,
                plan_upload_mbps: planPayload.upload_speed_mbps,
                plan_price_inr: planPayload.price_inr,
                plan_data_limit_gb: planPayload.data_limit_gb,
                plan_renewal_date: planPayload.renewal_date,
              }
            : c
        )
      );

      setPlanSuccessMsg(`Plan updated to "${editPlanName}" (${editPlanSpeed} Mbps) successfully!`);
      setTimeout(() => {
        setEditingPlanCustomer(null);
        setPlanSuccessMsg(null);
      }, 1200);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error updating plan");
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Quick action: Inspect Subscriber
  const handleInspectSubscriber = (cust: DbCustomerWithStats) => {
    setInspectSubscriber(cust);
    setInspectModalSubTab("speed");
  };

  // Refresh all data from server
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      const [uRes, iRes, tRes, sRes, usRes, stRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/invoices"),
        fetch("/api/admin/tickets"),
        fetch("/api/admin/speedtests"),
        fetch("/api/admin/usage"),
        fetch("/api/admin/statuses"),
      ]);

      if (uRes.ok) {
        const uData = await uRes.json();
        if (uData.customers) setCustomers(uData.customers);
      }
      if (iRes.ok) {
        const iData = await iRes.json();
        if (iData.invoices) setInvoices(iData.invoices);
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        if (tData.tickets) setTickets(tData.tickets);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.speedTests) setSpeedTests(sData.speedTests);
      }
      if (usRes.ok) {
        const usData = await usRes.json();
        if (usData.usageSessions) setUsageSessions(usData.usageSessions);
      }
      if (stRes.ok) {
        const stData = await stRes.json();
        if (stData.statusLogs) setStatusLogs(stData.statusLogs);
      }
    } catch (err) {
      console.warn("Error refreshing admin data:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Background live poll every 20 seconds to sync online/offline presence & status logs
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefreshAll();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // Overview metrics calculation
  const metrics = useMemo(() => {
    const totalInvoicesCount = invoices.length;
    const paidInvoices = invoices.filter((i) => i.status === "paid");
    const pendingInvoices = invoices.filter(
      (i) => i.status === "pending" || i.status === "overdue"
    );

    const totalCollected = paidInvoices.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
    const totalOutstanding = pendingInvoices.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);

    const openTickets = tickets.filter((t) => t.status === "open");
    const urgentTickets = tickets.filter(
      (t) => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed"
    );
    const inProgressTickets = tickets.filter((t) => t.status === "in_progress");

    // Speed test stats
    const peakSpeedMbps =
      speedTests.length > 0 ? Math.max(...speedTests.map((s) => s.download_mbps)) : 0;
    const avgPingMs =
      speedTests.length > 0
        ? Math.round(
            (speedTests.reduce((acc, s) => acc + Number(s.ping_ms || 0), 0) / speedTests.length) * 10
          ) / 10
        : 0;

    // Total usage stats
    const totalBytesAll = usageSessions.reduce((acc, s) => acc + Number(s.total_bytes || 0), 0);
    const totalDownloadBytes = usageSessions.reduce((acc, s) => acc + Number(s.download_bytes || 0), 0);
    const totalUploadBytes = usageSessions.reduce((acc, s) => acc + Number(s.upload_bytes || 0), 0);

    return {
      totalSubscribers: customers.length,
      totalInvoicesCount,
      totalCollected,
      totalOutstanding,
      totalTickets: tickets.length,
      openTicketsCount: openTickets.length,
      urgentTicketsCount: urgentTickets.length,
      inProgressTicketsCount: inProgressTickets.length,
      totalSpeedTests: speedTests.length,
      peakSpeedMbps,
      avgPingMs,
      totalUsageBytes: totalBytesAll,
      totalDownloadBytes,
      totalUploadBytes,
      totalSessionsCount: usageSessions.length,
    };
  }, [customers, invoices, tickets, speedTests, usageSessions]);

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return "0 GB";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1000) return `${(gb / 1024).toFixed(2)} TB`;
    return `${gb.toFixed(2)} GB`;
  };

  // Format duration helper
  const formatDuration = (start: string, end: string | null): string => {
    if (!end) return "Active Session";
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diffSec = Math.max(0, Math.floor((e - s) / 1000));
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
  };

  // Extract YYYY-MM helper
  const getYearMonthKey = (ts: string | null | undefined): string => {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return "";
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      return `${year}-${month}`;
    } catch {
      return "";
    }
  };

  // Available distinct months for speed tests (descending)
  const availableSpeedTestMonths = useMemo(() => {
    const monthMap = new Map<string, string>();
    speedTests.forEach((s) => {
      if (!s.created_at) return;
      const key = getYearMonthKey(s.created_at);
      if (key && !monthMap.has(key)) {
        const d = new Date(s.created_at);
        const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
        monthMap.set(key, label);
      }
    });
    return Array.from(monthMap.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [speedTests]);

  // Available distinct months for usage sessions (descending)
  const availableUsageMonths = useMemo(() => {
    const monthMap = new Map<string, string>();
    usageSessions.forEach((s) => {
      const ts = s.session_ended_at || s.session_started_at;
      if (!ts) return;
      const key = getYearMonthKey(ts);
      if (key && !monthMap.has(key)) {
        const d = new Date(ts);
        const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
        monthMap.set(key, label);
      }
    });
    return Array.from(monthMap.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [usageSessions]);

  // Filtered subscribers
  const filteredCustomers = useMemo(() => {
    const query = subscriberSearch.toLowerCase().trim();
    return customers.filter((c) => {
      const matchQuery =
        !query ||
        c.name.toLowerCase().includes(query) ||
        c.pppoe_username.toLowerCase().includes(query) ||
        (c.email && c.email.toLowerCase().includes(query));

      const matchStatus =
        subscriberStatusFilter === "all" ||
        (subscriberStatusFilter === "online" && c.is_online) ||
        (subscriberStatusFilter === "offline" && !c.is_online);

      return matchQuery && matchStatus;
    });
  }, [customers, subscriberSearch, subscriberStatusFilter]);

  // Filtered speed tests
  const filteredSpeedTests = useMemo(() => {
    return speedTests.filter((s) => {
      const matchCustomer =
        speedTestCustomerFilter === "all" || s.customer_id === speedTestCustomerFilter;
      const matchGrade = speedTestGradeFilter === "all" || s.grade === speedTestGradeFilter;
      const matchMonth =
        speedTestMonthFilter === "all" ||
        (s.created_at && getYearMonthKey(s.created_at) === speedTestMonthFilter);
      const query = speedTestSearch.toLowerCase().trim();
      const matchQuery =
        !query ||
        s.pppoe_username.toLowerCase().includes(query) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(query)) ||
        s.server_name.toLowerCase().includes(query) ||
        (s.client_ip && s.client_ip.toLowerCase().includes(query));
      return matchCustomer && matchGrade && matchMonth && matchQuery;
    });
  }, [speedTests, speedTestCustomerFilter, speedTestGradeFilter, speedTestMonthFilter, speedTestSearch]);

  // Filtered usage sessions
  const filteredUsageSessions = useMemo(() => {
    return usageSessions.filter((s) => {
      const matchCustomer =
        usageCustomerFilter === "all" || s.customer_id === usageCustomerFilter;
      const ts = s.session_ended_at || s.session_started_at;
      const matchMonth =
        usageMonthFilter === "all" ||
        (ts && getYearMonthKey(ts) === usageMonthFilter);
      const query = usageSearch.toLowerCase().trim();
      const matchQuery =
        !query ||
        s.pppoe_username.toLowerCase().includes(query) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(query));
      return matchCustomer && matchMonth && matchQuery;
    });
  }, [usageSessions, usageCustomerFilter, usageMonthFilter, usageSearch]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchStatus = invoiceStatusFilter === "all" || inv.status === invoiceStatusFilter;
      const matchCustomer =
        invoiceCustomerFilter === "all" || inv.customer_id === invoiceCustomerFilter;
      const query = invoiceSearch.toLowerCase().trim();
      const matchQuery =
        !query ||
        inv.invoice_number.toLowerCase().includes(query) ||
        (inv.customer_name && inv.customer_name.toLowerCase().includes(query)) ||
        (inv.pppoe_username && inv.pppoe_username.toLowerCase().includes(query)) ||
        inv.plan_name.toLowerCase().includes(query);
      return matchStatus && matchCustomer && matchQuery;
    });
  }, [invoices, invoiceStatusFilter, invoiceCustomerFilter, invoiceSearch]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchStatus = ticketStatusFilter === "all" || t.status === ticketStatusFilter;
      const matchPriority = ticketPriorityFilter === "all" || t.priority === ticketPriorityFilter;
      const matchCategory = ticketCategoryFilter === "all" || t.category === ticketCategoryFilter;
      const matchCustomer =
        ticketCustomerFilter === "all" || t.customer_id === ticketCustomerFilter;
      const query = ticketSearch.toLowerCase().trim();
      const matchQuery =
        !query ||
        t.ticket_code.toLowerCase().includes(query) ||
        t.subject.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        (t.customer_name && t.customer_name.toLowerCase().includes(query)) ||
        (t.pppoe_username && t.pppoe_username.toLowerCase().includes(query));
      return matchStatus && matchPriority && matchCategory && matchCustomer && matchQuery;
    });
  }, [tickets, ticketStatusFilter, ticketPriorityFilter, ticketCategoryFilter, ticketCustomerFilter, ticketSearch]);

  // Handle batch invoice generation for all users
  const handleBatchGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingBatch(true);
    setBatchSuccessMsg(null);

    try {
      const period_start = `${batchMonth}-01`;
      const [year, month] = batchMonth.split("-").map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const period_end = `${batchMonth}-${lastDay.toString().padStart(2, "0")}`;

      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_generate",
          period_start,
          period_end,
          issue_date: period_start,
          due_date: batchDueDate,
          plan_name: batchPlanName,
          base_amount: Number(batchBaseAmount),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate invoices");

      setBatchSuccessMsg(data.message || `Dispatched ${data.generatedCount} invoices successfully.`);
      if (data.invoices) {
        setInvoices((prev) => [...data.invoices, ...prev]);
      }
      setTimeout(() => {
        setShowBatchModal(false);
        setBatchSuccessMsg(null);
        setActiveTab("billing");
      }, 1500);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error generating batch invoices");
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  // Handle creating a single custom invoice
  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingSingle(true);
    setSingleSuccessMsg(null);

    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_single",
          customer_id: singleCustomerId,
          plan_name: singlePlanName,
          period_start: singlePeriodStart,
          period_end: singlePeriodEnd,
          issue_date: singlePeriodStart,
          due_date: singleDueDate,
          base_amount: Number(singleBaseAmount),
          status: singleStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invoice");

      setSingleSuccessMsg("Invoice created and saved into database.");
      if (data.invoice) {
        setInvoices((prev) => [data.invoice, ...prev]);
      }
      setTimeout(() => {
        setShowSingleInvoiceModal(false);
        setSingleSuccessMsg(null);
        setActiveTab("billing");
      }, 1200);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating invoice");
    } finally {
      setIsCreatingSingle(false);
    }
  };

  // Handle marking invoice as Paid
  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showMarkPaidModal) return;
    setIsMarkingPaid(true);

    try {
      const res = await fetch("/api/admin/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: showMarkPaidModal.id,
          status: "paid",
          payment_method: paidPaymentMethod,
          transaction_ref: paidTransactionRef || `OFFLINE-PAY-${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update invoice");

      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === showMarkPaidModal.id
            ? {
                ...inv,
                status: "paid",
                payment_method: paidPaymentMethod,
                transaction_ref: paidTransactionRef || `OFFLINE-PAY-${Date.now()}`,
                paid_at: new Date().toISOString(),
              }
            : inv
        )
      );

      setShowMarkPaidModal(null);
      setPaidTransactionRef("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error settling invoice");
    } finally {
      setIsMarkingPaid(false);
    }
  };

  // Handle opening ticket edit modal
  const handleOpenTicketEdit = (ticket: SupportTicket) => {
    setSelectedTicketToEdit(ticket);
    setEditTicketStatus(ticket.status);
    setEditTicketPriority(ticket.priority);
    setEditTicketTechnician(ticket.assigned_to || "NOC L2 Engineer");
    setEditTicketNotes(ticket.resolution_notes || "");
  };

  // Handle ticket triage & resolution update
  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketToEdit) return;
    setIsUpdatingTicket(true);

    try {
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: selectedTicketToEdit.id,
          status: editTicketStatus,
          priority: editTicketPriority,
          assigned_to: editTicketTechnician,
          resolution_notes: editTicketNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update ticket");

      setTickets((prev) =>
        prev.map((t) =>
          t.id === selectedTicketToEdit.id
            ? {
                ...t,
                status: editTicketStatus,
                priority: editTicketPriority,
                assigned_to: editTicketTechnician,
                resolution_notes: editTicketNotes,
                updated_at: new Date().toISOString(),
              }
            : t
        )
      );

      setSelectedTicketToEdit(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error updating ticket");
    } finally {
      setIsUpdatingTicket(false);
    }
  };

  // Handle creating ticket on behalf of user
  const handleCreateTicketOnBehalf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || !newTicketDescription.trim()) return;
    setIsCreatingTicket(true);

    try {
      const res = await fetch("/api/admin/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: newTicketCustomerId,
          category: newTicketCategory,
          priority: newTicketPriority,
          subject: newTicketSubject,
          description: newTicketDescription,
          contact_phone: newTicketPhone || "+91 98765 43210",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create ticket");

      if (data.ticket) {
        setTickets((prev) => [data.ticket, ...prev]);
      }

      setShowCreateTicketModal(false);
      setNewTicketSubject("");
      setNewTicketDescription("");
      setNewTicketPhone("");
      setActiveTab("tickets");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating ticket");
    } finally {
      setIsCreatingTicket(false);
    }
  };

  // Admin WhatsApp Speed Test Share Handler (Downloads PDF + Opens WhatsApp in New Tab)
  const handleAdminShareSpeedTest = (item: SpeedTestRecord) => {
    const cust = customers.find((c) => c.id === item.customer_id);
    const mappedResult: SpeedTestResult = {
      id: item.id,
      timestamp: item.created_at,
      downloadMbps: item.download_mbps,
      uploadMbps: item.upload_mbps,
      pingMs: item.ping_ms,
      jitterMs: item.jitter_ms,
      serverName: item.server_name,
      serverLocation: item.server_location || "Bengaluru PoP",
      clientIp: item.client_ip || undefined,
      ispName: item.isp_name || "Spectra Fiber",
      grade: item.grade,
      engine: (item.engine as SpeedTestResult["engine"]) || "cloudflare",
    };

    shareSpeedTestToNocWhatsApp({
      result: mappedResult,
      pppoeUsername: item.pppoe_username,
      customerName: item.customer_name || cust?.name,
      planSpeedMbps: cust?.plan_speed_mbps || 300,
    });
  };

  // Admin Speed Test PDF Download Handler
  const handleAdminDownloadSpeedTestPdf = (item: SpeedTestRecord) => {
    const cust = customers.find((c) => c.id === item.customer_id);
    const mappedResult: SpeedTestResult = {
      id: item.id,
      timestamp: item.created_at,
      downloadMbps: item.download_mbps,
      uploadMbps: item.upload_mbps,
      pingMs: item.ping_ms,
      jitterMs: item.jitter_ms,
      serverName: item.server_name,
      serverLocation: item.server_location || "Bengaluru PoP",
      clientIp: item.client_ip || undefined,
      ispName: item.isp_name || "Spectra Fiber",
      grade: item.grade,
      engine: (item.engine as SpeedTestResult["engine"]) || "cloudflare",
    };

    downloadSpeedTestPdf({
      result: mappedResult,
      pppoeUsername: item.pppoe_username,
      customerName: item.customer_name || cust?.name,
      planSpeedMbps: cust?.plan_speed_mbps || 300,
    });
  };

  return (
    <div className="space-y-8">
      {/* 1. TOP OPERATIONS METRICS */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Database Subscribers */}
        <div
          onClick={() => setActiveTab("subscribers")}
          className={`relative overflow-hidden rounded-2xl border bg-card/85 p-5 backdrop-blur-xl shadow-xl cursor-pointer transition-all spectra-glow ${
            activeTab === "subscribers" ? "border-cyan-500 ring-2 ring-cyan-500/20" : "border-border/80 hover:border-cyan-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Subscribers
            </p>
            <div className="flex size-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-500">
              <Users className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black font-mono tracking-tight text-foreground">
            {customers.length} <span className="text-xs font-semibold text-muted-foreground">Accounts</span>
          </p>
          <p className="mt-2 text-xs text-cyan-500 font-semibold flex items-center gap-1">
            <CheckCircle2 className="size-3" /> Live in database
          </p>
        </div>

        {/* Speed Tests Logged */}
        <div
          onClick={() => {
            setSpeedTestCustomerFilter("all");
            setActiveTab("speedtests");
          }}
          className={`relative overflow-hidden rounded-2xl border bg-card/85 p-5 backdrop-blur-xl shadow-xl cursor-pointer transition-all spectra-glow ${
            activeTab === "speedtests" ? "border-cyan-500 ring-2 ring-cyan-500/20" : "border-border/80 hover:border-cyan-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Speed Tests
            </p>
            <div className="flex size-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-500">
              <Gauge className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black font-mono tracking-tight text-foreground">
            {metrics.totalSpeedTests} <span className="text-xs font-semibold text-muted-foreground">Tests</span>
          </p>
          <p className="mt-2 text-xs text-cyan-500 font-semibold">
            Peak: <span className="font-mono font-bold text-foreground">{metrics.peakSpeedMbps > 0 ? `${metrics.peakSpeedMbps}M` : "--"}</span> • Avg:{" "}
            <span className="font-mono font-bold text-foreground">{metrics.avgPingMs > 0 ? `${metrics.avgPingMs}ms` : "--"}</span>
          </p>
        </div>

        {/* Data Usage Volume */}
        <div
          onClick={() => {
            setUsageCustomerFilter("all");
            setActiveTab("usage");
          }}
          className={`relative overflow-hidden rounded-2xl border bg-card/85 p-5 backdrop-blur-xl shadow-xl cursor-pointer transition-all spectra-glow ${
            activeTab === "usage" ? "border-cyan-500 ring-2 ring-cyan-500/20" : "border-border/80 hover:border-cyan-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Network Usage
            </p>
            <div className="flex size-9 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <BarChart3 className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black font-mono tracking-tight text-foreground">
            {formatBytes(metrics.totalUsageBytes)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {metrics.totalSessionsCount} logged sessions
          </p>
        </div>

        {/* Total Collected Revenue */}
        <div
          onClick={() => setActiveTab("billing")}
          className={`relative overflow-hidden rounded-2xl border bg-card/85 p-5 backdrop-blur-xl shadow-xl cursor-pointer transition-all spectra-glow ${
            activeTab === "billing" ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-border/80 hover:border-emerald-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Revenue Settled
            </p>
            <div className="flex size-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black font-mono tracking-tight text-foreground">
            {formatINR(metrics.totalCollected)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {invoices.filter((i) => i.status === "paid").length} paid statements
          </p>
        </div>

        {/* Support Tickets Alarms */}
        <div
          onClick={() => setActiveTab("tickets")}
          className={`relative overflow-hidden rounded-2xl border bg-card/85 p-5 backdrop-blur-xl shadow-xl cursor-pointer transition-all spectra-glow ${
            activeTab === "tickets" ? "border-rose-500 ring-2 ring-rose-500/20" : "border-border/80 hover:border-rose-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              NOC Tickets
            </p>
            <div className="flex size-9 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500">
              <Headphones className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-foreground">
            {metrics.openTicketsCount}{" "}
            <span className="text-xs font-semibold text-muted-foreground">Open</span>
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            {metrics.urgentTicketsCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-bold text-rose-500 animate-pulse">
                🔴 {metrics.urgentTicketsCount} URGENT
              </span>
            ) : (
              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                <Check className="size-3" /> All normal priority
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 2. MAIN NAVIGATION TABS & PRIMARY ACTIONS */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-card/80 border border-border/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab("subscribers")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "subscribers"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Users className="size-4" />
            <span>Subscribers ({customers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("plans")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "plans"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Zap className="size-4" />
            <span>Plans & Packages</span>
          </button>

          <button
            onClick={() => setActiveTab("speedtests")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "speedtests"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Gauge className="size-4" />
            <span>Speed Tests ({speedTests.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("usage")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "usage"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <BarChart3 className="size-4" />
            <span>Usage Sessions ({usageSessions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("billing")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "billing"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Receipt className="size-4" />
            <span>Invoices ({invoices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("tickets")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "tickets"
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Headphones className="size-4" />
            <span>Tickets ({tickets.length})</span>
            {metrics.urgentTicketsCount > 0 && (
              <span className="size-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="rounded-xl border-border/80 text-xs font-semibold"
          >
            <RefreshCw className={`size-3.5 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            onClick={() => setShowBatchModal(true)}
            className="rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
          >
            <Send className="size-3.5" />
            <span>Dispatch Invoices</span>
          </Button>

          <Button
            onClick={() => setShowCreateTicketModal(true)}
            variant="outline"
            className="rounded-xl border-cyan-500/40 text-cyan-500 hover:bg-cyan-500/10 font-bold text-xs flex items-center gap-1.5"
          >
            <PlusCircle className="size-3.5" />
            <span>Log NOC Ticket</span>
          </Button>
        </div>
      </div>

      {/* 3. TAB VIEW: SUBSCRIBERS IN DB */}
      {activeTab === "subscribers" && (
        <section className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="size-5 text-cyan-500" />
                <h3 className="font-bold text-lg text-foreground">
                  Database Subscribers ({filteredCustomers.length})
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {customers.filter((c) => c.is_online).length} of {customers.length} subscribers currently Online
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Connection Status Filter */}
              <select
                value={subscriberStatusFilter}
                onChange={(e) => setSubscriberStatusFilter(e.target.value as "all" | "online" | "offline")}
                className="px-3 py-2 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All States ({customers.length})</option>
                <option value="online">🟢 Online Active ({customers.filter((c) => c.is_online).length})</option>
                <option value="offline">🔴 Offline ({customers.filter((c) => !c.is_online).length})</option>
              </select>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search name, PPPoE..."
                  value={subscriberSearch}
                  onChange={(e) => setSubscriberSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCustomers.map((cust) => {
              const custInvoices = invoices.filter((i) => i.customer_id === cust.id);
              const custTickets = tickets.filter((t) => t.customer_id === cust.id);
              const custSpeedTests = speedTests.filter((s) => s.customer_id === cust.id);
              const custUsageSessions = usageSessions.filter((s) => s.customer_id === cust.id);

              return (
                <div
                  key={cust.id}
                  className="rounded-2xl border border-border/70 bg-card/85 p-5 backdrop-blur-xl shadow-lg space-y-4 hover:border-cyan-500/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-base text-foreground flex items-center gap-1.5">
                            {cust.name}
                          </h4>
                          {cust.is_online ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 shadow-sm">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-rose-500/10 border border-rose-500/30 text-rose-500">
                              <span className="size-1.5 rounded-full bg-rose-500" />
                              Offline
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs font-semibold text-cyan-600 dark:text-cyan-400 mt-0.5">
                          {cust.pppoe_username}
                        </p>
                      </div>
                      <button
                        onClick={() => handleInspectSubscriber(cust)}
                        className="p-1.5 rounded-xl bg-background/80 hover:bg-muted border border-border/70 text-xs text-muted-foreground hover:text-cyan-500 transition-colors flex items-center gap-1"
                        title="Inspect full subscriber profile"
                      >
                        <Eye className="size-3.5" />
                        <span className="text-[10px] font-bold">Inspect</span>
                      </button>
                    </div>

                    {cust.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Mail className="size-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{cust.email}</span>
                      </p>
                    )}

                    {/* Plan Badge */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <Zap className="size-3.5 text-cyan-500 shrink-0" />
                        <span className="font-bold text-foreground truncate">
                          {cust.plan_name || `${cust.plan_speed_mbps || 300} Mbps Symmetric`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        <span>{cust.plan_speed_mbps || 300}M</span>
                        <span>•</span>
                        <span>₹{cust.plan_price_inr || 999}/mo</span>
                      </div>
                    </div>

                    {/* Usage & Speed Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold">
                        <HardDrive className="size-3" />
                        <span>{cust.totalUsageFormatted || "0 GB"}</span>
                      </div>

                      {cust.latestSpeedTestMbps ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
                          <Zap className="size-3" />
                          <span>{cust.latestSpeedTestMbps} Mbps ({cust.latestSpeedTestPing}ms)</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/60 text-muted-foreground">
                          <Gauge className="size-3" />
                          <span>No Speed Tests</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer Status Badges (Invoices, Tickets, Speed, Usage) */}
                  <div className="grid grid-cols-4 gap-1.5 text-xs pt-1">
                    <div
                      onClick={() => handleFilterSpeedTestsByCustomer(cust.id)}
                      className="p-2 rounded-xl bg-background/80 border border-border/60 cursor-pointer hover:border-cyan-500/40 transition-colors text-center"
                      title="View Speed Tests"
                    >
                      <p className="text-muted-foreground text-[9px] uppercase font-bold">Speed</p>
                      <p className="font-bold font-mono text-cyan-500 text-xs mt-0.5">
                        {custSpeedTests.length}
                      </p>
                    </div>

                    <div
                      onClick={() => handleFilterUsageByCustomer(cust.id)}
                      className="p-2 rounded-xl bg-background/80 border border-border/60 cursor-pointer hover:border-cyan-500/40 transition-colors text-center"
                      title="View Usage Sessions"
                    >
                      <p className="text-muted-foreground text-[9px] uppercase font-bold">Sessions</p>
                      <p className="font-bold font-mono text-indigo-400 text-xs mt-0.5">
                        {custUsageSessions.length}
                      </p>
                    </div>

                    <div
                      onClick={() => handleFilterInvoicesByCustomer(cust.id)}
                      className="p-2 rounded-xl bg-background/80 border border-border/60 cursor-pointer hover:border-cyan-500/40 transition-colors text-center"
                      title="View Invoices"
                    >
                      <p className="text-muted-foreground text-[9px] uppercase font-bold">Invoices</p>
                      <p className="font-bold font-mono text-foreground text-xs mt-0.5">
                        {custInvoices.length}
                      </p>
                    </div>

                    <div
                      onClick={() => handleFilterTicketsByCustomer(cust.id)}
                      className="p-2 rounded-xl bg-background/80 border border-border/60 cursor-pointer hover:border-cyan-500/40 transition-colors text-center"
                      title="View Support Tickets"
                    >
                      <p className="text-muted-foreground text-[9px] uppercase font-bold">Tickets</p>
                      <p className="font-bold font-mono text-foreground text-xs mt-0.5">
                        {custTickets.length}
                      </p>
                    </div>
                  </div>

                  {/* Actions for this user */}
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEditPlan(cust)}
                      className="w-full rounded-xl border-cyan-500/40 hover:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-xs h-8"
                    >
                      <Zap className="size-3 mr-1.5 text-cyan-500" />
                      <span>Edit Plan ({cust.plan_speed_mbps || 300}M)</span>
                    </Button>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleOpenSendInvoiceForCustomer(cust.id)}
                        className="rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-600 dark:text-cyan-400 font-bold text-xs h-8"
                      >
                        <Send className="size-3 mr-1" />
                        <span>Send Bill</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenCreateTicketForCustomer(cust.id)}
                        className="rounded-xl border-border/70 hover:bg-muted font-bold text-xs h-8"
                      >
                        <PlusCircle className="size-3 mr-1 text-cyan-500" />
                        <span>Log Ticket</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. TAB VIEW: PLANS & PACKAGES */}
      {activeTab === "plans" && (
        <section className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="size-5 text-cyan-500" />
                <h3 className="font-extrabold text-xl text-foreground tracking-tight">
                  Fiber Broadband Plans & Bandwidth Packages
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Central catalog of symmetric fiber speeds, monthly rates, and subscriber SLA targets
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 text-xs font-mono font-bold">
                {planCatalog.length} Active Plans
              </span>
            </div>
          </div>

          {/* Plan Catalog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {planCatalog.map((p) => {
              const assignedCustomers = customers.filter(
                (c) => (c.plan_speed_mbps || 300) === p.download_speed_mbps || c.plan_name === p.name
              );

              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col justify-between rounded-2xl border p-5 backdrop-blur-xl shadow-xl transition-all ${
                    p.is_popular
                      ? "border-cyan-500/60 bg-gradient-to-b from-cyan-950/20 via-card/85 to-card/85 ring-1 ring-cyan-500/30"
                      : "border-border/80 bg-card/85 hover:border-cyan-500/40"
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header & Tag */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-500">
                          {p.tag || "Fiber Plan"}
                        </span>
                        <h4 className="font-bold text-base text-foreground mt-0.5 leading-snug">
                          {p.name}
                        </h4>
                      </div>
                      {p.is_popular && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500 text-slate-950 shadow-sm">
                          Popular
                        </span>
                      )}
                    </div>

                    {/* Speed & Specs Display */}
                    <div className="p-3.5 rounded-xl bg-background/80 border border-border/60 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground font-semibold">Speed SLA</span>
                        <div className="text-right">
                          <span className="text-2xl font-black font-mono tracking-tight text-cyan-500">
                            {p.download_speed_mbps}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground ml-1">Mbps</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2 font-mono">
                        <span>Symmetric Up/Down</span>
                        <span className="text-foreground font-bold">{p.upload_speed_mbps} Mbps Up</span>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black font-mono text-foreground">
                        ₹{p.price_inr}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">/ month + GST</span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {p.description}
                    </p>

                    {/* Active Subscribers on this Plan */}
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-muted-foreground font-semibold flex items-center gap-1">
                          <Users className="size-3 text-cyan-500" /> Subscribers
                        </span>
                        <span className="font-mono font-bold text-cyan-500">
                          {assignedCustomers.length} Accounts
                        </span>
                      </div>

                      {assignedCustomers.length > 0 && (
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {assignedCustomers.slice(0, 4).map((ac) => (
                            <span
                              key={ac.id}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted/70 text-foreground border border-border/50 truncate max-w-[120px]"
                              title={ac.name}
                            >
                              {ac.name.split(" ")[0]}
                            </span>
                          ))}
                          {assignedCustomers.length > 4 && (
                            <span className="text-[10px] text-muted-foreground self-center">
                              +{assignedCustomers.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (customers.length > 0) {
                          handleOpenEditPlan(customers[0]);
                          handleSelectPresetPlan(p);
                        }
                      }}
                      className="w-full rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-600 dark:text-cyan-400 font-bold text-xs h-8"
                    >
                      <Zap className="size-3 mr-1 text-cyan-500" />
                      <span>Assign to Subscriber</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. TAB VIEW: SPEED TESTS INTELLIGENCE */}
      {activeTab === "speedtests" && (
        <section className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Gauge className="size-5 text-cyan-500" />
                <h3 className="font-extrabold text-xl text-foreground tracking-tight">
                  Subscriber Speed Test Intelligence
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real WAN bandwidth, packet latency, and jitter measurements recorded across subscriber sessions
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 text-xs font-mono font-bold">
                {filteredSpeedTests.length} Total Tests
              </span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search subscriber, IP, PoP server..."
                value={speedTestSearch}
                onChange={(e) => setSpeedTestSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Customer Filter */}
            <select
              value={speedTestCustomerFilter}
              onChange={(e) => setSpeedTestCustomerFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Subscribers ({customers.length})</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.pppoe_username})
                </option>
              ))}
            </select>

            {/* Month Filter */}
            <select
              value={speedTestMonthFilter}
              onChange={(e) => setSpeedTestMonthFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Months ({availableSpeedTestMonths.length || "All"})</option>
              {availableSpeedTestMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Grade Filter */}
            <select
              value={speedTestGradeFilter}
              onChange={(e) => setSpeedTestGradeFilter(e.target.value as "all" | "A+" | "A" | "B" | "C")}
              className="px-3 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Performance Grades</option>
              <option value="A+">Grade A+ (Ultra Optimal)</option>
              <option value="A">Grade A (Good)</option>
              <option value="B">Grade B (Normal)</option>
              <option value="C">Grade C (Sub-optimal)</option>
            </select>
          </div>

          {/* Speed Tests Table */}
          <div className="rounded-2xl border border-border/80 bg-card/85 backdrop-blur-xl shadow-xl overflow-hidden">
            {filteredSpeedTests.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                <Gauge className="size-8 mx-auto text-muted-foreground/50" />
                <p>No speed test records found matching the active filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                      <th className="py-3 px-4">Subscriber</th>
                      <th className="py-3 px-4">Download</th>
                      <th className="py-3 px-4">Upload</th>
                      <th className="py-3 px-4">Latency & Jitter</th>
                      <th className="py-3 px-4">Edge Server / PoP</th>
                      <th className="py-3 px-4">Client IP</th>
                      <th className="py-3 px-4">Grade</th>
                      <th className="py-3 px-4">Tested At</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {filteredSpeedTests.map((item) => {
                      const cust = customers.find((c) => c.id === item.customer_id);

                      return (
                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3.5 px-4 font-sans">
                            <div className="font-bold text-foreground text-xs">
                              {item.customer_name || cust?.name || "Subscriber"}
                            </div>
                            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
                              {item.pppoe_username}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-cyan-600 dark:text-cyan-400 text-sm">
                            {item.download_mbps} Mbps
                          </td>
                          <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            {item.upload_mbps} Mbps
                          </td>
                          <td className="py-3.5 px-4 text-foreground text-xs">
                            <span>{item.ping_ms} ms ping</span>
                            <span className="text-[10px] text-muted-foreground ml-1">
                              ({item.jitter_ms}ms jitter)
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-sans text-muted-foreground">
                            {item.server_name}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-foreground">
                            {item.client_ip || "103.220.14.88"}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-500">
                              {item.grade}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-muted-foreground font-sans">
                            {new Date(item.created_at).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 font-sans">
                              <button
                                onClick={() => handleAdminShareSpeedTest(item)}
                                className="p-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                title="Share Speed Test PDF Report to NOC WhatsApp"
                              >
                                <MessageSquare className="size-3.5" />
                              </button>
                              <button
                                onClick={() => handleAdminDownloadSpeedTestPdf(item)}
                                className="p-1.5 rounded-lg border border-border/70 bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Download PDF Certificate"
                              >
                                <Download className="size-3.5" />
                              </button>
                              {cust && (
                                <button
                                  onClick={() => handleInspectSubscriber(cust)}
                                  className="px-2 py-1 rounded-lg bg-background/80 hover:bg-muted border border-border/70 text-[11px] font-semibold text-cyan-500 hover:text-cyan-400 transition-colors"
                                >
                                  Inspect
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. TAB VIEW: USAGE SESSIONS */}
      {activeTab === "usage" && (
        <section className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="size-5 text-indigo-400" />
                <h3 className="font-extrabold text-xl text-foreground tracking-tight">
                  Subscriber Session & Data Usage History
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inspect raw session timestamps, download bytes, upload bytes, and active connection durations
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-bold">
                {filteredUsageSessions.length} Total Sessions
              </span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search subscriber name, PPPoE username..."
                value={usageSearch}
                onChange={(e) => setUsageSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Customer Filter */}
            <select
              value={usageCustomerFilter}
              onChange={(e) => setUsageCustomerFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Subscribers ({customers.length})</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.pppoe_username})
                </option>
              ))}
            </select>

            {/* Month Filter */}
            <select
              value={usageMonthFilter}
              onChange={(e) => setUsageMonthFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Months ({availableUsageMonths.length || "All"})</option>
              {availableUsageMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Usage Sessions Table */}
          <div className="rounded-2xl border border-border/80 bg-card/85 backdrop-blur-xl shadow-xl overflow-hidden">
            {filteredUsageSessions.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                <BarChart3 className="size-8 mx-auto text-muted-foreground/50" />
                <p>No usage session records found matching the active filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                      <th className="py-3 px-4">Subscriber</th>
                      <th className="py-3 px-4">Session Started</th>
                      <th className="py-3 px-4">Session Ended</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Download</th>
                      <th className="py-3 px-4">Upload</th>
                      <th className="py-3 px-4">Total Data</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {filteredUsageSessions.map((session) => {
                      const cust = customers.find((c) => c.id === session.customer_id);

                      return (
                        <tr key={session.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3.5 px-4 font-sans">
                            <div className="font-bold text-foreground text-xs">
                              {session.customer_name || cust?.name || "Subscriber"}
                            </div>
                            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
                              {session.pppoe_username}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground text-[11px] font-sans">
                            {new Date(session.session_started_at).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground text-[11px] font-sans">
                            {session.session_ended_at ? (
                              new Date(session.session_ended_at).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            ) : (
                              <span className="text-emerald-500 font-bold flex items-center gap-1">
                                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                Active Online
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-sans text-foreground">
                            {formatDuration(session.session_started_at, session.session_ended_at)}
                          </td>
                          <td className="py-3.5 px-4 text-cyan-600 dark:text-cyan-400 font-semibold">
                            {formatBytes(session.download_bytes)}
                          </td>
                          <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                            {formatBytes(session.upload_bytes)}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-foreground text-sm">
                            {formatBytes(session.total_bytes)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {cust && (
                              <button
                                onClick={() => handleInspectSubscriber(cust)}
                                className="px-2.5 py-1 rounded-lg bg-background/80 hover:bg-muted border border-border/70 text-[11px] font-sans font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                              >
                                View User
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 6. TAB VIEW: BILLING & INVOICES */}
      {activeTab === "billing" && (
        <section className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-lg text-foreground">
                Invoices & Statements ({filteredInvoices.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Generate monthly tax invoices, mark payments received, and download PDF receipts.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => setShowSingleInvoiceModal(true)}
                className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
              >
                <PlusCircle className="size-3.5 mr-1" />
                <span>Create Custom Bill</span>
              </Button>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search invoice number, user..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value as "all" | InvoiceStatus)}
              className="px-3 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid & Settled</option>
              <option value="pending">Pending Dues</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={invoiceCustomerFilter}
              onChange={(e) => setInvoiceCustomerFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Subscribers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.pppoe_username})
                </option>
              ))}
            </select>
          </div>

          {/* Invoices Table */}
          <div className="rounded-2xl border border-border/80 bg-card/85 backdrop-blur-xl shadow-xl overflow-hidden">
            {filteredInvoices.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No invoices found matching the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Subscriber</th>
                      <th className="py-3 px-4">Billing Period</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-foreground text-xs">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3.5 px-4 font-sans">
                          <p className="font-bold text-foreground text-xs">{inv.customer_name || "Subscriber"}</p>
                          <p className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400">
                            {inv.pppoe_username || "N/A"}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground text-xs font-sans">
                          {inv.period_start} to {inv.period_end}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground text-xs font-sans">
                          {inv.due_date}
                        </td>
                        <td className="py-3.5 px-4 font-black text-foreground text-sm">
                          {formatINR(inv.total_amount)}
                        </td>
                        <td className="py-3.5 px-4 font-sans">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              inv.status === "paid"
                                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-500"
                                : inv.status === "pending"
                                ? "bg-amber-500/10 border border-amber-500/30 text-amber-500"
                                : "bg-rose-500/10 border border-rose-500/30 text-rose-500"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-sans space-x-2">
                          {inv.status !== "paid" && (
                            <button
                              onClick={() => setShowMarkPaidModal(inv)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] transition-colors"
                            >
                              Settle / Mark Paid
                            </button>
                          )}
                          <button
                            onClick={() => handleDownloadInvoicePdf(inv)}
                            className="px-2.5 py-1 rounded-lg bg-background/80 hover:bg-muted border border-border/70 text-muted-foreground hover:text-foreground text-[11px] font-semibold transition-colors"
                          >
                            Download PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 7. TAB VIEW: SUPPORT TICKETS */}
      {activeTab === "tickets" && (
        <section className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-lg text-foreground">
                Support & NOC Dispatch Queue ({filteredTickets.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Triage incoming fiber diagnostics alarms, assign field technicians, and update resolution notes.
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => setShowCreateTicketModal(true)}
              className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
            >
              <PlusCircle className="size-3.5 mr-1" />
              <span>Create Support Ticket</span>
            </Button>
          </div>

          {/* Filters & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search ticket code, summary..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={ticketStatusFilter}
              onChange={(e) => setTicketStatusFilter(e.target.value as "all" | TicketStatus)}
              className="px-3 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Ticket Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress / Dispatched</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <select
              value={ticketPriorityFilter}
              onChange={(e) => setTicketPriorityFilter(e.target.value as "all" | TicketPriority)}
              className="px-3 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">🔴 Urgent Priority</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>

            <select
              value={ticketCategoryFilter}
              onChange={(e) => setTicketCategoryFilter(e.target.value as "all" | TicketCategory)}
              className="px-3 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Categories</option>
              <option value="speed">Speed & Performance</option>
              <option value="disconnection">Optical Disconnection</option>
              <option value="router">Router / Wi-Fi</option>
              <option value="billing">Billing & Invoices</option>
              <option value="relocation">Relocation / Plan</option>
              <option value="general">General Support</option>
            </select>

            <select
              value={ticketCustomerFilter}
              onChange={(e) => setTicketCustomerFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border/80 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Subscribers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.pppoe_username})
                </option>
              ))}
            </select>
          </div>

          {/* Tickets Table */}
          <div className="rounded-2xl border border-border/80 bg-card/85 backdrop-blur-xl shadow-xl overflow-hidden">
            {filteredTickets.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No support tickets found matching the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                      <th className="py-3 px-4">Ticket Code</th>
                      <th className="py-3 px-4">Subscriber</th>
                      <th className="py-3 px-4">Category & Subject</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Technician Assigned</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {filteredTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-cyan-600 dark:text-cyan-400 text-xs">
                          {t.ticket_code}
                        </td>
                        <td className="py-3.5 px-4 font-sans">
                          <p className="font-bold text-foreground text-xs">{t.customer_name || "Subscriber"}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {t.pppoe_username || "N/A"}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 font-sans">
                          <p className="font-bold text-foreground text-xs">{t.subject}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-xs">{t.description}</p>
                        </td>
                        <td className="py-3.5 px-4 font-sans">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.priority === "urgent"
                                ? "bg-rose-500/10 border border-rose-500/30 text-rose-500 animate-pulse"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {t.priority === "urgent" ? "🔴 Urgent" : t.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-sans">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              t.status === "resolved" || t.status === "closed"
                                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-500"
                                : t.status === "in_progress"
                                ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-500"
                                : "bg-amber-500/10 border border-amber-500/30 text-amber-500"
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-sans text-muted-foreground">
                          {t.assigned_to || "Unassigned"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-sans">
                          <button
                            onClick={() => handleOpenTicketEdit(t)}
                            className="px-3 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-600 dark:text-cyan-400 font-bold text-xs transition-colors"
                          >
                            Triage / Resolve
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}

      {/* MODAL 1: INSPECT SUBSCRIBER TELEMETRY & FULL PROFILE */}
      {inspectSubscriber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-4xl rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl space-y-6 text-foreground max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border/60 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                    Active Subscriber Intelligence
                  </span>
                </div>
                <h3 className="font-extrabold text-2xl text-foreground mt-1">
                  {inspectSubscriber.name}
                </h3>
                <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                  PPPoE: {inspectSubscriber.pppoe_username} • Email: {inspectSubscriber.email || "N/A"}
                </p>
              </div>
              <button
                onClick={() => setInspectSubscriber(null)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Active Fiber Plan Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Zap className="size-4" />
                </div>
                <div>
                  <p className="font-bold text-foreground">
                    {inspectSubscriber.plan_name || `${inspectSubscriber.plan_speed_mbps || 300} Mbps Symmetric Fiber`}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Speed SLA: <span className="text-cyan-400 font-bold">{inspectSubscriber.plan_speed_mbps || 300} Mbps</span> • ₹{inspectSubscriber.plan_price_inr || 999}/mo • Renewal: {inspectSubscriber.plan_renewal_date || "Monthly"}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  handleOpenEditPlan(inspectSubscriber);
                }}
                className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs h-8 shrink-0"
              >
                <Zap className="size-3 mr-1" />
                <span>Change Plan</span>
              </Button>
            </div>

            {/* Quick KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-2xl border border-border/70 bg-background/60 p-3.5">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Data Used</p>
                <p className="font-mono text-lg font-black text-indigo-400 mt-0.5">
                  {inspectSubscriber.totalUsageFormatted || "0 GB"}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/60 p-3.5">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Latest Speed Test</p>
                <p className="font-mono text-lg font-black text-cyan-500 mt-0.5">
                  {inspectSubscriber.latestSpeedTestMbps
                    ? `${inspectSubscriber.latestSpeedTestMbps} Mbps`
                    : "--"}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/60 p-3.5">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Ping Latency</p>
                <p className="font-mono text-lg font-black text-emerald-400 mt-0.5">
                  {inspectSubscriber.latestSpeedTestPing
                    ? `${inspectSubscriber.latestSpeedTestPing} ms`
                    : "--"}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/60 p-3.5">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Usage Sessions</p>
                <p className="font-mono text-lg font-black text-foreground mt-0.5">
                  {inspectSubscriber.totalSessionsCount || 0} Logged
                </p>
              </div>
            </div>

            {/* Modal Sub-Tabs */}
            <div className="flex items-center gap-2 border-b border-border/60 pb-3 text-xs font-bold">
              <button
                onClick={() => setInspectModalSubTab("presence")}
                className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  inspectModalSubTab === "presence"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Activity className="size-3.5" />
                <span>Presence Logs ({statusLogs.filter((l) => l.customer_id === inspectSubscriber.id).length})</span>
              </button>

              <button
                onClick={() => setInspectModalSubTab("speed")}
                className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  inspectModalSubTab === "speed"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Gauge className="size-3.5" />
                <span>Speed Tests ({speedTests.filter((s) => s.customer_id === inspectSubscriber.id).length})</span>
              </button>

              <button
                onClick={() => setInspectModalSubTab("usage")}
                className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  inspectModalSubTab === "usage"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 className="size-3.5" />
                <span>Usage Sessions ({usageSessions.filter((s) => s.customer_id === inspectSubscriber.id).length})</span>
              </button>

              <button
                onClick={() => setInspectModalSubTab("invoices")}
                className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  inspectModalSubTab === "invoices"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Receipt className="size-3.5" />
                <span>Invoices ({invoices.filter((i) => i.customer_id === inspectSubscriber.id).length})</span>
              </button>

              <button
                onClick={() => setInspectModalSubTab("tickets")}
                className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  inspectModalSubTab === "tickets"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Headphones className="size-3.5" />
                <span>Tickets ({tickets.filter((t) => t.customer_id === inspectSubscriber.id).length})</span>
              </button>
            </div>

            {/* Sub-tab 0: Presence & Status Logs */}
            {inspectModalSubTab === "presence" && (
              <div className="space-y-3">
                {/* Live Current Status Box */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  inspectSubscriber.is_online
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-500"
                }`}>
                  <div className="flex items-center gap-2.5">
                    {inspectSubscriber.is_online ? <Wifi className="size-5" /> : <WifiOff className="size-5" />}
                    <div>
                      <p className="font-extrabold text-sm uppercase tracking-wider">
                        Connection Currently {inspectSubscriber.is_online ? "ONLINE & OPERATIONAL" : "OFFLINE / DISCONNECTED"}
                      </p>
                      <p className="text-xs opacity-85 font-sans">
                        {inspectSubscriber.last_status_change_at
                          ? `Last presence update recorded on ${new Date(inspectSubscriber.last_status_change_at).toLocaleString("en-IN")}`
                          : "Realtime link telemetry active"}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-background/80 font-mono text-xs font-bold border border-current">
                    {inspectSubscriber.is_online ? "🟢 Active" : "🔴 Down"}
                  </span>
                </div>

                {statusLogs.filter((l) => l.customer_id === inspectSubscriber.id).length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No status transition events logged yet for this subscriber.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border/70">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/60 bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-mono">
                          <th className="py-2.5 px-3">Event Time</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">PPPoE Account</th>
                          <th className="py-2.5 px-3">Telegram Message ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono text-xs">
                        {statusLogs
                          .filter((l) => l.customer_id === inspectSubscriber.id)
                          .map((log) => (
                            <tr key={log.id} className="hover:bg-muted/20">
                              <td className="py-2.5 px-3 text-muted-foreground font-sans">
                                {new Date(log.event_time).toLocaleDateString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    log.status === "ONLINE"
                                      ? "bg-emerald-500/10 text-emerald-500"
                                      : "bg-rose-500/10 text-rose-500"
                                  }`}
                                >
                                  {log.status === "ONLINE" ? "🟢 ONLINE" : "🔴 OFFLINE"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-foreground">{log.pppoe_username}</td>
                              <td className="py-2.5 px-3 text-muted-foreground">
                                {log.telegram_message_id ? `#${log.telegram_message_id}` : "Live Sync"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 1: Speed Tests */}
            {inspectModalSubTab === "speed" && (
              <div className="space-y-3">
                {(() => {
                  const custSpeedTests = speedTests.filter((s) => s.customer_id === inspectSubscriber.id);
                  const filteredCustSpeedTests = custSpeedTests.filter(
                    (s) => inspectSpeedMonthFilter === "all" || getYearMonthKey(s.created_at) === inspectSpeedMonthFilter
                  );
                  const custSpeedMonths = Array.from(
                    new Set(custSpeedTests.map((s) => getYearMonthKey(s.created_at)).filter(Boolean))
                  ).sort().reverse();

                  return (
                    <>
                      {custSpeedTests.length > 0 && (
                        <div className="flex items-center justify-between gap-2 pb-1">
                          <span className="text-xs text-muted-foreground font-medium">
                            Showing {filteredCustSpeedTests.length} of {custSpeedTests.length} test records
                          </span>
                          <select
                            value={inspectSpeedMonthFilter}
                            onChange={(e) => setInspectSpeedMonthFilter(e.target.value)}
                            className="px-2.5 py-1 rounded-lg border border-border/70 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
                          >
                            <option value="all">All Months</option>
                            {custSpeedMonths.map((mKey) => {
                              const [y, m] = mKey.split("-");
                              const d = new Date(Number(y), Number(m) - 1, 1);
                              const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
                              return (
                                <option key={mKey} value={mKey}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}

                      {filteredCustSpeedTests.length === 0 ? (
                        <p className="py-8 text-center text-xs text-muted-foreground">
                          {custSpeedTests.length === 0
                            ? "This subscriber has not performed any speed tests yet."
                            : "No speed tests recorded in the selected month."}
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-border/70">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-border/60 bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-mono">
                                <th className="py-2.5 px-3">Date</th>
                                <th className="py-2.5 px-3">Download</th>
                                <th className="py-2.5 px-3">Upload</th>
                                <th className="py-2.5 px-3">Ping</th>
                                <th className="py-2.5 px-3">Jitter</th>
                                <th className="py-2.5 px-3">Server / PoP</th>
                                <th className="py-2.5 px-3">Grade</th>
                                <th className="py-2.5 px-3 text-right">Share</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40 font-mono text-xs">
                              {filteredCustSpeedTests.map((st) => (
                                <tr key={st.id} className="hover:bg-muted/20">
                                  <td className="py-2.5 px-3 text-muted-foreground font-sans">
                                    {new Date(st.created_at).toLocaleDateString("en-IN", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-cyan-500">
                                    {st.download_mbps} Mbps
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-emerald-500">
                                    {st.upload_mbps} Mbps
                                  </td>
                                  <td className="py-2.5 px-3 text-foreground">{st.ping_ms} ms</td>
                                  <td className="py-2.5 px-3 text-foreground">{st.jitter_ms} ms</td>
                                  <td className="py-2.5 px-3 font-sans text-muted-foreground">{st.server_name}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-500">
                                      {st.grade}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-sans">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleAdminShareSpeedTest(st)}
                                        className="p-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                        title="Share Report to NOC WhatsApp"
                                      >
                                        <MessageSquare className="size-3" />
                                      </button>
                                      <button
                                        onClick={() => handleAdminDownloadSpeedTestPdf(st)}
                                        className="p-1 rounded-lg border border-border/70 bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                                        title="Download PDF"
                                      >
                                        <Download className="size-3" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Sub-tab 2: Usage Sessions */}
            {inspectModalSubTab === "usage" && (
              <div className="space-y-3">
                {(() => {
                  const custUsageSessions = usageSessions.filter((s) => s.customer_id === inspectSubscriber.id);
                  const filteredCustUsageSessions = custUsageSessions.filter((s) => {
                    const ts = s.session_ended_at || s.session_started_at;
                    return inspectUsageMonthFilter === "all" || (ts && getYearMonthKey(ts) === inspectUsageMonthFilter);
                  });
                  const custUsageMonths = Array.from(
                    new Set(
                      custUsageSessions
                        .map((s) => getYearMonthKey(s.session_ended_at || s.session_started_at))
                        .filter(Boolean)
                    )
                  ).sort().reverse();

                  const totalFilteredBytes = filteredCustUsageSessions.reduce((acc, s) => {
                    const dl = Number(s.download_bytes) || 0;
                    const ul = Number(s.upload_bytes) || 0;
                    const tot = Number(s.total_bytes) || 0;
                    return acc + (tot > 0 ? tot : dl + ul);
                  }, 0);

                  return (
                    <>
                      {custUsageSessions.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-medium">
                              {filteredCustUsageSessions.length} sessions
                            </span>
                            <span className="text-[11px] font-mono font-bold text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-md">
                              Total: {formatBytes(totalFilteredBytes)}
                            </span>
                          </div>
                          <select
                            value={inspectUsageMonthFilter}
                            onChange={(e) => setInspectUsageMonthFilter(e.target.value)}
                            className="px-2.5 py-1 rounded-lg border border-border/70 bg-card/80 text-xs text-foreground focus:outline-none focus:border-cyan-500"
                          >
                            <option value="all">All Months</option>
                            {custUsageMonths.map((mKey) => {
                              const [y, m] = mKey.split("-");
                              const d = new Date(Number(y), Number(m) - 1, 1);
                              const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
                              return (
                                <option key={mKey} value={mKey}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}

                      {filteredCustUsageSessions.length === 0 ? (
                        <p className="py-8 text-center text-xs text-muted-foreground">
                          {custUsageSessions.length === 0
                            ? "No active usage session records logged for this user."
                            : "No usage sessions recorded in the selected month."}
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-border/70">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-border/60 bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-bold font-mono">
                                <th className="py-2.5 px-3">Started</th>
                                <th className="py-2.5 px-3">Ended</th>
                                <th className="py-2.5 px-3">Duration</th>
                                <th className="py-2.5 px-3">Download</th>
                                <th className="py-2.5 px-3">Upload</th>
                                <th className="py-2.5 px-3">Total Volume</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40 font-mono text-xs">
                              {filteredCustUsageSessions.map((sess) => (
                                <tr key={sess.id} className="hover:bg-muted/20">
                                  <td className="py-2.5 px-3 text-muted-foreground font-sans">
                                    {new Date(sess.session_started_at).toLocaleDateString("en-IN", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </td>
                                  <td className="py-2.5 px-3 text-muted-foreground font-sans">
                                    {sess.session_ended_at ? (
                                      new Date(sess.session_ended_at).toLocaleDateString("en-IN", {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    ) : (
                                      <span className="text-emerald-500 font-bold">Active</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 font-sans text-foreground">
                                    {formatDuration(sess.session_started_at, sess.session_ended_at)}
                                  </td>
                                  <td className="py-2.5 px-3 text-cyan-500">{formatBytes(sess.download_bytes)}</td>
                                  <td className="py-2.5 px-3 text-emerald-500">{formatBytes(sess.upload_bytes)}</td>
                                  <td className="py-2.5 px-3 font-bold text-foreground">
                                    {formatBytes(sess.total_bytes)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Sub-tab 3: Invoices */}
            {inspectModalSubTab === "invoices" && (
              <div className="space-y-3">
                {invoices.filter((i) => i.customer_id === inspectSubscriber.id).length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No billing statements dispatched for this account.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {invoices
                      .filter((i) => i.customer_id === inspectSubscriber.id)
                      .map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-background/70 text-xs"
                        >
                          <div>
                            <p className="font-bold text-foreground font-mono">{inv.invoice_number}</p>
                            <p className="text-muted-foreground text-[11px]">
                              {inv.period_start} to {inv.period_end} • Due: {inv.due_date}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-foreground font-mono">{formatINR(inv.total_amount)}</span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                inv.status === "paid"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-amber-500/10 text-amber-500"
                              }`}
                            >
                              {inv.status}
                            </span>
                            <button
                              onClick={() => handleDownloadInvoicePdf(inv)}
                              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                            >
                              <Download className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 4: Tickets */}
            {inspectModalSubTab === "tickets" && (
              <div className="space-y-3">
                {tickets.filter((t) => t.customer_id === inspectSubscriber.id).length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No support tickets filed for this account.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tickets
                      .filter((t) => t.customer_id === inspectSubscriber.id)
                      .map((tkt) => (
                        <div
                          key={tkt.id}
                          className="p-3.5 rounded-xl border border-border/70 bg-background/70 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-cyan-500">{tkt.ticket_code}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                tkt.status === "resolved" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                              }`}
                            >
                              {tkt.status}
                            </span>
                          </div>
                          <p className="font-bold text-foreground">{tkt.subject}</p>
                          <p className="text-muted-foreground text-[11px]">{tkt.description}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: BATCH INVOICE GENERATOR */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 text-foreground">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Send className="size-5 text-cyan-500" />
                <h3 className="font-bold text-lg text-foreground">
                  Dispatch Monthly Invoices
                </h3>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {batchSuccessMsg ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="size-10 text-emerald-500 mx-auto animate-bounce" />
                <p className="font-bold text-sm text-foreground">{batchSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleBatchGenerate} className="space-y-4 text-xs">
                <p className="text-muted-foreground">
                  This will generate and save official invoices for all <strong>{customers.length} subscribers</strong> in the database.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-muted-foreground mb-1">
                      Billing Month
                    </label>
                    <input
                      type="month"
                      value={batchMonth}
                      onChange={(e) => setBatchMonth(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-muted-foreground mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={batchDueDate}
                      onChange={(e) => setBatchDueDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Plan / Service Description
                  </label>
                  <input
                    type="text"
                    value={batchPlanName}
                    onChange={(e) => setBatchPlanName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Base Monthly Rental (Excl. 18% GST)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={batchBaseAmount}
                      onChange={(e) => setBatchBaseAmount(Number(e.target.value))}
                      required
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Gross with 18% GST: <strong>{formatINR(Number(batchBaseAmount) * 1.18)}</strong> per subscriber
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowBatchModal(false)}
                    className="flex-1 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isGeneratingBatch}
                    className="flex-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                  >
                    {isGeneratingBatch ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    Generate {customers.length} Invoices
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: SINGLE CUSTOM INVOICE */}
      {showSingleInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 text-foreground">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="size-5 text-cyan-500" />
                <h3 className="font-bold text-lg text-foreground">
                  Create Custom Invoice
                </h3>
              </div>
              <button
                onClick={() => setShowSingleInvoiceModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {singleSuccessMsg ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="size-10 text-emerald-500 mx-auto animate-bounce" />
                <p className="font-bold text-sm text-foreground">{singleSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleCreateSingle} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Subscriber
                  </label>
                  <select
                    value={singleCustomerId}
                    onChange={(e) => setSingleCustomerId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.pppoe_username})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Plan / Item Description
                  </label>
                  <input
                    type="text"
                    value={singlePlanName}
                    onChange={(e) => setSinglePlanName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-muted-foreground mb-1">
                      Period Start
                    </label>
                    <input
                      type="date"
                      value={singlePeriodStart}
                      onChange={(e) => setSinglePeriodStart(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-muted-foreground mb-1">
                      Period End
                    </label>
                    <input
                      type="date"
                      value={singlePeriodEnd}
                      onChange={(e) => setSinglePeriodEnd(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-muted-foreground mb-1">
                      Base Amount (Excl. Tax)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        value={singleBaseAmount}
                        onChange={(e) => setSingleBaseAmount(Number(e.target.value))}
                        required
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold uppercase text-muted-foreground mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={singleDueDate}
                      onChange={(e) => setSingleDueDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Payment Status
                  </label>
                  <select
                    value={singleStatus}
                    onChange={(e) => setSingleStatus(e.target.value as "pending" | "paid")}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                  >
                    <option value="pending">Pending Dues</option>
                    <option value="paid">Settled / Paid</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSingleInvoiceModal(false)}
                    className="flex-1 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreatingSingle}
                    className="flex-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                  >
                    {isCreatingSingle ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    Create Invoice
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: SETTLE / MARK PAID */}
      {showMarkPaidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 text-foreground">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-500" />
                <h3 className="font-bold text-lg text-foreground">
                  Settle Invoice: {showMarkPaidModal.invoice_number}
                </h3>
              </div>
              <button
                onClick={() => setShowMarkPaidModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleMarkPaid} className="space-y-4 text-xs">
              <p className="text-muted-foreground">
                Subscriber: <strong>{showMarkPaidModal.customer_name}</strong> • Amount:{" "}
                <strong className="text-foreground">{formatINR(showMarkPaidModal.total_amount)}</strong>
              </p>

              <div>
                <label className="block font-bold uppercase text-muted-foreground mb-1">
                  Payment Method
                </label>
                <select
                  value={paidPaymentMethod}
                  onChange={(e) => setPaidPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                >
                  <option value="UPI / QR Payment">UPI / Instant QR Payment</option>
                  <option value="Cash / Field Collection">Cash / Field Collection</option>
                  <option value="NEFT / IMPS Bank Transfer">NEFT / IMPS Bank Transfer</option>
                  <option value="Cheque / DD">Cheque / Demand Draft</option>
                  <option value="Online Portal Gateway">Online Portal Gateway</option>
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase text-muted-foreground mb-1">
                  Transaction / UTR Reference
                </label>
                <input
                  type="text"
                  value={paidTransactionRef}
                  onChange={(e) => setPaidTransactionRef(e.target.value)}
                  placeholder="e.g. UPI-RR-928419842"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowMarkPaidModal(null)}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isMarkingPaid}
                  className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  {isMarkingPaid ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Confirm & Mark Paid
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: TRIAGE SUPPORT TICKET */}
      {selectedTicketToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 text-foreground">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Headphones className="size-5 text-cyan-500" />
                <h3 className="font-bold text-lg text-foreground">
                  Ticket Triage: {selectedTicketToEdit.ticket_code}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTicketToEdit(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTicket} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                <p className="font-bold text-foreground text-sm">{selectedTicketToEdit.subject}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{selectedTicketToEdit.description}</p>
                <p className="text-[10px] text-cyan-500 font-mono pt-1">
                  Subscriber: {selectedTicketToEdit.customer_name} ({selectedTicketToEdit.pppoe_username})
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Status
                  </label>
                  <select
                    value={editTicketStatus}
                    onChange={(e) => setEditTicketStatus(e.target.value as TicketStatus)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Priority Level
                  </label>
                  <select
                    value={editTicketPriority}
                    onChange={(e) => setEditTicketPriority(e.target.value as TicketPriority)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-muted-foreground mb-1">
                  Assigned NOC Technician / Field Agent
                </label>
                <input
                  type="text"
                  value={editTicketTechnician}
                  onChange={(e) => setEditTicketTechnician(e.target.value)}
                  placeholder="e.g. NOC Level 2 - Splicer Team"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-muted-foreground mb-1">
                  Internal Resolution Notes & Diagnostics Log
                </label>
                <textarea
                  rows={3}
                  value={editTicketNotes}
                  onChange={(e) => setEditTicketNotes(e.target.value)}
                  placeholder="e.g. Optical fiber spliced at pole #14. Rx optical power restored to -18.2 dBm. Customer verified 300 Mbps throughput."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTicketToEdit(null)}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdatingTicket}
                  className="flex-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  {isUpdatingTicket ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Save & Update Ticket
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: CREATE TICKET ON BEHALF OF SUBSCRIBER */}
      {showCreateTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 text-foreground">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="size-5 text-cyan-500" />
                <h3 className="font-bold text-lg text-foreground">
                  Log Ticket for Subscriber
                </h3>
              </div>
              <button
                onClick={() => setShowCreateTicketModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicketOnBehalf} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase text-muted-foreground mb-1">
                  Subscriber Account
                </label>
                <select
                  value={newTicketCustomerId}
                  onChange={(e) => setNewTicketCustomerId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.pppoe_username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Category
                  </label>
                  <select
                    value={newTicketCategory}
                    onChange={(e) => setNewTicketCategory(e.target.value as TicketCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                  >
                    <option value="speed">Speed & Performance</option>
                    <option value="disconnection">Optical Disconnection</option>
                    <option value="router">Router / Wi-Fi</option>
                    <option value="billing">Billing & Invoices</option>
                    <option value="relocation">Relocation / Plan</option>
                    <option value="general">General Support</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Priority
                  </label>
                  <select
                    value={newTicketPriority}
                    onChange={(e) => setNewTicketPriority(e.target.value as TicketPriority)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent Alarm</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-muted-foreground mb-1">
                  Subject / Summary
                </label>
                <input
                  type="text"
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  placeholder="e.g. Optical line LOS blinking red"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-muted-foreground mb-1">
                  Problem Description
                </label>
                <textarea
                  rows={3}
                  value={newTicketDescription}
                  onChange={(e) => setNewTicketDescription(e.target.value)}
                  placeholder="Detailed subscriber issue description..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-muted-foreground mb-1">
                  Contact Phone (Optional)
                </label>
                <input
                  type="text"
                  value={newTicketPhone}
                  onChange={(e) => setNewTicketPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateTicketModal(false)}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreatingTicket}
                  className="flex-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  {isCreatingTicket ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Create Ticket
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: EDIT SUBSCRIBER FIBER PLAN */}
      {editingPlanCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-500/40 bg-card p-6 shadow-2xl space-y-5 text-foreground">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-500">
                  <Zap className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">
                    Edit Subscriber Fiber Plan
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {editingPlanCustomer.name} ({editingPlanCustomer.pppoe_username})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingPlanCustomer(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {planSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                <span>{planSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSavePlanSubmit} className="space-y-4 text-xs">
              {/* Quick Select Presets */}
              <div>
                <label className="block font-bold uppercase text-muted-foreground mb-1.5">
                  1-Click ISP Plan Presets
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {planCatalog.map((preset) => {
                    const isSelected =
                      editPlanPresetId === preset.id ||
                      (editPlanSpeed === preset.download_speed_mbps && editPlanPrice === preset.price_inr);

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPresetPlan(preset)}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-cyan-500 bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30"
                            : "border-border/70 bg-background/60 hover:border-cyan-500/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <p className="font-black font-mono text-xs text-foreground">
                          {preset.download_speed_mbps} Mbps
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          ₹{preset.price_inr}/mo
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Plan Name */}
              <div>
                <label className="block font-bold uppercase text-muted-foreground mb-1">
                  Plan Display Name
                </label>
                <input
                  type="text"
                  value={editPlanName}
                  onChange={(e) => setEditPlanName(e.target.value)}
                  placeholder="e.g. Spectra Pro 100 Mbps Unlimited"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                />
              </div>

              {/* Speeds */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Download Speed SLA (Mbps)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={editPlanSpeed}
                    onChange={(e) => setEditPlanSpeed(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Used for diagnostic gauge and SLA compliance grading
                  </p>
                </div>

                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Upload Speed SLA (Mbps)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={editPlanUploadSpeed}
                    onChange={(e) => setEditPlanUploadSpeed(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Symmetric fiber upstream speed limit
                  </p>
                </div>
              </div>

              {/* Price & Renewal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Monthly Base Price (INR ₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPlanPrice}
                    onChange={(e) => setEditPlanPrice(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-muted-foreground mb-1">
                    Next Renewal Date
                  </label>
                  <input
                    type="date"
                    value={editPlanRenewalDate}
                    onChange={(e) => setEditPlanRenewalDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground font-mono"
                  />
                </div>
              </div>

              {/* Data Allowance */}
              <div>
                <label className="block font-bold uppercase text-muted-foreground mb-1">
                  Data Policy / FUP
                </label>
                <select
                  value={editPlanDataLimit}
                  onChange={(e) => setEditPlanDataLimit(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/80 bg-background/80 text-foreground"
                >
                  <option value="unlimited">Unlimited Data (True Symmetric Zero Throttling)</option>
                  <option value="1000">1000 GB High Speed FUP</option>
                  <option value="2000">2000 GB High Speed FUP</option>
                  <option value="3300">3300 GB Commercial FUP (TRAI Standard)</option>
                </select>
              </div>

              {/* Summary info box */}
              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs space-y-1.5">
                <p className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-cyan-400" />
                  Instant Live Synchronization
                </p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Updating this plan will immediately update the subscriber&apos;s active speed dial target, SLA grade calculations (A+, A, B, C), and invoice generation.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingPlanCustomer(null)}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingPlan}
                  className="flex-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  {isSavingPlan ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Save Plan & Sync Metrics
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
