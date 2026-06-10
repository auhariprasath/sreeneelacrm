import { jsPDF } from "jspdf";
import { formatINRPdf, formatDateIN, formatTimeOfDay } from "@/lib/format";

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
    duration_hours?: number | null;
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

// Brand palette matching web UI
const PURPLE: [number, number, number] = [83, 74, 183];
const PURPLE_LIGHT: [number, number, number] = [245, 244, 252];
const PURPLE_BORDER: [number, number, number] = [200, 196, 235];
const GREEN: [number, number, number] = [22, 163, 74];
const GREEN_BG: [number, number, number] = [220, 252, 231];
const TEXT: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const BORDER: [number, number, number] = [226, 232, 240];
const SECTION_BG: [number, number, number] = [248, 250, 252];

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
  return policy.split(/\r?\n|•|•|;|(?:^|\s)\d+[.)]\s+/).map((l) => l.trim()).filter(Boolean).slice(0, max);
}

export async function generateQuotationPdf(input: QuotationPdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 36;           // page margin
  const CW = pageW - M * 2; // content width
  let y = M;

  // Add page background + card white bg
  const initPage = () => {
    // Light grey page background
    doc.setFillColor(...SECTION_BG);
    doc.rect(0, 0, pageW, pageH, "F");
    // White card surface
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M - 8, M - 8, CW + 16, pageH - M * 2 + 16, 8, 8, "F");
  };
  initPage();

  const ensure = (need: number) => {
    if (y + need > pageH - M - 16) {
      doc.addPage();
      initPage();
      y = M + 8;
    }
  };

  // Horizontal divider
  const divider = (dy = 0) => {
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.5);
    doc.line(M, y + dy, M + CW, y + dy);
  };

  // Dashed line between rows (matches web border-dashed)
  const dashedLine = (lx: number, rx: number, ly: number) => {
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.4);
    const seg = 3; const gap = 3;
    for (let x = lx; x < rx; x += seg + gap) {
      doc.line(x, ly, Math.min(x + seg, rx), ly);
    }
  };

  // ── HEADER ───────────────────────────────────────────────────────
  const headerBgH = 70;
  doc.setFillColor(...PURPLE_LIGHT);
  doc.roundedRect(M - 8, M - 8, CW + 16, headerBgH, 8, 8, "F");
  // Only round top corners — square the bottom
  doc.setFillColor(...PURPLE_LIGHT);
  doc.rect(M - 8, M - 8 + headerBgH / 2, CW + 16, headerBgH / 2, "F");

  // Logo or initial
  const logoSize = 40;
  if (input.company.logo_url) {
    const img = await loadImage(input.company.logo_url);
    if (img) {
      const ratio = img.w / img.h;
      const lw = Math.min(100, logoSize * ratio);
      try { doc.addImage(img.dataUrl, "PNG", M, y, lw, logoSize); } catch { /* skip */ }
    }
  } else {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, y, logoSize, logoSize, 6, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...PURPLE);
    doc.text(input.company.name.charAt(0).toUpperCase(), M + logoSize / 2, y + logoSize / 2 + 7, { align: "center" });
  }

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...TEXT);
  doc.text(input.company.name, M + logoSize + 10, y + 14);
  if (input.company.address) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
    const addrLines = doc.splitTextToSize(input.company.address, 160);
    doc.text(addrLines.slice(0, 2), M + logoSize + 10, y + 26);
  }

  // Right: title + number
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...PURPLE);
  doc.text("QUOTATION", M + CW, y + 16, { align: "right" });

  const qNum = input.quotation.number ? `#${input.quotation.number}` : "Draft";
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
  doc.text(`${qNum}  ·  v${input.quotation.version}`, M + CW, y + 30, { align: "right" });
  doc.text(`Issued ${formatDateIN(input.quotation.created_at)}`, M + CW, y + 42, { align: "right" });

  // Valid pill
  const validDays = input.validDays ?? 7;
  const pillTxt = `✓  Valid for ${validDays} days`;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  const pillW = doc.getTextWidth(pillTxt) + 14;
  const pillX = M + CW - pillW; const pillY = y + 50;
  doc.setFillColor(...GREEN_BG); doc.setDrawColor(...GREEN); doc.setLineWidth(0.5);
  doc.roundedRect(pillX, pillY, pillW, 15, 7, 7, "FD");
  doc.setTextColor(...GREEN);
  doc.text(pillTxt, pillX + pillW / 2, pillY + 10, { align: "center" });

  y += headerBgH + 12;

  // ── CLIENT + EVENT ────────────────────────────────────────────────
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
  doc.text("PREPARED FOR", M, y);
  y += 12;

  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...TEXT);
  doc.text(input.client.name, M, y);
  y += 16;

  if (input.client.phone) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...MUTED);
    doc.text(input.client.phone, M, y);
    y += 14;
  }

  // Event pills
  const pills: string[] = [];
  if (input.event.type) pills.push(input.event.type);
  if (input.event.date) pills.push(formatDateIN(input.event.date));
  if (input.event.start_time) {
    const tt = input.event.end_time
      ? `${formatTimeOfDay(input.event.start_time)} – ${formatTimeOfDay(input.event.end_time)}`
      : formatTimeOfDay(input.event.start_time);
    pills.push(tt);
  }
  if (input.event.guest_count) pills.push(`${input.event.guest_count} guests`);
  if (input.event.duration_hours) pills.push(`${input.event.duration_hours}h`);
  if (input.event.venue) pills.push(input.event.venue);

  if (pills.length) {
    y += 2;
    let px = M;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    for (const t of pills) {
      const pw = doc.getTextWidth(t) + 14;
      if (px + pw > M + CW) break;
      doc.setFillColor(...PURPLE_LIGHT); doc.setDrawColor(...PURPLE_BORDER); doc.setLineWidth(0.4);
      doc.roundedRect(px, y, pw, 16, 8, 8, "FD");
      doc.setTextColor(...PURPLE);
      doc.text(t, px + pw / 2, y + 11, { align: "center" });
      px += pw + 5;
    }
    y += 22;
  }

  y += 10;
  divider();
  y += 14;

  // ── SERVICES ──────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
  doc.text("SERVICES", M, y);
  y += 12;

  if (input.quotation.services.length === 0) {
    doc.setFontSize(9.5); doc.setTextColor(...MUTED);
    doc.text("No services listed.", M, y);
    y += 16;
  }

  input.quotation.services.forEach((item, idx) => {
    const qty = Number(item.quantity) || 1;
    const rate = Number(item.price) || 0;
    const amount = qty * rate;
    const nameW = CW - 95;
    const nameLines = doc.splitTextToSize(item.name || "—", nameW);
    const descLines = item.description ? doc.splitTextToSize(item.description, nameW) : [];
    const rowH = nameLines.length * 13 + descLines.length * 11 + 14;
    ensure(rowH + 6);

    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...TEXT);
    doc.text(nameLines, M, y + 11);

    if (descLines.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
      doc.text(descLines, M, y + 11 + nameLines.length * 13);
    }

    // Qty × rate (muted, right of name)
    if (qty > 1) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
      doc.text(`${qty} × ${formatINRPdf(rate)}`, M + CW - 88, y + 11, { align: "left" });
    }

    // Amount (right-aligned, bold)
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...TEXT);
    doc.text(formatINRPdf(amount), M + CW, y + 11, { align: "right" });

    y += rowH;

    if (idx < input.quotation.services.length - 1) {
      dashedLine(M, M + CW, y);
      y += 6;
    }
  });

  // ── ADD-ONS ───────────────────────────────────────────────────────
  if (input.quotation.addons.length > 0) {
    y += 10;
    divider();
    y += 14;

    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text("ADD-ONS", M, y);
    y += 12;

    input.quotation.addons.forEach((item, idx) => {
      const qty = Number(item.quantity ?? 1) || 1;
      const rate = Number(item.price) || 0;
      const amount = qty * rate;
      const nameW = CW - 95;
      const nameLines = doc.splitTextToSize(item.name || "—", nameW);
      const rowH = nameLines.length * 13 + 14;
      ensure(rowH + 6);

      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...TEXT);
      doc.text(nameLines, M, y + 11);

      const qtyLabel = qty > 1
        ? `${qty}${item.unit ? " " + item.unit : ""} × ${formatINRPdf(rate)}`
        : item.unit || "";
      if (qtyLabel) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
        doc.text(qtyLabel, M + CW - 88, y + 11, { align: "left" });
      }

      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...TEXT);
      doc.text(formatINRPdf(amount), M + CW, y + 11, { align: "right" });

      y += rowH;

      if (idx < input.quotation.addons.length - 1) {
        dashedLine(M, M + CW, y);
        y += 6;
      }
    });
  }

  // ── PRICING ───────────────────────────────────────────────────────
  y += 14;
  divider();
  y += 14;

  const pRow = (label: string, value: string, color: [number, number, number] = MUTED) => {
    ensure(18);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...color);
    doc.text(label, M + CW - 130, y, { align: "right" });
    doc.setTextColor(...(color === MUTED ? TEXT : color));
    doc.text(value, M + CW, y, { align: "right" });
    y += 16;
  };

  pRow("Subtotal", formatINRPdf(input.quotation.subtotal));
  if (input.quotation.discount_amount > 0) {
    pRow(
      `Discount${input.quotation.discount_percent > 0 ? ` (${input.quotation.discount_percent.toFixed(1)}%)` : ""}`,
      `− ${formatINRPdf(input.quotation.discount_amount)}`,
      GREEN,
    );
  }
  if (input.quotation.gst_applied) {
    pRow(`GST (${input.quotation.gst_percent}%)`, formatINRPdf(input.quotation.gst_amount));
  }

  // Divider before total
  y += 2;
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.5);
  doc.line(M + CW - 160, y, M + CW, y);
  y += 6;

  // Total bar — matches web's purple highlight
  ensure(30);
  doc.setFillColor(...PURPLE_LIGHT);
  doc.roundedRect(M + CW - 200, y - 4, 205, 28, 5, 5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...PURPLE);
  doc.text("Total", M + CW - 140, y + 14, { align: "right" });
  doc.text(formatINRPdf(input.quotation.total), M + CW, y + 14, { align: "right" });
  y += 36;

  // ── CONFIRMATION BOX ──────────────────────────────────────────────
  y += 6;
  const confMsg = `Reply "AGREED" on WhatsApp${input.company.wa_number ? ` to ${input.company.wa_number}` : ""} to confirm your booking. Payment details will be shared on confirmation.`;
  const confLines = doc.splitTextToSize(confMsg, CW - 28);
  const confBoxH = 20 + confLines.length * 13 + 10;
  ensure(confBoxH + 8);
  doc.setFillColor(...GREEN_BG); doc.setDrawColor(...GREEN); doc.setLineWidth(0.5);
  doc.roundedRect(M, y, CW, confBoxH, 8, 8, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(21, 128, 61);
  doc.text("Ready to confirm?", M + 14, y + 15);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(22, 101, 52);
  doc.text(confLines, M + 14, y + 28);
  y += confBoxH + 14;

  // ── TERMS ────────────────────────────────────────────────────────
  const terms = extractTerms(input.company.cancellation_policy, 5);
  if (terms.length) {
    ensure(20 + terms.length * 14);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...TEXT);
    doc.text("Terms & Conditions", M, y);
    y += 13;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
    terms.forEach((t, i) => {
      const wrapped = doc.splitTextToSize(`${i + 1}.  ${t}`, CW);
      wrapped.forEach((l: string) => { ensure(13); doc.text(l, M, y); y += 13; });
    });
    y += 4;
  }

  // ── SIGNATURE ────────────────────────────────────────────────────
  ensure(48);
  y += 8;
  const sigX = M + CW - 180;
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.5);
  doc.line(sigX, y, M + CW, y);
  doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
  doc.text("Authorised Signatory", sigX, y + 13);
  if (input.authorisedBy) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...TEXT);
    doc.text(input.authorisedBy, sigX, y - 5);
  }
  y += 24;

  // ── CARD BORDER + FOOTER on every page ───────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const isLast = p === pages;
    const startY = p === 1 ? M - 8 : M - 8;
    const endY = isLast ? y + 8 : pageH - M + 8;
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.7);
    doc.roundedRect(M - 8, startY, CW + 16, endY - startY, 8, 8, "S");

    doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
    doc.text(
      `${input.company.name}  ·  Quotation ${input.quotation.number ? "#" + input.quotation.number : "Draft"}  ·  v${input.quotation.version}`,
      M, pageH - 12,
    );
    doc.text(`Page ${p} / ${pages}`, M + CW, pageH - 12, { align: "right" });
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
