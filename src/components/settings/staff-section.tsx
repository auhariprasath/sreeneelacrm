import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listCompanyStaff, createStaff, setStaffActive, updateStaffSettings, setStaffLeave } from "@/lib/api/staff.functions";
import { moveStaffToCompany } from "@/lib/api/companies.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, UserX, UserCheck } from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { SkeletonList } from "@/components/skeleton-list";
import { useAuth } from "@/lib/auth";

interface StaffRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  phone_masked: boolean;
  auto_approve_transfers: boolean;
  must_change_password: boolean;
  last_active_at: string | null;
  role: string;
  on_leave: boolean;
  backup_staff_id: string | null;
}

export function StaffSection({ companyId }: { companyId: string | undefined }) {
  const { profile, role: currentRole, companies } = useAuth();
  const list = useServerFn(listCompanyStaff);
  const create = useServerFn(createStaff);
  const setActive = useServerFn(setStaffActive);
  const update = useServerFn(updateStaffSettings);
  const setLeave = useServerFn(setStaffLeave);
  const moveStaff = useServerFn(moveStaffToCompany);

  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await list({ data: { company_id: companyId } });
      setRows(data as StaffRow[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const submit = async () => {
    if (!companyId) return;
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      toast.error("Name, email, and a password (8+ chars) are required");
      return;
    }
    setBusy(true);
    try {
      await create({
        data: {
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          role,
          company_id: companyId,
        },
      });
      toast.success("Staff added");
      setOpen(false);
      setFullName(""); setEmail(""); setPassword(""); setPhone(""); setRole("staff");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add staff");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (r: StaffRow) => {
    try {
      await setActive({ data: { user_id: r.id, is_active: !r.is_active } });
      toast.success(r.is_active ? "Deactivated" : "Reactivated");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const togglePhoneMask = async (r: StaffRow) => {
    try {
      await update({ data: { user_id: r.id, phone_masked: !r.phone_masked } });
      setRows((arr) => arr.map((x) => (x.id === r.id ? { ...x, phone_masked: !r.phone_masked } : x)));
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const toggleAutoApprove = async (r: StaffRow) => {
    try {
      await update({ data: { user_id: r.id, auto_approve_transfers: !r.auto_approve_transfers } });
      setRows((arr) => arr.map((x) => (x.id === r.id ? { ...x, auto_approve_transfers: !r.auto_approve_transfers } : x)));
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  if (!companyId) return <div className="text-sm text-muted-foreground p-6">Select a company first.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{rows.length} member{rows.length === 1 ? "" : "s"}</div>
        <Button onClick={() => setOpen(true)} className="min-h-11"><Plus className="h-4 w-4 mr-1" /> Add staff</Button>
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : rows.length === 0 ? (
        <div className="border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">No staff yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="border rounded-lg p-3 md:p-4 bg-card">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.full_name || "(no name)"}</span>
                    <Badge variant="secondary" className="text-[10px]">{r.role}</Badge>
                    {!r.is_active && <Badge variant="destructive" className="text-[10px]">Deactivated</Badge>}
                    {r.on_leave && <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">On leave</Badge>}
                    {r.must_change_password && <Badge variant="outline" className="text-[10px]">Password reset pending</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{r.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {currentRole === "super_admin" && companies.filter((c) => c.id !== companyId).length > 0 && (
                    <Select
                      onValueChange={async (v) => {
                        if (!v) return;
                        try {
                          await moveStaff({ data: { user_id: r.id, target_company_id: v } });
                          toast.success("Moved to selected company");
                          await load();
                        } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                      }}
                    >
                      <SelectTrigger className="h-10 w-[180px]"><SelectValue placeholder="Move to company…" /></SelectTrigger>
                      <SelectContent>
                        {companies.filter((c) => c.id !== companyId).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant={r.is_active ? "outline" : "default"}
                    size="sm"
                    onClick={() => toggleActive(r)}
                    disabled={r.id === profile?.id}
                    className="min-h-11"
                  >
                    {r.is_active
                      ? (<><UserX className="h-4 w-4 mr-1.5" /> Deactivate</>)
                      : (<><UserCheck className="h-4 w-4 mr-1.5" /> Reactivate</>)}
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between gap-3 text-sm border rounded-md px-3 py-2.5">
                  <span>Mask phone numbers</span>
                  <Switch checked={r.phone_masked} onCheckedChange={() => togglePhoneMask(r)} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm border rounded-md px-3 py-2.5">
                  <span className="flex items-center">Auto-approve transfers in<InfoTip tip="skipApproval" /></span>
                  <Switch checked={r.auto_approve_transfers} onCheckedChange={() => toggleAutoApprove(r)} />
                </label>
              </div>
              <div className="mt-3 border rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">On leave</div>
                    <div className="text-xs text-muted-foreground">Pause assignments and route overdue follow-ups to backup.</div>
                  </div>
                  <Switch
                    checked={r.on_leave}
                    onCheckedChange={async (v) => {
                      if (v && !r.backup_staff_id) { toast.error("Pick a backup staff first"); return; }
                      try {
                        const res: any = await setLeave({ data: { user_id: r.id, on_leave: v, backup_staff_id: r.backup_staff_id } });
                        setRows((arr) => arr.map((x) => (x.id === r.id ? { ...x, on_leave: v } : x)));
                        if (v) toast.success(`Leave on. ${res?.reassigned ?? 0} lead(s) reassigned.`);
                        else toast.success("Leave cleared");
                      } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Backup staff</Label>
                  <Select
                    value={r.backup_staff_id ?? "none"}
                    onValueChange={async (v) => {
                      const backup = v === "none" ? null : v;
                      try {
                        await setLeave({ data: { user_id: r.id, on_leave: r.on_leave, backup_staff_id: backup } });
                        setRows((arr) => arr.map((x) => (x.id === r.id ? { ...x, backup_staff_id: backup } : x)));
                        toast.success("Backup updated");
                      } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                    }}
                  >
                    <SelectTrigger className="h-10"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {rows.filter((s) => s.id !== r.id && s.is_active && !s.on_leave).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add staff</DialogTitle>
            <DialogDescription>Create a new account for this company. They'll be asked to set a new password on first sign-in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Priya Sharma" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@neelaevents.com" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Temporary password</Label>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxxxxxx" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy} className="min-h-11">Cancel</Button>
            <Button onClick={submit} disabled={busy} className="min-h-11">{busy ? "Creating…" : "Create staff"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
