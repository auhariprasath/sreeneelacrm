import type { Database } from "@/integrations/supabase/types";

type Quotation = Database["public"]["Tables"]["quotations"]["Row"];

interface Props {
  quotation: Pick<
    Quotation,
    "status" | "viewed_at" | "approved_at" | "agreed_at" | "sent_at" | "valid_until"
  > & { expired_at?: string | null };
  className?: string;
}

/** Derives a friendlier display label/color from the raw quotation row.
 *  Display priority: Expired > Approved > Changes requested > Revised > Viewed > Sent > Draft. */
export function QuotationStatusBadge({ quotation, className = "" }: Props) {
  const { label, tone } = derive(quotation);
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 font-medium ${tone} ${className}`}
    >
      {label}
    </span>
  );
}

export function deriveQuotationDisplayStatus(q: Props["quotation"]) {
  return derive(q).label;
}

function derive(q: Props["quotation"]): { label: string; tone: string } {
  // Expired — either explicit flag/column or past valid_until
  const explicitExpired = (q as any).expired_at != null;
  const pastValidity = q.valid_until ? new Date(q.valid_until) < new Date() : false;
  if (explicitExpired || (pastValidity && q.status !== "agreed")) {
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
