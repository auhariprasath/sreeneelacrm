import { jsPDF } from "jspdf";
import { formatINR, formatINRPdf, formatDateIN, formatTimeOfDay } from "@/lib/format";

interface LineItem { name: string; price: number; quantity: number; description?: string | null }
interface AddonItem { name: string; price: number; quantity?: number; unit?: string | null; description?: string | null }

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
  authorisedBy?: string | null;
  validDays?: number;
}

// Brand colors (Lovable purple + green accent)
const PURPLE: [number, number, number] = [83, 74, 183];      // #534AB7
const PURPLE_DARK: [number, number, number] = [60, 52, 145];
const GREEN: [number, number, number] = [34, 153, 84];
const GREEN_BG: [number, number, number] = [220, 247, 226];
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

function extractTerms(policy?: string | null, max = 5): string[] {
  if (!policy) return [];
  const lines = policy.split(/\r?\n|•|\u2022|;|(?:^|\s)\d+[.)]\s+/).map((l) => l.trim()).filter(Boolean);
  return lines.slice(0, max);
}

export async function generateQuotationPdf(input: QuotationPdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;
  const ensure = (need: number) => { if (y + need > pageH - M - 24) { doc.addPage(); y = M; } };

  // 1. Logo top-left
  const logoH = 42;
  if (input.company.logo_url) {
    const img = await loadImage(input.company.logo_url);
    if (img) {
      const ratio = img.w / img.h;
      const w = Math.min(140, logoH * ratio);
      try { doc.addImage(img.dataUrl, "PNG", M, y, w, logoH); } catch { /* ignore */ }
    }
  }
  // Company name below logo (small muted)
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...TEXT);
  doc.text(input.company.name, M, y + logoH + 14);

  // 2. Title top-right
  doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(...PURPLE);
  doc.text("Quotation", pageW - M, y + 18, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...MUTED);
  const qNum = `${input.quotation.number || "Draft"} · v${input.quotation.version}`;
  doc.text(qNum, pageW - M, y + 34, { align: "right" });
  doc.text(`Issued ${formatDateIN(input.quotation.created_at)}`, pageW - M, y + 48, { align: "right" });

  // Green valid pill
  const validDays = input.validDays ?? 7;
  const pillText = `Valid for ${validDays} days`;
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  const pillW = doc.getTextWidth(pillText) + 18;
  const pillX = pageW - M - pillW; const pillY = y + 56;
  doc.setFillColor(...GREEN_BG); doc.setDrawColor(...GREEN);
  doc.roundedRect(pillX, pillY, pillW, 18, 9, 9, "FD");
  doc.setTextColor(...GREEN); doc.text(pillText, pillX + pillW / 2, pillY + 12, { align: "center" });

  y = Math.max(y + logoH + 22, y + 82);

  // 3. Purple divider
  doc.setDrawColor(...PURPLE); doc.setLineWidth(1.5);
  doc.line(M, y, pageW - M, y);
  doc.setLineWidth(0.5);
  y += 18;

  // 4. Client left, event pills right
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
  doc.text("BILL TO", M, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...TEXT);
  doc.text(input.client.name, M, y + 16);
  if (input.client.phone) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...MUTED);
    doc.text(input.client.phone, M, y + 30);
  }

  // Event pills (right)
  const pills: string[] = [];
  if (input.event.date) pills.push(formatDateIN(input.event.date));
  if (input.event.start_time) {
    const tt = input.event.end_time
      ? `${formatTimeOfDay(input.event.start_time)} – ${formatTimeOfDay(input.event.end_time)}`
      : formatTimeOfDay(input.event.start_time);
    pills.push(tt);
  }
  if (input.event.guest_count) pills.push(`${input.event.guest_count} guests`);
  if (input.event.type) pills.push(input.event.type);

  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  let px = pageW - M; const py = y + 6;
  for (let i = pills.length - 1; i >= 0; i--) {
    const t = pills[i]; const w = doc.getTextWidth(t) + 16;
    px -= w;
    doc.setFillColor(245, 244, 252); doc.setDrawColor(220, 218, 240);
    doc.roundedRect(px, py, w, 20, 10, 10, "FD");
    doc.setTextColor(...PURPLE_DARK); doc.text(t, px + w / 2, py + 13, { align: "center" });
    px -= 6;
  }

  y += 50;

  // 5. Services table
  const colName = M;
  const colQty = pageW - M - 240;
  const colPrice = pageW - M - 110;
  const colAmt = pageW - M;

  doc.setFillColor(...PURPLE); doc.rect(M, y, pageW - M * 2, 22, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Service", colName + 10, y + 14);
  doc.text("Qty", colQty, y + 14, { align: "right" });
  doc.text("Rate", colPrice, y + 14, { align: "right" });
  doc.text("Amount", colAmt - 10, y + 14, { align: "right" });
  y += 30;

  doc.setTextColor(...TEXT);
  const drawRow = (item: { name: string; price: number; quantity: number; description?: string | null }) => {
    const nameLines = doc.splitTextToSize(item.name || "—", colQty - colName - 20);
    const descLines = item.description
      ? doc.splitTextToSize(item.description, colQty - colName - 20)
      : [];
    const rowH = nameLines.length * 13 + descLines.length * 11 + 8;
    ensure(rowH + 4);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...TEXT);
    doc.text(nameLines, colName + 10, y + 10);
    if (descLines.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
      doc.text(descLines, colName + 10, y + 10 + nameLines.length * 13);
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...TEXT);
    doc.text(String(item.quantity), colQty, y + 10, { align: "right" });
    doc.text(formatINRPdf(item.price), colPrice, y + 10, { align: "right" });
    doc.text(formatINRPdf(item.price * item.quantity), colAmt - 10, y + 10, { align: "right" });
    y += rowH;
    doc.setDrawColor(235, 235, 240); doc.line(M, y, pageW - M, y);
    y += 4;
  };
  input.quotation.services.forEach(drawRow);

  // 6. Add-ons table (separate, only if present)
  if (input.quotation.addons.length) {
    y += 10; ensure(40);
    doc.setFillColor(...GREY_BG); doc.rect(M, y, pageW - M * 2, 22, "F");
    doc.setTextColor(...PURPLE_DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Add-ons", colName + 10, y + 14);
    doc.text("Amount", colAmt - 10, y + 14, { align: "right" });
    y += 30;
    input.quotation.addons.forEach((a) => drawRow({ name: a.name, price: Number(a.price) || 0, quantity: 1, description: a.description }));
  }

  // 7. Totals right-aligned
  y += 8; ensure(80);
  const totRow = (label: string, value: string, opts: { color?: [number, number, number]; bold?: boolean; size?: number } = {}) => {
    ensure(18);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    doc.setTextColor(...(opts.color ?? TEXT));
    doc.text(label, colPrice, y + 10, { align: "right" });
    doc.text(value, colAmt - 10, y + 10, { align: "right" });
    y += (opts.size ?? 10) + 8;
  };
  totRow("Subtotal", formatINRPdf(input.quotation.subtotal));
  if (input.quotation.discount_amount > 0) {
    totRow(`Discount (${input.quotation.discount_percent.toFixed(1)}%)`, `− ${formatINRPdf(input.quotation.discount_amount)}`, { color: GREEN });
  }
  if (input.quotation.gst_applied) {
    totRow(`GST (${input.quotation.gst_percent}%)`, formatINRPdf(input.quotation.gst_amount));
  }
  // Total bar
  y += 4;
  doc.setFillColor(245, 244, 252); doc.rect(colQty - 10, y, pageW - M - (colQty - 10), 28, "F");
  totRow("Total", formatINRPdf(input.quotation.total), { color: PURPLE, bold: true, size: 14 });
  y += 6;

  // 8. Green acceptance box (NO bank details)
  ensure(80);
  y += 10;
  const boxH = 70;
  doc.setFillColor(...GREEN_BG); doc.setDrawColor(...GREEN);
  doc.roundedRect(M, y, pageW - M * 2, boxH, 10, 10, "FD");
  doc.setTextColor(20, 83, 45); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Ready to confirm?", M + 16, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const accept = `Reply "AGREED" on WhatsApp${input.company.wa_number ? ` to ${input.company.wa_number}` : ""} to lock your date. Payment details will be shared on confirmation.`;
  const aLines = doc.splitTextToSize(accept, pageW - M * 2 - 32);
  doc.text(aLines, M + 16, y + 40);
  y += boxH + 16;

  // 9. Terms (max 5)
  const terms = extractTerms(input.company.cancellation_policy, 5);
  if (terms.length) {
    ensure(20 + terms.length * 12);
    doc.setTextColor(...TEXT); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Terms & conditions", M, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80);
    terms.forEach((t, i) => {
      const wrapped = doc.splitTextToSize(`${i + 1}. ${t}`, pageW - M * 2);
      wrapped.forEach((l: string) => { ensure(12); doc.text(l, M, y); y += 12; });
    });
    doc.setTextColor(...TEXT);
  }

  // 10. Authorised-by footer with signature line
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    if (i === pages) {
      const sigY = pageH - M - 40;
      const sigX = pageW - M - 180;
      doc.setDrawColor(180); doc.line(sigX, sigY, pageW - M, sigY);
      doc.setFontSize(9); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
      doc.text("Authorised signatory", sigX, sigY + 12);
      if (input.authorisedBy) {
        doc.setFont("helvetica", "bold"); doc.setTextColor(...TEXT);
        doc.text(input.authorisedBy, sigX, sigY - 6);
      }
    }
    doc.setFontSize(8); doc.setTextColor(150); doc.setFont("helvetica", "normal");
    doc.text(`${input.company.name} · Quotation ${input.quotation.number || ""} v${input.quotation.version}`, M, pageH - 18);
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
