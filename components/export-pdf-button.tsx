"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";

type UsageSession = {
  id: string | number;
  session_started_at: string | null;
  session_ended_at: string | null;
  download_bytes: number | string | null;
  upload_bytes: number | string | null;
  total_bytes: number | string | null;
};

interface ExportPdfButtonProps {
  customerName: string;
  pppoeUsername: string;
  monthName: string;
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
  sessions: UsageSession[];
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  showIconOnly?: boolean;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Active session";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toBytes(val: number | string | null) {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
}

export function ExportPdfButton({
  customerName,
  pppoeUsername,
  monthName,
  downloadBytes,
  uploadBytes,
  totalBytes,
  sessions,
  variant = "outline",
  size = "sm",
  className,
  showIconOnly = false,
}: ExportPdfButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePdf = async () => {
    try {
      setIsGenerating(true);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Brand Header Top Bar
      doc.setFillColor(6, 182, 212); // Cyan 500
      doc.rect(0, 0, pageWidth, 5, "F");

      // Title & Header Branding
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text("SPECTRA FIBER BROADBAND", 14, 18);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text("Official Subscriber Data Usage Statement", 14, 23);

      // Generated timestamp right-aligned
      const generatedAt = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });
      doc.setFontSize(8);
      doc.text(`Generated: ${generatedAt}`, pageWidth - 14, 18, { align: "right" });
      doc.text(`Status: VERIFIED ACTIVE`, pageWidth - 14, 23, { align: "right" });

      // Divider Line
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(0.5);
      doc.line(14, 27, pageWidth - 14, 27);

      // Subscriber Profile Box
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.roundedRect(14, 31, pageWidth - 28, 26, 3, 3, "F");

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text("SUBSCRIBER DETAILS", 18, 37);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(`Customer Name: ${customerName}`, 18, 44);
      doc.text(`PPPoE Account: ${pppoeUsername}`, 18, 50);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text("BILLING DETAILS", pageWidth / 2 + 10, 37);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(`Billing Period: ${monthName}`, pageWidth / 2 + 10, 44);
      doc.text(`Total Sessions Logged: ${sessions.length}`, pageWidth / 2 + 10, 50);

      // Summary Cards Table
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Monthly Usage Summary", 14, 65);

      const summaryData = [
        ["Total Data Consumed", formatBytes(totalBytes)],
        ["Download Consumption", formatBytes(downloadBytes)],
        ["Upload Consumption", formatBytes(uploadBytes)],
      ];

      autoTable(doc, {
        startY: 68,
        head: [["Metric", "Consumed Bandwidth"]],
        body: summaryData,
        theme: "grid",
        headStyles: {
          fillColor: [14, 116, 144], // Cyan 700
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [241, 245, 249],
        },
        margin: { left: 14, right: 14 },
      });

      // Detailed Sessions Table
      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Detailed Fiber Sessions Log", 14, finalY);

      const sessionRows = sessions.map((session, index) => {
        const download = toBytes(session.download_bytes);
        const upload = toBytes(session.upload_bytes);
        const storedTotal = toBytes(session.total_bytes);
        const total = storedTotal > 0 ? storedTotal : download + upload;

        return [
          `${index + 1}`,
          formatDate(session.session_ended_at ?? session.session_started_at),
          formatBytes(download),
          formatBytes(upload),
          formatBytes(total),
        ];
      });

      autoTable(doc, {
        startY: finalY + 4,
        head: [["#", "Session Date & Time", "Download", "Upload", "Total Bandwidth"]],
        body: sessionRows,
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59], // Slate 800
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85],
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 65 },
          2: { cellWidth: 35, halign: "right" },
          3: { cellWidth: 35, halign: "right" },
          4: { cellWidth: 35, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });

      // Page numbers footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);

        doc.text(
          `Page ${i} of ${totalPages} - Spectra Fiber Portal Official Record`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      }

      // Save PDF
      const sanitizedUsername = pppoeUsername.replace(/[^a-zA-Z0-9_-]/g, "_");
      const sanitizedMonth = monthName.replace(/[^a-zA-Z0-9_-]/g, "_");
      doc.save(`Spectra_Usage_Statement_${sanitizedUsername}_${sanitizedMonth}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF statement:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={generatePdf}
      disabled={isGenerating}
      className={cn(
        "rounded-lg border border-cyan-500/30 bg-cyan-500/10 font-semibold text-xs text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all duration-200 gap-1.5 shadow-sm",
        className
      )}
    >
      {isGenerating ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          {!showIconOnly && <span>Preparing PDF...</span>}
        </>
      ) : (
        <>
          <Download className="size-3.5 text-cyan-500" />
          {!showIconOnly && <span>Export PDF</span>}
        </>
      )}
    </Button>
  );
}
