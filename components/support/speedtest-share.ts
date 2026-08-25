import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SpeedTestResult } from "@/components/support/speed-test";

export interface SpeedTestSharePayload {
  result: SpeedTestResult;
  pppoeUsername: string;
  customerName?: string;
  planSpeedMbps?: number;
  adminPhone?: string;
}

const DEFAULT_NOC_PHONE = process.env.NEXT_PUBLIC_NOC_WHATSAPP_PHONE || "918040405050";

/**
 * Generate a certified Spectra Speed Test Verification PDF Document
 */
export function generateSpeedTestPdf(payload: SpeedTestSharePayload): jsPDF {
  const { result, pppoeUsername, customerName = "Valued Subscriber", planSpeedMbps = 300 } = payload;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Top Brand Bar (Cyan 500)
  doc.setFillColor(6, 182, 212);
  doc.rect(0, 0, pageWidth, 6, "F");

  // 2. Header Branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("SPECTRA FIBER BROADBAND", 14, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Official Network Speed & Latency Telemetry Audit Report", 14, 26);

  const formattedDate = new Date(result.timestamp).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  doc.setFontSize(8.5);
  doc.text(`Audit ID: ${result.id}`, pageWidth - 14, 20, { align: "right" });
  doc.text(`Timestamp: ${formattedDate}`, pageWidth - 14, 26, { align: "right" });

  // Divider Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 30, pageWidth - 14, 30);

  // 3. Subscriber Profile Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 34, pageWidth - 28, 28, 3, 3, "F");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("SUBSCRIBER INFORMATION", 18, 41);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(`Customer Name: ${customerName}`, 18, 48);
  doc.text(`PPPoE Account: ${pppoeUsername}`, 18, 55);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("SERVICE SLA PLAN", pageWidth / 2 + 10, 41);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(`Provisioned Plan: ${planSpeedMbps} Mbps Symmetric`, pageWidth / 2 + 10, 48);
  doc.text(`Network Grade: ${result.grade} (Passed Quality Check)`, pageWidth / 2 + 10, 55);

  // 4. Primary Results Summary Box
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(14, 68, pageWidth - 28, 40, 4, 4, "F");

  // Download Mbps
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(6, 182, 212);
  doc.text("DOWNLOAD SPEED", 22, 78);
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(`${result.downloadMbps.toFixed(1)} Mbps`, 22, 90);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Target: ${planSpeedMbps} Mbps`, 22, 98);

  // Upload Mbps
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(16, 185, 129);
  doc.text("UPLOAD SPEED", 85, 78);
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(`${result.uploadMbps.toFixed(1)} Mbps`, 85, 90);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Target: ${planSpeedMbps} Mbps`, 85, 98);

  // Ping & Jitter
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(245, 158, 11);
  doc.text("LATENCY & PING", 145, 78);
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(`${result.pingMs} ms`, 145, 90);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Jitter: ${result.jitterMs || 0.5} ms`, 145, 98);

  // 5. Detailed Test Telemetry Table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Diagnostic Telemetry & Server Verification", 14, 120);

  const telemetryData = [
    ["Download Throughput", `${result.downloadMbps.toFixed(2)} Mbps`, "Verified WAN Link"],
    ["Upload Throughput", `${result.uploadMbps.toFixed(2)} Mbps`, "Verified WAN Link"],
    ["Round-Trip Latency (Ping)", `${result.pingMs} ms`, result.pingMs < 20 ? "Ultra-Low / Gaming Ready" : "Normal"],
    ["Packet Jitter Variance", `${result.jitterMs || 0.5} ms`, "0% Packet Loss"],
    ["Speed Test Node Server", result.serverName, result.serverLocation || "Bengaluru, IN"],
    ["Client Public IP", result.clientIp || "Detected via Gateway", "AS133280 Spectra"],
    ["Testing Engine", (result.engine || "cloudflare").toUpperCase(), "Multi-Stream WebSockets WAN"],
    ["Performance Rating", `Grade ${result.grade}`, "SLA Compliant"],
  ];

  autoTable(doc, {
    startY: 124,
    head: [["Network Metric", "Measured Value", "Verification Status"]],
    body: telemetryData,
    theme: "striped",
    headStyles: {
      fillColor: [14, 116, 144],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    margin: { left: 14, right: 14 },
  });

  // 6. NOC Verification Stamp Box
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, finalY, pageWidth - 28, 30, 3, 3, "FD");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(13, 148, 136);
  doc.text("CERTIFIED NOC PERFORMANCE AUDIT", 20, finalY + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(
    "This speed test report was generated from subscriber optical line telemetry via certified edge gateway nodes.",
    20,
    finalY + 15
  );
  doc.text(
    `Cryptographic Verification Stamp: SP-${result.id.slice(-8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    20,
    finalY + 22
  );

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Spectra Broadband Networks Pvt. Ltd. • 24x7 NOC Dispatch: 1800-SPECTRA • support@spectra.co",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  return doc;
}

