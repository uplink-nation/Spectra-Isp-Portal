"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  HardDrive,
  ShieldCheck,
  Search,
  Layers,
} from "lucide-react";
import { ExportPdfButton } from "@/components/export-pdf-button";

export type UsageSession = {
  id: string | number;
  session_started_at: string | null;
  session_ended_at: string | null;
  download_bytes: number | string | null;
  upload_bytes: number | string | null;
  total_bytes: number | string | null;
};

interface SubscriberSessionLogProps {
  sessions: UsageSession[];
  customerName: string;
  pppoeUsername: string;
  defaultMonthName?: string;
}

function toBytes(val: number | string | null) {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_NAMES_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Active session";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  // Deterministic IST (UTC+5:30) conversion
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 5.5 * 3600000);

  const day = istDate.getDate();
  const month = MONTH_NAMES_SHORT[istDate.getMonth()];
  const year = istDate.getFullYear();
  let hours = istDate.getHours();
  const minutes = String(istDate.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;

  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

function getYearMonthKey(ts: string | null | undefined): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const istDate = new Date(utc + 5.5 * 3600000);
    const y = istDate.getFullYear();
    const m = String(istDate.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  } catch {
    return "";
  }
}

export function SubscriberSessionLog({
  sessions,
  customerName,
  pppoeUsername,
  defaultMonthName = "Current Month",
}: SubscriberSessionLogProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Extract all distinct available months from sessions
  const availableMonths = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((s) => {
      const ts = s.session_ended_at ?? s.session_started_at;
      if (!ts) return;
      const key = getYearMonthKey(ts);
      if (key && !map.has(key)) {
        const [yStr, mStr] = key.split("-");
        const monthIndex = Number(mStr) - 1;
        const label = `${MONTH_NAMES_LONG[monthIndex] || "Month"} ${yStr}`;
        map.set(key, label);
      }
    });
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [sessions]);

  // Default to "all" so user sees complete records with option to filter by month
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Filter sessions by month and search query
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const ts = session.session_ended_at ?? session.session_started_at;

      // Month match
      if (selectedMonth !== "all") {
        if (!ts || getYearMonthKey(ts) !== selectedMonth) {
          return false;
        }
      }

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const formattedDate = formatDate(ts).toLowerCase();
        const dlStr = formatBytes(toBytes(session.download_bytes)).toLowerCase();
        const ulStr = formatBytes(toBytes(session.upload_bytes)).toLowerCase();
        const totStr = formatBytes(
          toBytes(session.total_bytes) > 0
            ? toBytes(session.total_bytes)
            : toBytes(session.download_bytes) + toBytes(session.upload_bytes)
        ).toLowerCase();

        return (
          formattedDate.includes(q) ||
          dlStr.includes(q) ||
          ulStr.includes(q) ||
          totStr.includes(q)
        );
      }

      return true;
    });
  }, [sessions, selectedMonth, searchQuery]);

  // Totals for the filtered dataset
  const { downloadBytes, uploadBytes, totalBytes } = useMemo(() => {
    let dl = 0;
    let ul = 0;
    let tot = 0;

    filteredSessions.forEach((s) => {
      const d = toBytes(s.download_bytes);
      const u = toBytes(s.upload_bytes);
      const t = toBytes(s.total_bytes);
      dl += d;
      ul += u;
      tot += t > 0 ? t : d + u;
    });

    return { downloadBytes: dl, uploadBytes: ul, totalBytes: tot };
  }, [filteredSessions]);

  const activeMonthLabel = useMemo(() => {
    if (selectedMonth === "all") return "All Time";
    const found = availableMonths.find((m) => m.key === selectedMonth);
    return found ? found.label : defaultMonthName;
  }, [selectedMonth, availableMonths, defaultMonthName]);

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-card/85 backdrop-blur-xl shadow-xl spectra-glow">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col gap-4 border-b border-border/60 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-cyan-500" />
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Recent Sessions & Usage Logs
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              PPPoE fiber data telemetry with month-wise history filtering
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ExportPdfButton
              customerName={customerName}
              pppoeUsername={pppoeUsername}
              monthName={activeMonthLabel}
              downloadBytes={downloadBytes}
              uploadBytes={uploadBytes}
              totalBytes={totalBytes}
              sessions={filteredSessions}
            />
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
              <ShieldCheck className="size-3.5 text-cyan-500" />
              Live Sync
            </span>
          </div>
        </div>

        {/* FILTERS TOOLBAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
          {/* Month selector & Search */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Month Filter Dropdown */}
            <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 px-3 py-1.5 shadow-sm">
              <Calendar className="size-4 text-cyan-500 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-card text-foreground">
                  All Months ({sessions.length} sessions)
                </option>
                {availableMonths.map((m) => (
                  <option key={m.key} value={m.key} className="bg-card text-foreground">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Filter */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search date or volume..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border/80 bg-background/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Filtered Volume Pill */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">
              {filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""}
            </span>
            <span className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 font-mono font-bold text-cyan-600 dark:text-cyan-400">
              {formatBytes(totalBytes)}
            </span>
          </div>
        </div>
      </div>

      {/* SESSION LIST */}
      {sessions.length === 0 ? (
        <div className="px-6 py-12 text-center text-muted-foreground">
          <HardDrive className="mx-auto size-10 text-muted-foreground/50 mb-3" />
          <p className="font-semibold">No usage sessions recorded</p>
          <p className="text-xs text-muted-foreground mt-1">
            Sessions will appear automatically once data is logged.
          </p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="px-6 py-12 text-center text-muted-foreground">
          <Layers className="mx-auto size-8 text-muted-foreground/50 mb-2" />
          <p className="font-medium text-xs">No sessions found matching the selected month or search filter.</p>
        </div>
      ) : (
        <div>
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-border/60 bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Session Date & Time</th>
                  <th className="px-6 py-4 text-right">Download</th>
                  <th className="px-6 py-4 text-right">Upload</th>
                  <th className="px-6 py-4 text-right">Total Bandwidth</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/50">
                {filteredSessions.map((session) => {
                  const download = toBytes(session.download_bytes);
                  const upload = toBytes(session.upload_bytes);
                  const storedTotal = toBytes(session.total_bytes);
                  const total = storedTotal > 0 ? storedTotal : download + upload;

                  return (
                    <tr
                      key={session.id}
                      className="transition-colors hover:bg-cyan-500/5 group"
                    >
                      <td className="px-6 py-4 text-muted-foreground">
                        <div className="flex items-center gap-2.5 font-medium text-foreground" suppressHydrationWarning>
                          <div className="size-2 rounded-full bg-cyan-500/60 group-hover:bg-cyan-400 group-hover:scale-125 transition-all" />
                          {formatDate(session.session_ended_at ?? session.session_started_at)}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right font-medium text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <ArrowDownToLine className="size-3.5 text-blue-500" />
                          {formatBytes(download)}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-medium text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <ArrowUpFromLine className="size-3.5 text-indigo-500" />
                          {formatBytes(upload)}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        <span className="rounded-lg bg-background/80 px-2.5 py-1 border border-border/60 shadow-sm font-mono text-cyan-600 dark:text-cyan-400">
                          {formatBytes(total)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD VIEW */}
          <div className="block md:hidden divide-y divide-border/60">
            {filteredSessions.map((session) => {
              const download = toBytes(session.download_bytes);
              const upload = toBytes(session.upload_bytes);
              const storedTotal = toBytes(session.total_bytes);
              const total = storedTotal > 0 ? storedTotal : download + upload;

              return (
                <div key={session.id} className="p-4 space-y-3 hover:bg-cyan-500/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-foreground flex items-center gap-2" suppressHydrationWarning>
                      <Clock className="size-3.5 text-cyan-500" />
                      {formatDate(session.session_ended_at ?? session.session_started_at)}
                    </div>
                    <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                      {formatBytes(total)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                    <div className="flex items-center gap-1.5 rounded-lg bg-background/50 p-2 border border-border/50">
                      <ArrowDownToLine className="size-3.5 text-blue-500" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">DL</p>
                        <p className="font-semibold text-foreground">{formatBytes(download)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-lg bg-background/50 p-2 border border-border/50">
                      <ArrowUpFromLine className="size-3.5 text-indigo-500" />
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">UL</p>
                        <p className="font-semibold text-foreground">{formatBytes(upload)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
