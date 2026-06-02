import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import { Plus, Archive, ArchiveRestore, Pencil, Settings2 } from "lucide-react";
import { SkeletonList } from "@/components/skeleton-list";
import { CompanyDetailsDialog } from "@/components/settings/company-details-dialog";

type CompanyType = "banquet" | "garden" | "mandapam" | "party";
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
  const [type, setType] = useState<CompanyType>("banquet");

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
      await create({ data: { name: name.trim(), type } });
      toast.success("Company added");
      setOpen(false); setName(""); setType("banquet");
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
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="border rounded-lg p-3 md:p-4 bg-card flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                {editId === r.id ? (
                  <div className="flex items-center gap-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10 w-64" autoFocus />
                    <Button size="sm" onClick={saveRename} className="min-h-10">Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditId(null); setEditName(""); }} className="min-h-10">Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.name}</span>
                    <Badge variant="secondary" className="text-[10px] capitalize">{r.type}</Badge>
                    {r.deleted_at && <Badge variant="destructive" className="text-[10px]">Archived</Badge>}
                  </div>
                )}
              </div>
              {editId !== r.id && (
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="min-h-10"
                    onClick={() => setDetailsId(r.id)}>
                    <Settings2 className="h-4 w-4 mr-1.5" /> Edit details
                  </Button>
                  <Button variant="outline" size="sm" className="min-h-10"
                    onClick={() => { setEditId(r.id); setEditName(r.name); }}>
                    <Pencil className="h-4 w-4 mr-1.5" /> Rename
                  </Button>
                  <Button variant={r.deleted_at ? "default" : "outline"} size="sm" className="min-h-10"
                    onClick={() => toggleArchive(r)}>
                    {r.deleted_at
                      ? (<><ArchiveRestore className="h-4 w-4 mr-1.5" /> Restore</>)
                      : (<><Archive className="h-4 w-4 mr-1.5" /> Archive</>)}
                  </Button>
                </div>
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
