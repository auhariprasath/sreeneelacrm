import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { formatDateIN } from "@/lib/format";
import { cn } from "@/lib/utils";

const feedbackSearchSchema = z.object({
  rating: fallback(z.coerce.number().int().min(1).max(5).optional(), undefined),
  company: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/feedback")({
  component: FeedbackPage,
  validateSearch: zodValidator(feedbackSearchSchema),
});

interface Row {
  id: string;
  rating: number;
  comments: string | null;
  created_at: string;
  booking_id: string;
  lead_id: string | null;
  full_name: string;
  event_date: string | null;
}

function FeedbackPage() {
  const { role, profile, activeCompanyId } = useAuth();
  const { rating, company } = Route.useSearch();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const companyFilter = useMemo(() => {
    if (company) return company;
    if (role === "super_admin") return activeCompanyId;
    return profile?.company_id ?? null;
  }, [company, role, activeCompanyId, profile]);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("feedback")
      .select("id, rating, comments, created_at, booking_id, bookings!inner(company_id, lead_id, event_date, leads(full_name))")
      .order("created_at", { ascending: false })
      .limit(200);
    if (rating) q = q.eq("rating", rating);
    if (companyFilter) q = q.eq("bookings.company_id", companyFilter);
    const { data } = await q;
    setRows(
      ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        rating: r.rating,
        comments: r.comments,
        created_at: r.created_at,
        booking_id: r.booking_id,
        lead_id: r.bookings?.lead_id ?? null,
        full_name: r.bookings?.leads?.full_name ?? "—",
        event_date: r.bookings?.event_date ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyFilter, rating]);
  useDashboardRealtime(["feedback", "bookings"], load);

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-semibold">Feedback</h1>
        <div className="text-xs text-muted-foreground">{rows.length} result{rows.length === 1 ? "" : "s"}</div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        <Link
          to="/feedback"
          search={(prev: any) => ({ ...prev, rating: undefined })}
          className={cn("text-xs rounded-full px-3 py-1.5 border whitespace-nowrap min-h-9",
            !rating ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-accent")}
        >All</Link>
        {[5, 4, 3, 2, 1].map((n) => (
          <Link
            key={n}
            to="/feedback"
            search={(prev: any) => ({ ...prev, rating: n })}
            className={cn("text-xs rounded-full px-3 py-1.5 border whitespace-nowrap min-h-9 inline-flex items-center gap-1",
              rating === n ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-accent")}
          >
            {n}<Star className="h-3 w-3" />
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No feedback{rating ? ` with ${rating}★` : ""} yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {r.lead_id ? (
                    <Link to="/leads/$leadId" params={{ leadId: r.lead_id }} className="hover:underline">{r.full_name}</Link>
                  ) : r.full_name}
                </CardTitle>
                <Badge variant="secondary" className="inline-flex items-center gap-1">{r.rating}<Star className="h-3 w-3" /></Badge>
              </CardHeader>
              <CardContent className="text-sm">
                {r.comments && <p className="mb-2">{r.comments}</p>}
                <div className="text-xs text-muted-foreground">
                  {r.event_date ? `Event ${formatDateIN(r.event_date)} · ` : ""}Submitted {formatDateIN(r.created_at)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
