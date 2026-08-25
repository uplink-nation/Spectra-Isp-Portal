import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Customer, Invoice } from "@/types/portal";

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function generateInvoicePdf({
  customer,
  invoice,
}: {
  customer: Customer;
  invoice: Invoice;
}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Top Decorative Brand Bar
  doc.setFillColor(6, 182, 212); // Cyan 500
  doc.rect(0, 0, pageWidth, 5, "F");

  // 2. Company Brand & Tax Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text("SPECTRA FIBER BROADBAND", 14, 18);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text("Spectra Broadband Networks Pvt. Ltd.", 14, 23);
  doc.text("GSTIN: 07AABCS1429P1Z8 | CIN: U72900DL2010PTC204910", 14, 27);
  doc.text("NOC & Billing: Level 4, Cyber City, Bangalore - 560103", 14, 31);
  doc.text("Support: 1800-SPECTRA | support@spectra.co", 14, 35);

  // 3. Invoice Header Box (Right-aligned)
  const isPaid = invoice.status === "paid";
  doc.setFillColor(isPaid ? 240 : 254, isPaid ? 253 : 243, isPaid ? 244 : 199);
  doc.setDrawColor(isPaid ? 34 : 245, isPaid ? 197 : 158, isPaid ? 94 : 11);
  doc.roundedRect(pageWidth - 78, 12, 64, 26, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(isPaid ? 22 : 180, isPaid ? 101 : 83, isPaid ? 52 : 9);
  doc.text(isPaid ? "TAX INVOICE [PAID]" : "TAX INVOICE [DUE]", pageWidth - 74, 19);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(`Invoice No: ${invoice.invoice_number}`, pageWidth - 74, 24);
  doc.text(`Issue Date: ${invoice.issue_date}`, pageWidth - 74, 29);
  doc.text(`Due Date: ${invoice.due_date}`, pageWidth - 74, 34);

  // Horizontal Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 40, pageWidth - 14, 40);

  // 4. Subscriber & Billing Info Dual Grid
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 44, pageWidth - 28, 30, 2, 2, "F");

  // Left Column: Billed To
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("BILLED TO (SUBSCRIBER)", 18, 51);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Subscriber Name: ${customer.name}`, 18, 57);
  doc.text(`PPPoE Account: ${customer.pppoe_username}`, 18, 63);
  doc.text(`Account ID: ${customer.id.substring(0, 18)}...`, 18, 69);

  // Right Column: Service & Billing Cycle
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("SERVICE & BILLING DETAILS", pageWidth / 2 + 10, 51);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Plan: ${invoice.plan_name}`, pageWidth / 2 + 10, 57);
  doc.text(`Period: ${invoice.period_start} to ${invoice.period_end}`, pageWidth / 2 + 10, 63);
  doc.text(`SAC Code: 998422 (Internet Telecommunication)`, pageWidth / 2 + 10, 69);

  // 5. Line Items AutoTable
  const tableData = [
    [
      "1",
      `High-Speed Fiber Broadband Subscription\n${invoice.plan_name} (Symmetric Speed Unlimited)`,
      "998422",
      "1 Month",
      formatINR(Number(invoice.base_amount)),
      formatINR(Number(invoice.base_amount)),
    ],
  ];

  autoTable(doc, {
    startY: 80,
    head: [["#", "Item Description & Service Period", "SAC", "Qty", "Rate", "Amount"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [14, 116, 144], // Cyan 700
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 85 },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // Calculate position after table
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // 6. Tax Breakdown Summary Table (Right Side)
  const taxSummaryStartY = finalY + 6;
  const rightBoxX = pageWidth - 95;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightBoxX, taxSummaryStartY, 81, 40, 2, 2, "F");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  doc.text("Plan Base Charge:", rightBoxX + 4, taxSummaryStartY + 7);
  doc.text(formatINR(Number(invoice.base_amount)), pageWidth - 18, taxSummaryStartY + 7, { align: "right" });

  doc.text("CGST (9.00%):", rightBoxX + 4, taxSummaryStartY + 14);
  doc.text(formatINR(Number(invoice.cgst_amount)), pageWidth - 18, taxSummaryStartY + 14, { align: "right" });

  doc.text("SGST (9.00%):", rightBoxX + 4, taxSummaryStartY + 21);
  doc.text(formatINR(Number(invoice.sgst_amount)), pageWidth - 18, taxSummaryStartY + 21, { align: "right" });

  doc.setDrawColor(203, 213, 225);
  doc.line(rightBoxX + 4, taxSummaryStartY + 25, pageWidth - 18, taxSummaryStartY + 25);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Total Invoice Amount:", rightBoxX + 4, taxSummaryStartY + 33);
  doc.setTextColor(14, 116, 144);
  doc.text(formatINR(Number(invoice.total_amount)), pageWidth - 18, taxSummaryStartY + 33, { align: "right" });

  // 7. Payment Information (Left Side Box)
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, taxSummaryStartY, rightBoxX - 18, 40, 2, 2, "F");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("PAYMENT INFORMATION", 18, taxSummaryStartY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Payment Status: ${invoice.status.toUpperCase()}`, 18, taxSummaryStartY + 14);
  doc.text(`Method: ${invoice.payment_method || "Online UPI / Auto-Debit"}`, 18, taxSummaryStartY + 20);
  if (invoice.transaction_ref) {
    doc.text(`Transaction Ref: ${invoice.transaction_ref}`, 18, taxSummaryStartY + 26);
  }
  if (invoice.paid_at) {
    doc.text(`Paid Date: ${invoice.paid_at}`, 18, taxSummaryStartY + 32);
  } else {
    doc.text(`Payment Due By: ${invoice.due_date}`, 18, taxSummaryStartY + 32);
  }

  // 8. Terms & Bank Details Footer
  const footerStartY = taxSummaryStartY + 48;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerStartY, pageWidth - 14, footerStartY);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("TERMS & CONDITIONS", 14, footerStartY + 5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(
    "1. This is a computer-generated tax invoice and requires no physical signature under Indian IT Act 2000.",
    14,
    footerStartY + 9
  );
  doc.text(
    "2. High-speed broadband service is subject to Fair Usage Policy (FUP) and Spectra Terms of Service.",
    14,
    footerStartY + 13
  );
  doc.text(
    "3. For billing disputes or payment confirmation inquiries, please reach out via portal or email billing@spectra.co.",
    14,
    footerStartY + 17
  );

  // Watermark for PAID stamp
  if (isPaid) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GStateConstructor = (doc as any).GState;
    if (GStateConstructor) {
      doc.setGState(new GStateConstructor({ opacity: 0.08 }));
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(54);
    doc.setTextColor(16, 185, 129); // Emerald 500
    doc.text("PAID & SETTLED", pageWidth / 2, 165, {
      align: "center",
      angle: 25,
    });
    if (GStateConstructor) {
      doc.setGState(new GStateConstructor({ opacity: 1 }));
    }
  }

  // Bottom brand banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, pageHeight - 10, pageWidth, 10, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text("Spectra Fiber Broadband — Ultra-Fast Fiber Internet Portal", 14, pageHeight - 4);
  doc.text("www.spectra.co | 24x7 NOC Helpdesk", pageWidth - 14, pageHeight - 4, { align: "right" });

  doc.save(`${invoice.invoice_number}_Spectra_Invoice.pdf`);
}