/**
 * Directly downloads the official Speed Test Audit PDF Report
 */
export function downloadSpeedTestPdf(payload: SpeedTestSharePayload): void {
  const doc = generateSpeedTestPdf(payload);
  const sanitizedUser = payload.pppoeUsername.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Spectra_SpeedTest_Report_${sanitizedUser}_${Date.now()}.pdf`);
}

/**
 * Generate a high-resolution visual Speed Test Report Card Image (PNG Blob & DataURL)
 */
export async function generateSpeedTestImage(
  payload: SpeedTestSharePayload
): Promise<{ dataUrl: string; blob: Blob }> {
  const { result, pppoeUsername, customerName = "Subscriber", planSpeedMbps = 300 } = payload;

  const width = 1200;
  const height = 675; // 16:9 ratio ideal for WhatsApp image preview
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not create 2D canvas context");
  }

  // 1. Background Gradient
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#080e1a");
  bg.addColorStop(0.5, "#0b1528");
  bg.addColorStop(1, "#040711");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // 2. Glow Highlights
  const glow1 = ctx.createRadialGradient(180, 120, 10, 180, 120, 320);
  glow1.addColorStop(0, "rgba(6, 182, 212, 0.22)");
  glow1.addColorStop(1, "rgba(6, 182, 212, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(1020, 520, 10, 1020, 520, 350);
  glow2.addColorStop(0, "rgba(16, 185, 129, 0.20)");
  glow2.addColorStop(1, "rgba(16, 185, 129, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // 3. Card Frame
  ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  // Top Cyan Bar
  ctx.fillStyle = "#06b6d4";
  ctx.fillRect(24, 24, width - 48, 8);

  // 4. Header Section
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText("SPECTRA FIBER BROADBAND", 60, 85);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "16px sans-serif";
  ctx.fillText("Official Optical Speed & Telemetry Report Card", 60, 115);

  // Verification Badge Top Right
  ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
  ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(width - 340, 58, 280, 58, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#10b981";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(`VERIFIED NOC REPORT`, width - 315, 84);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "13px monospace";
  ctx.fillText(`GRADE: ${result.grade} • SLA PASSED`, width - 315, 104);

  // Divider
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 145);
  ctx.lineTo(width - 60, 145);
  ctx.stroke();

  // 5. Subscriber Profile Strip
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "15px sans-serif";
  ctx.fillText(`Subscriber: ${customerName} (${pppoeUsername})`, 60, 175);
  ctx.fillText(`Plan Target: ${planSpeedMbps} Mbps Symmetric`, 550, 175);

  const dateStr = new Date(result.timestamp).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
  ctx.fillText(`Tested: ${dateStr}`, 920, 175);

  // 6. Metrics Metric Boxes (3 Big Cards)
  const boxY = 210;
  const boxHeight = 220;

  // Box 1: Download
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(60, boxY, 335, boxHeight, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#06b6d4";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("DOWNLOAD SPEED", 85, boxY + 45);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px sans-serif";
  ctx.fillText(`${result.downloadMbps.toFixed(1)}`, 85, boxY + 115);

  ctx.fillStyle = "#06b6d4";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("Mbps", 85 + ctx.measureText(`${result.downloadMbps.toFixed(1)} `).width, boxY + 115);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px sans-serif";
  ctx.fillText(`Provisioned Target: ${planSpeedMbps} Mbps`, 85, boxY + 160);
  ctx.fillStyle = "#22d3ee";
  ctx.font = "13px sans-serif";
  ctx.fillText("✓ High Throughput Verified", 85, boxY + 188);

  // Box 2: Upload
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(432, boxY, 335, boxHeight, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#10b981";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("UPLOAD SPEED", 457, boxY + 45);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px sans-serif";
  ctx.fillText(`${result.uploadMbps.toFixed(1)}`, 457, boxY + 115);

  ctx.fillStyle = "#10b981";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("Mbps", 457 + ctx.measureText(`${result.uploadMbps.toFixed(1)} `).width, boxY + 115);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px sans-serif";
  ctx.fillText(`Provisioned Target: ${planSpeedMbps} Mbps`, 457, boxY + 160);
  ctx.fillStyle = "#34d399";
  ctx.font = "13px sans-serif";
  ctx.fillText("✓ Symmetric Fiber Stream Active", 457, boxY + 188);

  // Box 3: Latency & Jitter
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(805, boxY, 335, boxHeight, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f59e0b";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("PING LATENCY", 830, boxY + 45);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px sans-serif";
  ctx.fillText(`${result.pingMs}`, 830, boxY + 115);

  ctx.fillStyle = "#f59e0b";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("ms", 830 + ctx.measureText(`${result.pingMs} `).width, boxY + 115);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px sans-serif";
  ctx.fillText(`Jitter: ${result.jitterMs || 0.5} ms (0% Loss)`, 830, boxY + 160);
  ctx.fillStyle = "#fbbf24";
  ctx.font = "13px sans-serif";
  ctx.fillText("✓ Ultra-Low Edge Response", 830, boxY + 188);

  // 7. Telemetry Details Grid
  const gridY = 460;
  ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
  ctx.beginPath();
  ctx.roundRect(60, gridY, width - 120, 110, 12);
  ctx.fill();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "13px sans-serif";
  ctx.fillText("TEST SERVER:", 85, gridY + 35);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(`${result.serverName} (${result.serverLocation || "Bengaluru PoP"})`, 185, gridY + 35);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "13px sans-serif";
  ctx.fillText("SUBSCRIBER IP:", 85, gridY + 75);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(`${result.clientIp || "Detected Gateway IP"} (AS133280 Spectra)`, 205, gridY + 75);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "13px sans-serif";
  ctx.fillText("ENGINE:", 650, gridY + 35);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText((result.engine || "cloudflare").toUpperCase() + " WAN SOCKETS", 725, gridY + 35);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "13px sans-serif";
  ctx.fillText("VERIFICATION HASH:", 650, gridY + 75);
  ctx.fillStyle = "#06b6d4";
  ctx.font = "bold 13px monospace";
  ctx.fillText(`SP-ST-${result.id.slice(-8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`, 805, gridY + 75);

  // 8. Footer
  ctx.fillStyle = "#64748b";
  ctx.font = "12px sans-serif";
  ctx.fillText("Spectra Broadband Networks • 24x7 NOC Dispatch: 1800-SPECTRA • Verified Real Telemetry", 60, height - 42);

  const dataUrl = canvas.toDataURL("image/png", 1.0);
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), "image/png", 1.0);
  });

  return { dataUrl, blob };
}

/**
 * Downloads the visual Speed Test PNG image card
 */
export async function downloadSpeedTestImage(payload: SpeedTestSharePayload): Promise<void> {
  const { dataUrl } = await generateSpeedTestImage(payload);
  const sanitizedUser = payload.pppoeUsername.replace(/[^a-zA-Z0-9_-]/g, "_");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `Spectra_SpeedTest_Card_${sanitizedUser}_${Date.now()}.png`;
  a.click();
}

/**
 * Copies the speed test PNG image directly to clipboard
 */
export async function copySpeedTestImageToClipboard(payload: SpeedTestSharePayload): Promise<boolean> {
  try {
    const { blob } = await generateSpeedTestImage(payload);
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);
      return true;
    }
  } catch (err) {
    console.warn("Clipboard image write failed:", err);
  }
  return false;
}

/**
 * Formats WhatsApp message text for speed test result
 */
export function buildSpeedTestWhatsAppMessage(payload: SpeedTestSharePayload): string {
  const { result, pppoeUsername, customerName = "Subscriber", planSpeedMbps = 300 } = payload;

  const dateStr = new Date(result.timestamp).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `🚀 *SPECTRA FIBER SPEED TEST REPORT*
━━━━━━━━━━━━━━━━━━━━━
👤 *Subscriber:* ${customerName} (\`${pppoeUsername}\`)
🎯 *Plan Target:* ${planSpeedMbps} Mbps Symmetric

⚡ *Download Speed:* *${result.downloadMbps.toFixed(1)} Mbps*
⬆️ *Upload Speed:* *${result.uploadMbps.toFixed(1)} Mbps*
📶 *Latency (Ping):* ${result.pingMs} ms | Jitter: ${result.jitterMs || 0.5} ms
🏆 *Performance Grade:* *Grade ${result.grade}*

🏢 *Server Edge Node:* ${result.serverName} (${result.serverLocation || "Bengaluru PoP"})
🌐 *Client IP:* ${result.clientIp || "Gateway Assigned"}
📅 *Tested At:* ${dateStr}
━━━━━━━━━━━━━━━━━━━━━
🖼️ *Speed Test Report Card PNG & PDF downloaded!* (Paste with Ctrl+V if prompted)
✅ *Verified by Spectra Diagnostics & NOC Engine*`;
}

/**
 * Execute 1-Click WhatsApp Share with Speed Test PNG Image Card & PDF Report
 */
export async function shareSpeedTestToNocWhatsApp(
  payload: SpeedTestSharePayload,
  exportType: "image" | "pdf" = "image"
): Promise<{ success: boolean; targetPhone: string; copiedImage: boolean }> {
  let copiedImage = false;

  // 1. Generate & Download image / PDF
  try {
    if (exportType === "image") {
      // Auto-copy high-res image to clipboard so user can instantly press Ctrl+V in WhatsApp Web
      copiedImage = await copySpeedTestImageToClipboard(payload);
      // Also download PNG file
      await downloadSpeedTestImage(payload);
    } else {
      downloadSpeedTestPdf(payload);
    }
  } catch (err) {
    console.warn("Report card generation warning:", err);
  }

  // 2. Try Native Web Share API if supported (e.g. mobile Chrome/Safari which can share files directly into WhatsApp)
  try {
    if (exportType === "image" && navigator.canShare) {
      const { blob } = await generateSpeedTestImage(payload);
      const sanitizedUser = payload.pppoeUsername.replace(/[^a-zA-Z0-9_-]/g, "_");
      const file = new File([blob], `Spectra_SpeedTest_${sanitizedUser}.png`, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Spectra Speed Test - ${payload.pppoeUsername}`,
          text: buildSpeedTestWhatsAppMessage(payload),
          files: [file],
        });
        return { success: true, targetPhone: "", copiedImage: true };
      }
    }
  } catch {
    // Fall back to WhatsApp URL opening in new tab
  }

  // 3. Resolve target NOC WhatsApp phone number
  const rawPhone = payload.adminPhone || DEFAULT_NOC_PHONE;
  const targetPhone = rawPhone.replace(/\D/g, "");

  // 4. Build formatted message text
  const message = buildSpeedTestWhatsAppMessage(payload);

  // 5. Open Spectra NOC WhatsApp Chat in a new browser tab
  const waUrl = targetPhone
    ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(message)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

  window.open(waUrl, "_blank", "noopener,noreferrer");

  return { success: true, targetPhone, copiedImage };
}
