import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, PhoneCall, Send, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";

const STORAGE_KEY = "neela:tour_completed";

const STEPS = [
  {
    icon: Users,
    title: "Welcome to Neela CRM",
    body: "Your unified workspace for managing leads, bookings, and follow-ups across all venues.",
  },
  {
    icon: PhoneCall,
    title: "Capture & call leads",
    body: "Add a lead, tap call, and log the outcome. Follow-ups auto-schedule based on your settings.",
  },
  {
    icon: Send,
    title: "Transfer between venues",
    body: "If a lead fits another property better, send a transfer request — admins approve in one tap.",
  },
  {
    icon: Bell,
    title: "Stay in the loop",
    body: "The bell at the top shows new transfers, approvals, and follow-up reminders in real time.",
  },
];

export function WelcomeTour() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (loading || !user) return;
    try {
      if (window.self !== window.top) return; // skip inside Lovable preview iframe
    } catch {
      return;
    }
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, [loading, user]);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Icon className="h-6 w-6" />
          </div>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription>{current.body}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-1.5 justify-center py-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>
        <DialogFooter className="flex flex-row justify-between sm:justify-between gap-2">
          <Button variant="ghost" onClick={finish}>
            Skip
          </Button>
          <Button onClick={() => (isLast ? finish() : setStep(step + 1))}>
            {isLast ? "Get started" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
