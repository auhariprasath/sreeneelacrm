import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

type Staff = { id: string; full_name: string };

interface Props {
  bookingId: string;
  companyId: string;
  assignedTo: string | null;
  onChanged?: () => void;
}

export function BookingAssignedTo({ bookingId, companyId, assignedTo, onChanged }: Props) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || staff.length) return;
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setStaff((data as Staff[]) ?? []));
  }, [open, companyId, staff.length]);

  const current = staff.find((s) => s.id === assignedTo);
  const currentName = current?.full_name;

  const assign = async (id: string | null) => {
    setSaving(true);
    const { error } = await supabase
      .from("bookings")
      .update({ assigned_to: id } as any)
      .eq("id", bookingId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(id ? "Staff assigned" : "Unassigned");
    setOpen(false);
    onChanged?.();
  };

  return (
    <div className="border-t pt-2 flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Assigned to</span>
        {assignedTo ? (
          <span className="font-medium inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {currentName ?? "Loading…"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-warning dark:text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Unassigned
          </span>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            <UserCheck className="h-3 w-3 mr-1" />
            {assignedTo ? "Change" : "Assign staff"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          {staff.length === 0 ? (
            <div className="text-xs text-muted-foreground p-2">Loading…</div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {staff.map((s) => (
                <button
                  key={s.id}
                  disabled={saving}
                  onClick={() => assign(s.id)}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent ${s.id === assignedTo ? "bg-accent/50 font-medium" : ""}`}
                >
                  {s.full_name}
                </button>
              ))}
              {assignedTo && (
                <button
                  disabled={saving}
                  onClick={() => assign(null)}
                  className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent text-muted-foreground border-t mt-1"
                >
                  Unassign
                </button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
