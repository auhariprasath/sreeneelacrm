import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";

export interface InvoicePdfInput {
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
  invoice: {
    number: string;
    issued_at: string;
    due_date?: string | null;
    subtotal: number;
    discount_amount: number;
    gst_amount: number;
    total: number;
    amount_paid?: number;
    balance_due?: number;
  };
  issuedBy?: string | null;
}

const PURPLE: [number, number, number] = [83, 74, 183];        // #534AB7
const PURPLE_DARK: [number, number, number] = [42, 35, 110];
const PURPLE_LIGHT: [number, number, number] = [238, 236, 250];
const TEXT: [number, number, number] = [20, 20, 28];
const MUTED: [number, number, number] = [110, 110, 120];
const GREY_BG: [number, number, number] = [244, 244, 248];

async function loadImage(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve({ w: img.width, h: img.height }); img.onerror = reject; img.src = dataUrl;
    });
    return { dataUrl, w: dims.w, h: dims.h };
  } catch { return null; }
}

function buildUpiUri(upiId: string, name: string, amount: number, note: string) {
  const p = new URLSearchParams({ pa: upiId, pn: name, am: amount.toFixed(2), cu: "INR", tn: note });
  return `upi://pay?${p.toString()}`;
}

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;

  // 1. Full-width purple header
  const headerH = 130;
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, pageW, headerH, "F");

  // Logo (white background pill so any logo reads on purple)
  let logoOffsetX = M;
  if (input.company.logo_url) {
    const img = await loadImage(input.company.logo_url);
    if (img) {
      const h = 38; const w = Math.min(120, h * (img.w / img.h));
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M - 4, 24, w + 8, h + 8, 6, 6, "F");
      try { doc.addImage(img.dataUrl, "PNG", M, 28, w, h); } catch { /* ignore */ }
      logoOffsetX = M + w + 16;
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text(input.company.name, logoOffsetX, 44);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  if (input.company.gstin) doc.text(`GSTIN ${input.company.gstin}`, logoOffsetX, 60);

  // Right side: invoice meta
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text("INVOICE", pageW - M, 44, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`# ${input.invoice.number}`, pageW - M, 62, { align: "right" });
  if (input.invoice.due_date) {
    doc.text(`Due ${formatDateIN(input.invoice.due_date)}`, pageW - M, 78, { align: "right" });
  }

  // Client strip bottom of header
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("BILLED TO", M, 100);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(input.client.name, M, 118);
  if (input.client.phone) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(input.client.phone, M + doc.getTextWidth(input.client.name) + 14, 118);
  }

  let y = headerH + 18;

  // 2. Light grey event strip
  const stripH = 38;
  doc.setFillColor(...GREY_BG); doc.roundedRect(M, y, pageW - M * 2, stripH, 6, 6, "F");
  const evPills: string[] = [];
  if (input.event.date) evPills.push(formatDateIN(input.event.date));
  if (input.event.start_time) {
    const t = input.event.end_time
      ? `${formatTimeOfDay(input.event.start_time)} – ${formatTimeOfDay(input.event.end_time)}`
      : formatTimeOfDay(input.event.start_time);
    evPills.push(t);
  }
  if (input.event.guest_count) evPills.push(`${input.event.guest_count} guests`);
  if (input.event.venue) evPills.push(input.event.venue);
  if (input.event.type) evPills.push(input.event.type);

  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  let px = M + 12; const py = y + 11;
  evPills.forEach((t) => {
    const w = doc.getTextWidth(t) + 16;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(220, 218, 240);
    doc.roundedRect(px, py, w, 18, 9, 9, "FD");
    doc.setTextColor(...PURPLE_DARK); doc.text(t, px + w / 2, py + 12, { align: "center" });
    px += w + 6;
  });
  y += stripH + 16;

  // 3. Light purple amount section with QR
  const amtH = 130;
  doc.setFillColor(...PURPLE_LIGHT); doc.roundedRect(M, y, pageW - M * 2, amtH, 10, 10, "F");
  doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("AMOUNT DUE", M + 20, y + 24);
  doc.setTextColor(...PURPLE_DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(32);
  const amountDue = input.invoice.balance_due ?? input.invoice.total;
  doc.text(formatINR(amountDue), M + 20, y + 60);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...MUTED);
  if (input.invoice.amount_paid && input.invoice.amount_paid > 0) {
    doc.text(`Paid ${formatINR(input.invoice.amount_paid)} of ${formatINR(input.invoice.total)}`, M + 20, y + 78);
  }
  if (input.invoice.due_date) {
    doc.setTextColor(...PURPLE_DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(`Pay by ${formatDateIN(input.invoice.due_date)}`, M + 20, y + 100);
  }

  // QR right side
  if (input.company.upi_id && amountDue > 0) {
    const uri = buildUpiUri(input.company.upi_id, input.company.name, amountDue, `Invoice ${input.invoice.number}`);
    try {
      const qrData = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
      const qrSize = 100;
      const qrX = pageW - M - qrSize - 16;
      const qrY = y + (amtH - qrSize) / 2;
      doc.setFillColor(255, 255, 255); doc.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 6, 6, "F");
      doc.addImage(qrData, "PNG", qrX, qrY, qrSize, qrSize);
      doc.setFontSize(8); doc.setTextColor(...PURPLE_DARK);
      doc.text("Scan to pay (UPI)", qrX + qrSize / 2, qrY + qrSize + 14, { align: "center" });
    } catch { /* ignore */ }
  }
  y += amtH + 16;

  // 4. Two payment cards
  const cardW = (pageW - M * 2 - 14) / 2;
  const cardH = 110;

  // Bank transfer card
  doc.setDrawColor(220, 218, 240); doc.setFillColor(255, 255, 255);
  doc.roundedRect(M, y, cardW, cardH, 8, 8, "FD");
  doc.setTextColor(...MUTED); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("BANK TRANSFER", M + 14, y + 20);
  doc.setTextColor(...TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  let by = y + 38;
  const bankRow = (label: string, val?: string | null) => {
    if (!val) return;
    doc.setTextColor(...MUTED); doc.setFontSize(8); doc.text(label, M + 14, by);
    doc.setTextColor(...TEXT); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(val, M + 14, by + 12);
    doc.setFont("helvetica", "normal");
    by += 24;
  };
  bankRow("Account holder", input.company.name);
  bankRow("Account number", input.company.bank_account);
  bankRow("IFSC", input.company.ifsc);
  if (!input.company.bank_account) {
    doc.setTextColor(...MUTED); doc.setFontSize(9);
    doc.text("Bank details available on request.", M + 14, y + 40);
  }

  // UPI card
  const upiX = M + cardW + 14;
  doc.setDrawColor(220, 218, 240); doc.setFillColor(...PURPLE_LIGHT);
  doc.roundedRect(upiX, y, cardW, cardH, 8, 8, "FD");
  doc.setTextColor(...PURPLE_DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("UPI", upiX + 14, y + 20);
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...PURPLE);
  if (input.company.upi_id) {
    const idLines = doc.splitTextToSize(input.company.upi_id, cardW - 28);
    doc.text(idLines, upiX + 14, y + 50);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text("Tap any UPI app · scan the QR above", upiX + 14, y + 90);
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...MUTED);
    doc.text("UPI not configured.", upiX + 14, y + 50);
  }
  y += cardH + 18;

  // 5. Three numbered after-you-pay steps
  doc.setTextColor(...TEXT); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("After you pay", M, y); y += 14;
  const steps = [
    "Share the payment screenshot or UTR with us on WhatsApp.",
    "We will reconcile and send a payment receipt within 24 hours.",
    "Your booking moves to confirmed and the event team takes over.",
  ];
  const stepH = 38;
  steps.forEach((text, i) => {
    const sy = y + i * stepH;
    // circle
    doc.setFillColor(...PURPLE); doc.circle(M + 12, sy + 10, 10, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(String(i + 1), M + 12, sy + 14, { align: "center" });
    doc.setTextColor(...TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, pageW - M * 2 - 36);
    doc.text(lines, M + 32, sy + 10);
  });
  y += steps.length * stepH + 10;

  // 6. Amount breakdown right-aligned
  const colLabel = pageW - M - 180;
  const colVal = pageW - M;
  const row = (label: string, value: string, opts: { bold?: boolean; color?: [number, number, number]; size?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    doc.setTextColor(...(opts.color ?? TEXT));
    doc.text(label, colLabel, y, { align: "right" });
    doc.text(value, colVal, y, { align: "right" });
    y += (opts.size ?? 10) + 6;
  };
  row("Subtotal", formatINR(input.invoice.subtotal));
  if (input.invoice.discount_amount > 0) row("Discount", `− ${formatINR(input.invoice.discount_amount)}`, { color: [34, 153, 84] });
  if (input.invoice.gst_amount > 0) row("GST", formatINR(input.invoice.gst_amount));
  y += 2;
  row("Total", formatINR(input.invoice.total), { bold: true });
  if (input.invoice.amount_paid && input.invoice.amount_paid > 0) {
    row("Paid", `− ${formatINR(input.invoice.amount_paid)}`, { color: [34, 153, 84] });
    row("Balance due", formatINR(input.invoice.balance_due ?? 0), { bold: true, color: PURPLE, size: 12 });
  }

  // 7. Footer
  const footerY = pageH - M - 4;
  doc.setDrawColor(230); doc.line(M, footerY - 28, pageW - M, footerY - 28);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...PURPLE_DARK);
  doc.text("Thank you for your business.", M, footerY - 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
  if (input.issuedBy) {
    doc.text(`Issued by ${input.issuedBy}`, pageW - M, footerY - 12, { align: "right" });
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
