import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  listAllCompanies, createCompany, renameCompany, archiveCompany,
} from "@/lib/api/companies.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Archive, ArchiveRestore, Pencil, Settings2, ArrowRight, Building2 } from "lucide-react";
import { SkeletonList } from "@/components/skeleton-list";
import { CompanyDetailsDialog } from "@/components/settings/company-details-dialog";

type CompanyType = "garden_venue" | "banquet_hall" | "party_hall" | "mandapam" | "other";
interface Row {
  id: string;
  name: string;
  type: CompanyType;
  deleted_at: string | null;
}

export function CompaniesSection({ onChange }: { onChange?: () => void }) {
  const list = useServerFn(listAllCompanies);
  const create = useServerFn(createCompany);
  const rename = useServerFn(renameCompany);
  const archive = useServerFn(archiveCompany);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<CompanyType>("banquet_hall");
  const [customType, setCustomType] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await list();
      setRows(data as Row[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    try {
      await create({ data: { name: name.trim(), type, custom_type: type === "other" ? customType.trim() || null : null } });
      toast.success("Company added");
      setOpen(false); setName(""); setType("banquet_hall"); setCustomType("");
      await load(); onChange?.();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const saveRename = async () => {
    if (!editId || !editName.trim()) return;
    try {
      await rename({ data: { id: editId, name: editName.trim() } });
      toast.success("Renamed");
      setEditId(null); setEditName("");
      await load(); onChange?.();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const toggleArchive = async (r: Row) => {
    try {
      await archive({ data: { id: r.id, archive: !r.deleted_at } });
      toast.success(r.deleted_at ? "Restored" : "Archived");
      await load(); onChange?.();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {rows.filter((r) => !r.deleted_at).length} active, {rows.filter((r) => r.deleted_at).length} archived
        </div>
        <Button onClick={() => setOpen(true)} className="min-h-11">
          <Plus className="h-4 w-4 mr-1" /> Add company
        </Button>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : rows.length === 0 ? (
        <div className="border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
          No companies yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => (
            <div key={r.id} className="border rounded-xl p-4 bg-card flex flex-col gap-3 hover:border-foreground/20 transition-colors">
              {editId === r.id ? (
                <div className="flex items-center gap-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10" autoFocus />
                  <Button size="sm" onClick={saveRename} className="min-h-10">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditId(null); setEditName(""); }} className="min-h-10">Cancel</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] capitalize">{r.type}</Badge>
                        {r.deleted_at && <Badge variant="destructive" className="text-[10px]">Archived</Badge>}
                      </div>
                    </div>
                  </div>
                  {!r.deleted_at && (
                    <Button asChild className="w-full min-h-10">
                      <Link to="/company-settings/$companyId" params={{ companyId: r.id }}>
                        Open settings <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  )}
                  <div className="flex gap-1.5 flex-wrap">
                    <Button variant="outline" size="sm" className="flex-1 min-h-9"
                      onClick={() => setDetailsId(r.id)}>
                      <Settings2 className="h-3.5 w-3.5 mr-1" /> Quick edit
                    </Button>
                    <Button variant="outline" size="sm" className="min-h-9"
                      onClick={() => { setEditId(r.id); setEditName(r.name); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant={r.deleted_at ? "default" : "outline"} size="sm" className="min-h-9"
                      onClick={() => toggleArchive(r)}>
                      {r.deleted_at ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add company</DialogTitle>
            <DialogDescription>This new company will appear in all per-company settings and dropdowns.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Company name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Neela Gardens" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as CompanyType)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="banquet">Banquet</SelectItem>
                  <SelectItem value="garden">Garden</SelectItem>
                  <SelectItem value="mandapam">Mandapam</SelectItem>
                  <SelectItem value="party">Party</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy} className="min-h-11">Cancel</Button>
            <Button onClick={submit} disabled={busy} className="min-h-11">{busy ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CompanyDetailsDialog
        companyId={detailsId}
        open={detailsId !== null}
        onOpenChange={(v) => { if (!v) setDetailsId(null); }}
        onSaved={() => { load(); onChange?.(); }}
      />
    </div>
  );
}
