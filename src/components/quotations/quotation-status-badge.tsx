import type { Database } from "@/integrations/supabase/types";

type Quotation = Database["public"]["Tables"]["quotations"]["Row"];

interface Props {
  quotation: Pick<
    Quotation,
    "status" | "viewed_at" | "approved_at" | "agreed_at" | "sent_at"
  >;
  /** Optional expiry window in days from sent_at — defaults to 7. */
  expiryDays?: number;
  className?: string;
}

/** Derives a friendlier display label/color from the raw quotation row.
 *  Display priority: Expired > Approved > Changes requested > Revised > Viewed > Sent > Draft. */
export function QuotationStatusBadge({ quotation, expiryDays = 7, className = "" }: Props) {
  const { label, tone } = derive(quotation, expiryDays);
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 font-medium ${tone} ${className}`}
    >
      {label}
    </span>
  );
}

export function deriveQuotationDisplayStatus(q: Props["quotation"], expiryDays = 7) {
  return derive(q, expiryDays).label;
}

function derive(q: Props["quotation"], expiryDays: number): { label: string; tone: string } {
  const ageMs = q.sent_at ? Date.now() - new Date(q.sent_at).getTime() : 0;
  const isExpired = q.status === "sent" && !q.viewed_at && !q.approved_at && !q.agreed_at && ageMs > expiryDays * 86_400_000;

  if (isExpired) {
    return { label: "Expired", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" };
  }
  if (q.status === "agreed" || q.approved_at || q.agreed_at) {
    return { label: "Approved", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
  }
  if (q.status === "declined") {
    return { label: "Changes requested", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
  }
  if (q.status === "revised") {
    return { label: "Revised", tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300" };
  }
  if (q.viewed_at) {
    return { label: "Viewed", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" };
  }
  if (q.status === "sent" || q.sent_at) {
    return { label: "Sent", tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" };
  }
  return { label: "Draft", tone: "bg-muted text-muted-foreground" };
}
