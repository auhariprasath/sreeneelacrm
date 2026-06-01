import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  const refresh = async () => {
    if (!user) return;
    const { count: c } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setCount(c ?? 0);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`notif-bell-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user?.id]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-10 w-10"
      onClick={() => navigate({ to: "/notifications" })}
      aria-label="Notifications"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-medium flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  );
}
