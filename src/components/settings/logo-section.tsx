import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { useAppLogo, DEFAULT_LOGO, setAppLogo, clearAppLogo } from "@/lib/use-app-logo";

const STORAGE_PATH = "logos/global/logo";

export function LogoSection() {
  const logo = useAppLogo();
  const { companies } = useAuth();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCustom = logo !== DEFAULT_LOGO;

  /** Persist logo_url to all companies so quotation/invoice pages show the correct logo. */
  const syncLogoToCompanies = async (url: string | null) => {
    if (!companies.length) return;
    await Promise.all(
      companies.map((c) =>
        supabase.from("companies").update({ logo_url: url }).eq("id", c.id)
      )
    );
  };

  const upload = async (file: File) => {
    setBusy(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${STORAGE_PATH}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("venue-photos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }

    const { data: signed } = await supabase.storage
      .from("venue-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 3650); // ~10 years
    const url = signed?.signedUrl;
    if (!url) { setBusy(false); toast.error("Failed to get logo URL"); return; }

    setAppLogo(url);
    await syncLogoToCompanies(url);
    setBusy(false);
    toast.success("Logo updated ✓");
  };

  const remove = async () => {
    clearAppLogo();
    await syncLogoToCompanies(null);
    toast.success("Logo removed — default restored ✓");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="h-24 w-24 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
          <img src={logo} alt="App logo" className="h-full w-full object-contain p-1" />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {isCustom ? "Custom logo active — shown across the entire app." : "Using the default logo (icon-192.png)."}
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
              {isCustom ? "Replace logo" : "Upload logo"}
            </Button>
            {isCustom && (
              <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={remove}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Remove (use default)
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG or SVG. Recommended: square, min 192×192 px.</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
      />
    </div>
  );
}
