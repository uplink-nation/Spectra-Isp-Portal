"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Calendar,
  Zap,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type UsageSession = {
  id: string | number;
  session_started_at: string | null;
  session_ended_at: string | null;
  download_bytes: number | string | null;
  upload_bytes: number | string | null;
  total_bytes: number | string | null;
};

interface UsageChartsProps {
  sessions: UsageSession[];
  monthName: string;
}

function toBytes(value: number | string | null) {
  const bytes = Number(value);
  return Number.isFinite(bytes) ? bytes : 0;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatGB(bytes: number) {
  return (bytes / (1024 * 1024 * 1024)).toFixed(2);
}

export function UsageCharts({ sessions, monthName }: UsageChartsProps) {
  const [viewMode, setViewMode] = useState<"bar" | "area" | "pie">("bar");
  const [filterPeriod, setFilterPeriod] = useState<"month" | "all">("month");

  // Filter and group sessions by day
  const { dailyData, pieData, metrics } = useMemo(() => {
    if (!sessions || sessions.length === 0) {
      return {
        dailyData: [],
        pieData: [],
        metrics: {
          totalBytes: 0,
          downloadBytes: 0,
          uploadBytes: 0,
          dayChangePercent: 0,
          isDayIncrease: true,
          dailyAverageBytes: 0,
          peakDay: { date: "N/A", bytes: 0 },
          projectedMonthlyGB: "0",
        },
      };
    }

    const now = new Date();
    const currentYear = Number(
      new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "numeric" }).format(now)
    );
    const currentMonth = Number(
      new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "numeric" }).format(now)
    );

    // Filter sessions based on filterPeriod
    const filteredSessions = sessions.filter((session) => {
      if (filterPeriod === "all") return true;
      if (!session.session_ended_at) return false;
      const d = new Date(session.session_ended_at);
      const parts = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "numeric",
      }).formatToParts(d);
      const year = Number(parts.find((p) => p.type === "year")?.value);
      const month = Number(parts.find((p) => p.type === "month")?.value);
      return year === currentYear && month === currentMonth;
    });

    // Group by date string (YYYY-MM-DD)
    const dayMap = new Map<string, { dateStr: string; label: string; download: number; upload: number; total: number; count: number }>();

    filteredSessions.forEach((session) => {
      const dateVal = session.session_ended_at ?? session.session_started_at;
      if (!dateVal) return;
      const dateObj = new Date(dateVal);
      const key = dateObj.toISOString().split("T")[0];
      const label = dateObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric" });

      const dl = toBytes(session.download_bytes);
      const ul = toBytes(session.upload_bytes);
      const st = toBytes(session.total_bytes);
      const tot = st > 0 ? st : dl + ul;

      const existing = dayMap.get(key) || { dateStr: key, label, download: 0, upload: 0, total: 0, count: 0 };
      existing.download += dl;
      existing.upload += ul;
      existing.total += tot;
      existing.count += 1;
      dayMap.set(key, existing);
    });

    // Sort chronologically
    const sortedDays = Array.from(dayMap.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    // Calculate metrics
    let totalDl = 0;
    let totalUl = 0;
    let maxDay = { date: "N/A", bytes: 0 };

    sortedDays.forEach((day) => {
      totalDl += day.download;
      totalUl += day.upload;
      if (day.total > maxDay.bytes) {
        maxDay = { date: day.label, bytes: day.total };
      }
    });

    const totalB = totalDl + totalUl;
    const dailyAvg = sortedDays.length > 0 ? totalB / sortedDays.length : 0;

    // Day-over-Day calculation (compare last available day vs previous day)
    let dayChangePercent = 0;
    let isDayIncrease = true;
    if (sortedDays.length >= 2) {
      const latest = sortedDays[sortedDays.length - 1].total;
      const prev = sortedDays[sortedDays.length - 2].total;
      if (prev > 0) {
        const diff = ((latest - prev) / prev) * 100;
        dayChangePercent = Math.abs(Math.round(diff * 10) / 10);
        isDayIncrease = diff >= 0;
      }
    }

    // Projected Monthly calculation (daily average * 30 days)
    const projectedMonthlyGB = formatGB(dailyAvg * 30);

    // Format for Recharts
    const chartData = sortedDays.map((d) => ({
      name: d.label,
      dateStr: d.dateStr,
      DownloadGB: Number(formatGB(d.download)),
      UploadGB: Number(formatGB(d.upload)),
      TotalGB: Number(formatGB(d.total)),
      rawDownload: d.download,
      rawUpload: d.upload,
      rawTotal: d.total,
      sessions: d.count,
    }));

    const pie = [
      { name: "Download", value: totalDl, color: "#06b6d4" },
      { name: "Upload", value: totalUl, color: "#6366f1" },
    ];

    return {
      dailyData: chartData,
      pieData: pie,
      metrics: {
        totalBytes: totalB,
        downloadBytes: totalDl,
        uploadBytes: totalUl,
        dayChangePercent,
        isDayIncrease,
        dailyAverageBytes: dailyAvg,
        peakDay: maxDay,
        projectedMonthlyGB,
      },
    };
  }, [sessions, filterPeriod]);

  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
      payload: {
        rawDownload: number;
        rawUpload: number;
        rawTotal: number;
        sessions: number;
      };
    }>;
    label?: string;
  }

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md text-xs space-y-1.5 min-w-[160px]">
          <p className="font-bold text-foreground flex items-center gap-1.5 border-b border-border/50 pb-1">
            <Calendar className="size-3.5 text-cyan-500" />
            {label}
          </p>
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between gap-3 text-cyan-600 dark:text-cyan-400 font-medium">
              <span>Download:</span>
              <span className="font-bold font-mono">{formatBytes(data.rawDownload)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-indigo-600 dark:text-indigo-400 font-medium">
              <span>Upload:</span>
              <span className="font-bold font-mono">{formatBytes(data.rawUpload)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-foreground font-bold border-t border-border/40 pt-1">
              <span>Total:</span>
              <span className="font-mono">{formatBytes(data.rawTotal)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground pt-0.5 text-right">
              {data.sessions} session{data.sessions > 1 ? "s" : ""}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* METRIC HIGHLIGHT CARDS (Day & Month Changes) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Day-over-Day Change */}
        <div className="rounded-2xl border border-border/80 bg-card/85 p-3.5 sm:p-5 backdrop-blur-xl shadow-lg spectra-glow">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Day-over-Day
            </p>
            <div
              className={cn(
                "inline-flex items-center gap-0.5 sm:gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-bold",
                metrics.isDayIncrease
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              )}
            >
              {metrics.isDayIncrease ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {metrics.dayChangePercent}%
            </div>
          </div>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-black text-foreground">
            {metrics.isDayIncrease ? "+" : "-"}{metrics.dayChangePercent}%
          </p>
          <p className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
            vs previous day
          </p>
        </div>

        {/* Daily Average Usage */}
        <div className="rounded-2xl border border-border/80 bg-card/85 p-3.5 sm:p-5 backdrop-blur-xl shadow-lg spectra-glow">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Daily Avg
            </p>
            <Activity className="size-3.5 sm:size-4 text-cyan-500 shrink-0" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-black text-foreground font-mono truncate">
            {formatBytes(metrics.dailyAverageBytes)}
          </p>
          <p className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
            Average per active day
          </p>
        </div>

        {/* Peak Usage Day */}
        <div className="rounded-2xl border border-border/80 bg-card/85 p-3.5 sm:p-5 backdrop-blur-xl shadow-lg spectra-glow">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Peak Day
            </p>
            <Zap className="size-3.5 sm:size-4 text-indigo-500 shrink-0" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-black text-foreground font-mono truncate">
            {formatBytes(metrics.peakDay.bytes)}
          </p>
          <p className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
            {metrics.peakDay.date}
          </p>
        </div>

        {/* Projected Monthly Usage */}
        <div className="rounded-2xl border border-border/80 bg-card/85 p-3.5 sm:p-5 backdrop-blur-xl shadow-lg spectra-glow">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Projected
            </p>
            <TrendingUp className="size-3.5 sm:size-4 text-cyan-500 shrink-0" />
          </div>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-black text-foreground font-mono">
            {metrics.projectedMonthlyGB} <span className="text-xs text-muted-foreground font-sans">GB</span>
          </p>
          <p className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground truncate">
            30-day run rate
          </p>
        </div>
      </div>

      {/* GRAPH CONTAINER CARD */}
      <div className="rounded-2xl border border-border/80 bg-card/85 p-6 backdrop-blur-xl shadow-xl spectra-glow space-y-6">
        {/* HEADER CONTROLS */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BarChart3 className="size-5 text-cyan-500" />
              Bandwidth Analytics & Trends
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Daily data consumption breakdown and traffic distribution
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Filter */}
            <div className="inline-flex rounded-xl border border-border/80 bg-background/60 p-1 shadow-sm">
              <button
                onClick={() => setFilterPeriod("month")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  filterPeriod === "month"
                    ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {monthName}
              </button>
              <button
                onClick={() => setFilterPeriod("all")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  filterPeriod === "all"
                    ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All History
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-xl border border-border/80 bg-background/60 p-1 shadow-sm">
              <button
                onClick={() => setViewMode("bar")}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === "bar"
                    ? "bg-card text-cyan-500 shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Daily Bar Graph"
              >
                <BarChart3 className="size-4" />
              </button>
              <button
                onClick={() => setViewMode("area")}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === "area"
                    ? "bg-card text-cyan-500 shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Cumulative Trend"
              >
                <TrendingUp className="size-4" />
              </button>
              <button
                onClick={() => setViewMode("pie")}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  viewMode === "pie"
                    ? "bg-card text-cyan-500 shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Traffic Ratio Pie Chart"
              >
                <PieChartIcon className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* CHART DISPLAY AREA */}
        {dailyData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-sm">
            <Activity className="size-8 text-muted-foreground/40 mb-2 animate-pulse" />
            No chart data available for the selected period.
          </div>
        ) : (
          <div className="w-full pt-2">
            {viewMode === "bar" && (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cyanBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id="indigoBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "currentColor" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "currentColor" }} tickLine={false} axisLine={false} unit=" GB" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar dataKey="DownloadGB" name="Download (GB)" fill="url(#cyanBar)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="UploadGB" name="Upload (GB)" fill="url(#indigoBar)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {viewMode === "area" && (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "currentColor" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "currentColor" }} tickLine={false} axisLine={false} unit=" GB" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Area type="monotone" dataKey="DownloadGB" name="Download (GB)" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#totalGradient)" />
                    <Area type="monotone" dataKey="UploadGB" name="Upload (GB)" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#uploadGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {viewMode === "pie" && (
              <div className="h-72 w-full flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="h-64 w-64 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: unknown) => formatBytes(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Pie Stat */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Bandwidth</span>
                    <span className="text-lg font-black text-foreground font-mono">{formatBytes(metrics.totalBytes)}</span>
                  </div>
                </div>

                <div className="space-y-4 max-w-xs w-full">
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-3.5 rounded-full bg-cyan-500" />
                      <span className="text-sm font-semibold text-foreground">Download</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-cyan-600 dark:text-cyan-400">
                      {formatBytes(metrics.downloadBytes)}
                    </span>
                  </div>

                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-3.5 rounded-full bg-indigo-500" />
                      <span className="text-sm font-semibold text-foreground">Upload</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      {formatBytes(metrics.uploadBytes)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
