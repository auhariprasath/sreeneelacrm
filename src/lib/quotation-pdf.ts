import { jsPDF } from "jspdf";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";

interface LineItem { name: string; price: number; quantity: number }
interface AddonItem { name: string; price: number }

export interface QuotationPdfInput {
  company: {
    name: string;
    address?: string | null;
    email?: string | null;
    wa_number?: string | null;
    gstin?: string | null;
    upi_id?: string | null;
    bank_account?: string | null;
    ifsc?: string | null;
    logo_url?: string | null;
    cancellation_policy?: string | null;
  };
  client: { name: string; phone?: string | null };
  event: {
    type?: string | null;
    date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    venue?: string | null;
    guest_count?: number | null;
  };
  quotation: {
    number?: string | null;
    version: number;
    services: LineItem[];
    addons: AddonItem[];
    subtotal: number;
    discount_percent: number;
    discount_amount: number;
    gst_applied: boolean;
    gst_percent: number;
    gst_amount: number;
    total: number;
    created_at: string;
  };
}

export function generateQuotationPdf(input: QuotationPdfInput): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;

  const line = (yy: number) => { doc.setDrawColor(220); doc.line(M, yy, pageW - M, yy); };
  const ensure = (need: number) => { if (y + need > pageH - M) { doc.addPage(); y = M; } };

  // Header
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text(input.company.name, M, y); y += 18;
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(110);
  const headerLines = [
    input.company.address,
    [input.company.wa_number && `WA: ${input.company.wa_number}`, input.company.email].filter(Boolean).join("  •  "),
    input.company.gstin && `GSTIN: ${input.company.gstin}`,
  ].filter(Boolean) as string[];
  headerLines.forEach((l) => { doc.text(l, M, y); y += 12; });

  // Title block right
  doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("QUOTATION", pageW - M, M, { align: "right" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(110);
  doc.text(`${input.quotation.number || "Draft"}  •  v${input.quotation.version}`, pageW - M, M + 14, { align: "right" });
  doc.text(`Date: ${formatDateIN(input.quotation.created_at)}`, pageW - M, M + 26, { align: "right" });

  y = Math.max(y, M + 60);
  line(y); y += 14;

  // Client + Event
  doc.setTextColor(20); doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("Bill to", M, y);
  doc.text("Event", pageW / 2, y);
  y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(input.client.name, M, y);
  doc.text(input.event.type || "—", pageW / 2, y);
  y += 12;
  if (input.client.phone) { doc.setTextColor(110); doc.text(input.client.phone, M, y); doc.setTextColor(20); }
  const ed = [
    input.event.date ? formatDateIN(input.event.date) : null,
    input.event.start_time ? formatTimeOfDay(input.event.start_time) : null,
    input.event.end_time ? `– ${formatTimeOfDay(input.event.end_time)}` : null,
  ].filter(Boolean).join(" ");
  if (ed) { doc.setTextColor(110); doc.text(ed, pageW / 2, y); doc.setTextColor(20); }
  y += 12;
  if (input.event.venue) { doc.setTextColor(110); doc.text(input.event.venue, pageW / 2, y); doc.setTextColor(20); y += 12; }
  if (input.event.guest_count) { doc.setTextColor(110); doc.text(`${input.event.guest_count} guests`, pageW / 2, y); doc.setTextColor(20); y += 12; }
  y += 8;
  line(y); y += 14;

  // Table header
  const colName = M;
  const colQty = pageW - M - 220;
  const colPrice = pageW - M - 120;
  const colAmt = pageW - M;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Item", colName, y);
  doc.text("Qty", colQty, y, { align: "right" });
  doc.text("Rate", colPrice, y, { align: "right" });
  doc.text("Amount", colAmt, y, { align: "right" });
  y += 8; line(y); y += 12;

  doc.setFont("helvetica", "normal");
  const drawRow = (name: string, qty: number, price: number) => {
    ensure(18);
    const nameLines = doc.splitTextToSize(name || "—", colQty - colName - 10);
    doc.text(nameLines, colName, y);
    doc.text(String(qty), colQty, y, { align: "right" });
    doc.text(formatINR(price), colPrice, y, { align: "right" });
    doc.text(formatINR(price * qty), colAmt, y, { align: "right" });
    y += Math.max(14, nameLines.length * 12);
  };

  input.quotation.services.forEach((s) => drawRow(s.name, Number(s.quantity) || 0, Number(s.price) || 0));
  if (input.quotation.addons.length) {
    ensure(20);
    y += 4; doc.setFont("helvetica", "bold"); doc.text("Add-ons", colName, y); doc.setFont("helvetica", "normal"); y += 12;
    input.quotation.addons.forEach((a) => drawRow(a.name, 1, Number(a.price) || 0));
  }

  y += 4; line(y); y += 14;

  // Totals
  const totRow = (label: string, value: string, bold = false) => {
    ensure(16);
    if (bold) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", "normal");
    doc.text(label, colPrice, y, { align: "right" });
    doc.text(value, colAmt, y, { align: "right" });
    y += 14;
  };
  totRow("Subtotal", formatINR(input.quotation.subtotal));
  if (input.quotation.discount_amount > 0) {
    totRow(`Discount (${input.quotation.discount_percent.toFixed(1)}%)`, `− ${formatINR(input.quotation.discount_amount)}`);
  }
  if (input.quotation.gst_applied) totRow(`GST (${input.quotation.gst_percent}%)`, formatINR(input.quotation.gst_amount));
  y += 4; line(y); y += 14;
  totRow("Total", formatINR(input.quotation.total), true);

  // Notes line (no bank details on this clean format)
  y += 14;
  ensure(40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
  doc.text("Payment details will be shared on confirmation.", M, y); y += 12;
  doc.setTextColor(20);

  // Cancellation policy
  if (input.company.cancellation_policy) {
    y += 10; ensure(40);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Cancellation policy", M, y); y += 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80);
    const lines = doc.splitTextToSize(input.company.cancellation_policy, pageW - M * 2);
    lines.forEach((l: string) => { ensure(12); doc.text(l, M, y); y += 12; });
    doc.setTextColor(20);
  }

  // Green acceptance box at bottom of last page
  const boxH = 78;
  if (y + boxH > pageH - M - 30) { doc.addPage(); y = M; }
  y = Math.max(y + 16, pageH - M - boxH - 24);
  doc.setFillColor(220, 247, 226);
  doc.setDrawColor(34, 153, 84);
  doc.roundedRect(M, y, pageW - M * 2, boxH, 8, 8, "FD");
  doc.setTextColor(20, 83, 45);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Ready to confirm?", M + 14, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const accept = `Reply "AGREED" on WhatsApp${input.company.wa_number ? ` to ${input.company.wa_number}` : ""} to lock your date and proceed with booking.`;
  const acceptLines = doc.splitTextToSize(accept, pageW - M * 2 - 28);
  doc.text(acceptLines, M + 14, y + 42);
  doc.setTextColor(20);

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`${input.company.name} • Quotation ${input.quotation.number || ""} v${input.quotation.version}`, M, pageH - 18);
    doc.text(`Page ${i} of ${pages}`, pageW - M, pageH - 18, { align: "right" });
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
