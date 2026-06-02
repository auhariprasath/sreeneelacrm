import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDateTimeIN } from "@/lib/format";
import { CheckCircle2, Play, Check } from "lucide-react";

type ReplyType = "noted" | "started" | "completed" | "comment";

type Reply = {
  id: string;
  reply_type: ReplyType;
  message: string | null;
  created_by: string | null;
  created_at: string;
  author_name?: string | null;
};

const ICON: Record<ReplyType, string> = {
  noted: "✓",
  started: "▶",
  completed: "✅",
  comment: "💬",
};
const LABEL: Record<ReplyType, string> = {
  noted: "Noted by",
  started: "Started by",
  completed: "Completed by",
  comment: "Comment by",
};

export function TaskReplies({
  taskId,
  companyId,
  bookingId,
  taskStatus,
  onStatusChange,
}: {
  taskId: string;
  companyId: string;
  bookingId: string;
  taskStatus: string;
  onStatusChange?: (status: "in_progress" | "done") => void;
}) {
  const { profile } = useAuth();
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("task_replies")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    if (error) { setReplies([]); return; }
    const rows = (data ?? []) as Reply[];
    const ids = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name as string]));
      setReplies(rows.map((r) => ({ ...r, author_name: r.created_by ? map.get(r.created_by) ?? null : null })));
    } else {
      setReplies(rows);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [taskId]);

  const post = async (type: ReplyType) => {
    if (!profile?.id) return;
    setBusy(true);
    const { error } = await supabase.from("task_replies").insert({
      task_id: taskId,
      company_id: companyId,
      reply_type: type,
      created_by: profile.id,
    });
    if (error) { toast.error(error.message); setBusy(false); return; }

    if (type === "started" && taskStatus !== "in_progress" && taskStatus !== "done") {
      await supabase.from("tasks").update({ status: "in_progress" }).eq("id", taskId);
      onStatusChange?.("in_progress");
    } else if (type === "completed" && taskStatus !== "done") {
      await supabase.from("tasks").update({
        status: "done",
        completed_at: new Date().toISOString(),
        completed_by: profile.id,
      }).eq("id", taskId);
      onStatusChange?.("done");
    }
    // notify admins of the booking owner team
    try {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminIds = (admins ?? []).map((a: any) => a.user_id);
      if (adminIds.length) {
        await supabase.from("notifications").insert(
          adminIds.map((uid: string) => ({
            user_id: uid,
            title: `Task ${type}`,
            body: `${profile.full_name || "Staff"} ${type} a task`,
            type: "system" as const,
          })),
        );
      }
    } catch { /* non-fatal */ }
    await load();
    setBusy(false);
    toast.success(`Marked ${type}`);
    void bookingId;
  };

  return (
    <div className="space-y-2 pt-2 border-t">
      {taskStatus !== "done" && (
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" disabled={busy} onClick={() => post("noted")}>
            <Check className="h-3 w-3 mr-1" /> Noted
          </Button>
          {taskStatus !== "in_progress" && (
            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" disabled={busy} onClick={() => post("started")}>
              <Play className="h-3 w-3 mr-1" /> Started
            </Button>
          )}
          <Button size="sm" className="h-7 text-xs flex-1" disabled={busy} onClick={() => post("completed")}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
          </Button>
        </div>
      )}
      {replies && replies.length > 0 && (
        <ul className="space-y-0.5 text-[11px] text-muted-foreground">
          {replies.map((r) => (
            <li key={r.id}>
              <span className="mr-1">{ICON[r.reply_type]}</span>
              {LABEL[r.reply_type]} {r.author_name ?? "—"} — {formatDateTimeIN(r.created_at)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
