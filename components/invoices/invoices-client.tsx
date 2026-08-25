"use client";

import { useState, useMemo } from "react";
import type { Customer, Invoice, InvoiceStatus } from "@/types/portal";
import { formatINR, generateInvoicePdf } from "./invoice-pdf-generator";
import {
  FileText,
  Download,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  ShieldCheck,
  Calendar,
  Sparkles,
  Zap,
  Receipt,
  X,
  QrCode,
  Smartphone,
  Building2,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvoicesClientProps {
  customer: Customer;
  initialInvoices: Invoice[];
}

export function InvoicesClient({
  customer,
  initialInvoices,
}: InvoicesClientProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "netbanking">("upi");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalCount = invoices.length;
    const paidInvoices = invoices.filter((inv) => inv.status === "paid");
    const pendingInvoices = invoices.filter((inv) => inv.status === "pending" || inv.status === "overdue");

    const totalPaidAmount = paidInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const outstandingAmount = pendingInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);

    const latestInvoice = invoices[0];
    const activePlan = latestInvoice ? latestInvoice.plan_name : "Spectra GigaFiber 300 Mbps Unlimited";

    return {
      totalCount,
      paidCount: paidInvoices.length,
      pendingCount: pendingInvoices.length,
      totalPaidAmount,
      outstandingAmount,
      activePlan,
      latestInvoice,
    };
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        inv.invoice_number.toLowerCase().includes(query) ||
        inv.plan_name.toLowerCase().includes(query) ||
        inv.period_start.toLowerCase().includes(query) ||
        inv.period_end.toLowerCase().includes(query) ||
        (inv.transaction_ref && inv.transaction_ref.toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [invoices, statusFilter, searchQuery]);

  // Handle PDF download
  const handleDownloadPdf = (invoice: Invoice) => {
    try {
      setDownloadingId(invoice.id);
      generateInvoicePdf({ customer, invoice });
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      setTimeout(() => setDownloadingId(null), 600);
    }
  };

  // Handle Pay Now simulation
  const handlePayNow = (invoice: Invoice) => {
    setPayingInvoice(invoice);
    setPaymentSuccess(false);
  };

  const handleProcessPayment = () => {
    if (!payingInvoice) return;
    setIsProcessingPayment(true);

    setTimeout(() => {
      const updatedList = invoices.map((inv) => {
        if (inv.id === payingInvoice.id) {
          const nowStr = new Date().toISOString().split("T")[0];
          const newRef = `TXN-SP${Math.floor(100000 + Math.random() * 900000)}`;
          return {
            ...inv,
            status: "paid" as InvoiceStatus,
            paid_at: nowStr,
            payment_method: paymentMethod === "upi" ? "UPI Auto-Debit" : paymentMethod === "card" ? "Credit Card" : "NetBanking",
            transaction_ref: newRef,
          };
        }
        return inv;
      });

      setInvoices(updatedList);
      setIsProcessingPayment(false);
      setPaymentSuccess(true);
    }, 1200);
  };

  return (
    <div className="space-y-8">
      {/* 1. TOP STATS BAR */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Outstanding Balance */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/85 p-5 backdrop-blur-xl shadow-xl spectra-glow transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Outstanding Due
            </p>
            <div className={`flex size-9 items-center justify-center rounded-xl border ${stats.outstandingAmount > 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"}`}>
              {stats.outstandingAmount > 0 ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground font-mono">
            {formatINR(stats.outstandingAmount)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            {stats.outstandingAmount > 0 ? (
              <span className="font-semibold text-amber-500">Payment pending</span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-500">
                <ShieldCheck className="size-3.5" /> All bills settled
              </span>
            )}
          </div>
        </div>

        {/* Current Active Plan */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/85 p-5 backdrop-blur-xl shadow-xl spectra-glow transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Subscribed Plan
            </p>
            <div className="flex size-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-500">
              <Zap className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-base font-bold tracking-tight text-foreground line-clamp-1">
            {stats.activePlan}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono text-cyan-500 font-semibold">Unlimited 300 Mbps</span>
            <span>• Auto-Renew</span>
          </div>
        </div>

        {/* Next Billing Date */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/85 p-5 backdrop-blur-xl shadow-xl spectra-glow transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Next Bill Cycle
            </p>
            <div className="flex size-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-500">
              <Calendar className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground">
            01 Sep 2026
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 text-blue-400" />
            <span>Due on 10 Sep 2026</span>
          </div>
        </div>

        {/* Total Invoiced YTD */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/85 p-5 backdrop-blur-xl shadow-xl spectra-glow transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Invoiced (YTD)
            </p>
            <div className="flex size-9 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-500">
              <Receipt className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground font-mono">
            {formatINR(stats.totalPaidAmount)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{stats.paidCount} official GST statements</span>
          </div>
        </div>
      </section>

      {/* 2. INVOICES MAIN PANEL */}
      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card/85 backdrop-blur-xl shadow-xl spectra-glow">
        {/* Panel Header & Controls */}
        <div className="border-b border-border/60 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-cyan-500" />
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Invoices & Payment Receipts
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Download tax invoices with itemized GST breakdown for your broadband connection
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/60 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
              <Sparkles className="size-3.5 text-cyan-500" />
              <span>GSTIN: 07AABCS1429P1Z8</span>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-background/60 border border-border/60">
              {(
                [
                  { key: "all", label: "All Statements" },
                  { key: "paid", label: "Paid & Settled" },
                  { key: "pending", label: "Pending" },
                  { key: "overdue", label: "Overdue" },
                ] as const
              ).map((tab) => {
                const isActive = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      isActive
                        ? "bg-cyan-500 text-slate-950 shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by invoice #, plan, date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-border/80 bg-background/80 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-foreground placeholder:text-muted-foreground transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Invoices List / Table */}
        {filteredInvoices.length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <FileText className="mx-auto size-12 text-muted-foreground/40 mb-3" />
            <p className="text-base font-semibold text-foreground">No invoices found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your search query or status filter to see billing records.
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-border/60 bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Invoice #</th>
                    <th className="px-6 py-4">Billing Period</th>
                    <th className="px-6 py-4">Plan Description</th>
                    <th className="px-6 py-4 text-right">Base Amount</th>
                    <th className="px-6 py-4 text-right">GST (18%)</th>
                    <th className="px-6 py-4 text-right">Total Amount</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredInvoices.map((invoice) => {
                    const isPaid = invoice.status === "paid";
                    const isDownloading = downloadingId === invoice.id;

                    return (
                      <tr
                        key={invoice.id}
                        className="transition-colors hover:bg-cyan-500/5 group"
                      >
                        {/* Invoice Number */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 shrink-0">
                              <Receipt className="size-4" />
                            </div>
                            <div>
                              <p className="font-mono font-bold text-foreground">
                                {invoice.invoice_number}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Issued: {invoice.issue_date}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Billing Period */}
                        <td className="px-6 py-4 text-muted-foreground">
                          <div className="text-xs font-medium text-foreground">
                            {invoice.period_start} – {invoice.period_end}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Due: {invoice.due_date}
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold text-foreground">
                            {invoice.plan_name}
                          </span>
                        </td>

                        {/* Base Amount */}
                        <td className="px-6 py-4 text-right font-mono text-muted-foreground text-xs">
                          {formatINR(Number(invoice.base_amount))}
                        </td>

                        {/* GST Amount */}
                        <td className="px-6 py-4 text-right font-mono text-xs text-muted-foreground">
                          {formatINR(Number(invoice.cgst_amount) + Number(invoice.sgst_amount))}
                        </td>

                        {/* Total Amount */}
                        <td className="px-6 py-4 text-right">
                          <span className="font-mono font-bold text-sm text-foreground">
                            {formatINR(Number(invoice.total_amount))}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="px-6 py-4 text-center">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Paid
                            </span>
                          ) : invoice.status === "pending" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                              <span className="size-1.5 rounded-full bg-rose-500" />
                              Overdue
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedInvoice(invoice)}
                              className="px-2.5 py-1.5 rounded-lg border border-border/80 bg-background/60 hover:bg-muted/60 text-xs font-semibold text-foreground transition-all flex items-center gap-1"
                              title="View Invoice Breakdown"
                            >
                              Details
                            </button>

                            <button
                              onClick={() => handleDownloadPdf(invoice)}
                              disabled={isDownloading}
                              className="px-2.5 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-600 dark:text-cyan-400 transition-all flex items-center gap-1.5 disabled:opacity-50"
                              title="Download PDF"
                            >
                              {isDownloading ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Download className="size-3.5" />
                              )}
                              <span>PDF</span>
                            </button>

                            {!isPaid && (
                              <button
                                onClick={() => handlePayNow(invoice)}
                                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                              >
                                <CreditCard className="size-3.5" />
                                <span>Pay</span>
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

            {/* Mobile & Tablet Card View */}
            <div className="block lg:hidden divide-y divide-border/60">
              {filteredInvoices.map((invoice) => {
                const isPaid = invoice.status === "paid";
                const isDownloading = downloadingId === invoice.id;

                return (
                  <div
                    key={invoice.id}
                    className="p-5 space-y-3.5 hover:bg-cyan-500/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Receipt className="size-4 text-cyan-500" />
                          <span className="font-mono font-bold text-sm text-foreground">
                            {invoice.invoice_number}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {invoice.period_start} – {invoice.period_end}
                        </p>
                      </div>

                      <div>
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            Due {invoice.due_date}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-background/60 p-3 border border-border/50 text-xs">
                      <div>
                        <p className="text-muted-foreground">{invoice.plan_name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Base {formatINR(Number(invoice.base_amount))} + GST
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-extrabold text-base text-foreground">
                          {formatINR(Number(invoice.total_amount))}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="flex-1 py-2 rounded-xl border border-border/80 bg-background/80 hover:bg-muted/60 text-xs font-semibold text-foreground transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>Breakdown</span>
                      </button>

                      <button
                        onClick={() => handleDownloadPdf(invoice)}
                        disabled={isDownloading}
                        className="flex-1 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-600 dark:text-cyan-400 transition-all flex items-center justify-center gap-1.5"
                      >
                        {isDownloading ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Download className="size-3.5" />
                        )}
                        <span>Download PDF</span>
                      </button>

                      {!isPaid && (
                        <button
                          onClick={() => handlePayNow(invoice)}
                          className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                        >
                          <CreditCard className="size-3.5" />
                          <span>Pay Now</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 3. INVOICE DETAILS MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 text-foreground max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
                  <Receipt className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">
                    Tax Invoice Breakdown
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground">
                    {selectedInvoice.invoice_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Subscriber & Billing meta */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-4 rounded-xl border border-border/60">
              <div>
                <p className="text-muted-foreground font-semibold">SUBSCRIBER</p>
                <p className="font-bold text-foreground mt-0.5">{customer.name}</p>
                <p className="font-mono text-cyan-600 dark:text-cyan-400">{customer.pppoe_username}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-semibold">BILLING CYCLE</p>
                <p className="font-medium text-foreground mt-0.5">
                  {selectedInvoice.period_start} to {selectedInvoice.period_end}
                </p>
                <p className="text-muted-foreground">Due: {selectedInvoice.due_date}</p>
              </div>
            </div>

            {/* Itemized charges */}
            <div className="space-y-2.5 text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Itemized Charges (SAC 998422)
              </p>

              <div className="flex justify-between py-1.5 border-b border-border/40 text-xs">
                <span className="text-muted-foreground">
                  {selectedInvoice.plan_name} (Base Tariff)
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {formatINR(Number(selectedInvoice.base_amount))}
                </span>
              </div>

              <div className="flex justify-between py-1 text-xs">
                <span className="text-muted-foreground">Central GST (CGST 9.00%)</span>
                <span className="font-mono text-muted-foreground">
                  {formatINR(Number(selectedInvoice.cgst_amount))}
                </span>
              </div>

              <div className="flex justify-between py-1 text-xs">
                <span className="text-muted-foreground">State GST (SGST 9.00%)</span>
                <span className="font-mono text-muted-foreground">
                  {formatINR(Number(selectedInvoice.sgst_amount))}
                </span>
              </div>

              <div className="flex justify-between py-2.5 border-t border-border/70 text-base font-bold">
                <span className="text-foreground">Total Invoice Amount</span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400">
                  {formatINR(Number(selectedInvoice.total_amount))}
                </span>
              </div>
            </div>

            {/* Payment Record */}
            <div className="p-3.5 rounded-xl border border-border/60 bg-background/60 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Payment Status</span>
                <span className={`font-bold uppercase ${selectedInvoice.status === "paid" ? "text-emerald-500" : "text-amber-500"}`}>
                  {selectedInvoice.status}
                </span>
              </div>
              {selectedInvoice.payment_method && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="font-medium text-foreground">{selectedInvoice.payment_method}</span>
                </div>
              )}
              {selectedInvoice.transaction_ref && (
                <div className="flex items-center justify-between font-mono">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="text-foreground">{selectedInvoice.transaction_ref}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedInvoice(null)}
                className="flex-1 rounded-xl"
              >
                Close
              </Button>
              <Button
                onClick={() => handleDownloadPdf(selectedInvoice)}
                className="flex-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-2"
              >
                <Download className="size-4" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PAY NOW SIMULATION MODAL */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 text-foreground">
            {!paymentSuccess ? (
              <>
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-5 text-cyan-500" />
                    <h3 className="font-bold text-lg text-foreground">
                      Spectra Quick Pay
                    </h3>
                  </div>
                  <button
                    onClick={() => setPayingInvoice(null)}
                    className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                    Total Amount Due
                  </p>
                  <p className="mt-1 text-3xl font-black font-mono text-foreground">
                    {formatINR(Number(payingInvoice.total_amount))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bill #{payingInvoice.invoice_number} ({payingInvoice.period_start})
                  </p>
                </div>

                {/* Payment Methods */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Choose Payment Method
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("upi")}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                        paymentMethod === "upi"
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-500"
                          : "border-border/80 bg-background/60 text-muted-foreground hover:border-border"
                      }`}
                    >
                      <Smartphone className="size-4" />
                      <span>UPI / QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("card")}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                        paymentMethod === "card"
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-500"
                          : "border-border/80 bg-background/60 text-muted-foreground hover:border-border"
                      }`}
                    >
                      <CreditCard className="size-4" />
                      <span>Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("netbanking")}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                        paymentMethod === "netbanking"
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-500"
                          : "border-border/80 bg-background/60 text-muted-foreground hover:border-border"
                      }`}
                    >
                      <Building2 className="size-4" />
                      <span>Net Banking</span>
                    </button>
                  </div>
                </div>

                {/* Simulated Payment details view */}
                {paymentMethod === "upi" ? (
                  <div className="rounded-xl border border-border/60 bg-muted/40 p-4 text-center space-y-3">
                    <div className="mx-auto size-24 rounded-lg bg-card p-2 border border-border/80 flex items-center justify-center">
                      <QrCode className="size-20 text-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Scan via GPay, PhonePe, Paytm, or UPI App
                    </p>
                    <p className="text-xs font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                      spectra.broadband@icici
                    </p>
                  </div>
                ) : paymentMethod === "card" ? (
                  <div className="space-y-2 text-xs">
                    <input
                      type="text"
                      placeholder="Card Number (4000 1234 5678 9010)"
                      defaultValue="4242 •••• •••• 4242"
                      className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background/80 focus:ring-1 focus:ring-cyan-500 font-mono"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="MM/YY"
                        defaultValue="12/28"
                        className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background/80 font-mono"
                      />
                      <input
                        type="password"
                        placeholder="CVV"
                        defaultValue="•••"
                        className="w-full px-3 py-2 rounded-xl border border-border/80 bg-background/80 font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-border/60 bg-muted/40 text-xs text-center">
                    <p className="text-muted-foreground">
                      Instant redirection to your bank secure login gateway.
                    </p>
                  </div>
                )}

                {/* Pay Button */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setPayingInvoice(null)}
                    disabled={isProcessingPayment}
                    className="flex-1 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleProcessPayment}
                    disabled={isProcessingPayment}
                    className="flex-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                  >
                    {isProcessingPayment ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      `Pay ${formatINR(Number(payingInvoice.total_amount))}`
                    )}
                  </Button>
                </div>
              </>
            ) : (
              /* Success confirmation */
              <div className="text-center py-4 space-y-4">
                <div className="mx-auto size-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 animate-in zoom-in-50">
                  <Check className="size-8" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-foreground">
                    Payment Successful!
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your broadband subscription has been renewed successfully.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-border/60 bg-background/60 text-xs font-mono text-muted-foreground space-y-1">
                  <p>Amount: <span className="font-bold text-foreground">{formatINR(Number(payingInvoice.total_amount))}</span></p>
                  <p>Invoice: <span className="text-foreground">{payingInvoice.invoice_number}</span></p>
                  <p>Status: <span className="text-emerald-500 font-bold">SETTLED (ACTIVE)</span></p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={() => {
                      const updatedInv = invoices.find((i) => i.id === payingInvoice.id);
                      if (updatedInv) handleDownloadPdf(updatedInv);
                    }}
                    variant="outline"
                    className="flex-1 rounded-xl flex items-center gap-1.5"
                  >
                    <Download className="size-4" />
                    Download Receipt
                  </Button>
                  <Button
                    onClick={() => setPayingInvoice(null)}
                    className="flex-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
