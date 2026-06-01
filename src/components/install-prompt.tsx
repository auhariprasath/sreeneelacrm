import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

const VISIT_KEY = "neela:visits";
const DISMISS_KEY = "neela:install_dismissed";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show in iframes (Lovable preview)
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const visits = parseInt(localStorage.getItem(VISIT_KEY) || "0", 10) + 1;
    localStorage.setItem(VISIT_KEY, String(visits));

    const onBIP = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      if (visits >= 2) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  if (!show || !evt) return null;

  const install = async () => {
    await evt.prompt();
    await evt.userChoice;
    setShow(false);
  };
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  return (
    <div className="fixed bottom-20 md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:max-w-sm z-50 rounded-lg border bg-card shadow-lg p-4 flex items-start gap-3">
      <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">N</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">Install Neela CRM</div>
        <div className="text-xs text-muted-foreground mt-0.5">Add to your home screen for faster access.</div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={install}><Download className="h-3.5 w-3.5 mr-1" />Install</Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
        </div>
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
