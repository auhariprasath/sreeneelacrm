import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Search, X } from "lucide-react";
import { formatPhoneIN } from "@/lib/format";
import { StatusBadge } from "@/components/leads/lead-badges";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

export function GlobalSearch() {
  const { profile, role, activeCompanyId } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const s = q.trim().replace(/'/g, "''");
      let req = supabase.from("leads").select("*")
        .is("deleted_at", null)
        .or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (role !== "super_admin" && profile?.company_id) {
        req = req.eq("company_id", profile.company_id);
      } else if (role === "super_admin" && activeCompanyId) {
        req = req.eq("company_id", activeCompanyId);
      }
      const { data } = await req;
      setResults((data as Lead[]) ?? []);
      setLoading(false);
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q, role, activeCompanyId, profile?.company_id]);

  const masked = profile?.phone_masked ?? false;

  return (
    <div ref={wrapRef} className="relative flex-1 max-w-md hidden md:block">
      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q && setOpen(true)}
        placeholder="Search leads by name or phone…"
        className="w-full h-10 pl-9 pr-9 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {q && (
        <button onClick={() => { setQ(""); setOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {open && (
        <div className="absolute top-full mt-1 inset-x-0 bg-popover border rounded-md shadow-lg z-50 max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="p-3 text-xs text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">No matches.</div>
          ) : (
            <ul className="divide-y">
              {results.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => {
                      navigate({ to: "/leads/$leadId", params: { leadId: l.id } });
                      setOpen(false); setQ("");
                    }}
                    className="w-full text-left p-3 hover:bg-accent flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{l.full_name}</div>
                      <div className="text-xs text-muted-foreground">{formatPhoneIN(l.phone, masked)}</div>
                    </div>
                    <StatusBadge status={l.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
