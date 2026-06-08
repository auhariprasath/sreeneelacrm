import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { WA_TEMPLATES, renderPreview, type WaTemplatesMap } from "@/lib/wa-templates";
import { buildWaMeLink } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  templateKey: string;
  leadName?: string;
  leadPhone?: string | null;
  /** Map of placeholder name → real value, overrides sample data. */
  values?: Record<string, string>;
}

type GalleryPhoto = { path: string; url: string };

const PHOTO_MAX = 3;

export function WaMessagePreviewDialog({ open, onOpenChange, companyId, templateKey, leadName, leadPhone, values }: Props) {
  const tpl = WA_TEMPLATES.find((t) => t.key === templateKey);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [portfolioUrl, setPortfolioUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [mapsLink, setMapsLink] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [includePhotosReq, setIncludePhotosReq] = useState(true);
  const [includePortfolioD5, setIncludePortfolioD5] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Which media should be auto-included by template?
  const autoMedia = useMemo(() => {
    if (templateKey === "requirements_confirmed") return { photos: includePhotosReq, video: true, maps: true, address: true, portfolio: false };
    if (templateKey === "day5_portfolio") return { photos: includePortfolioD5, video: false, maps: false, address: false, portfolio: includePortfolioD5 };
    if (templateKey === "meeting_confirmed") return { photos: true, video: true, maps: true, address: true, portfolio: false };
    return { photos: false, video: false, maps: false, address: false, portfolio: false };
  }, [templateKey, includePhotosReq, includePortfolioD5]);

  useEffect(() => {
    if (!open || !companyId) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("companies")
        .select("wa_templates, portfolio_url, video_url, google_maps_link, full_address, address, venue_photos, include_photos_in_requirements, include_portfolio_in_day5")
        .eq("id", companyId).maybeSingle();
      if (!active || !data) return;

      const stored = ((data.wa_templates as unknown) ?? {}) as WaTemplatesMap;
      const tplBody = stored[templateKey]?.body ?? tpl?.defaultBody ?? "";
      setBody(tplBody);
      setPortfolioUrl((data as any).portfolio_url ?? null);
      setVideoUrl((data as any).video_url ?? null);
      setMapsLink((data as any).google_maps_link ?? null);
      setAddress(((data as any).full_address ?? (data as any).address) ?? null);
      setIncludePhotosReq((data as any).include_photos_in_requirements ?? true);
      setIncludePortfolioD5((data as any).include_portfolio_in_day5 ?? true);

      const paths = (Array.isArray((data as any).venue_photos) ? (data as any).venue_photos : []) as string[];
      if (paths.length === 0) { setPhotos([]); setSelected([]); setLoading(false); return; }
      const { data: signed } = await supabase.storage.from("venue-photos")
        .createSignedUrls(paths, 60 * 60 * 24);
      const list = (signed ?? []).map((s, i) => ({ path: paths[i], url: s.signedUrl ?? "" }));
      setPhotos(list);
      setSelected(list.slice(0, PHOTO_MAX).map((p) => p.path));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [open, companyId, templateKey, tpl?.defaultBody]);

  const toggle = (path: string) => {
    setSelected((prev) => {
      if (prev.includes(path)) return prev.filter((p) => p !== path);
      if (prev.length >= PHOTO_MAX) { toast.info(`Max ${PHOTO_MAX} photos`); return prev; }
      return [...prev, path];
    });
  };

  const selectFirst3 = () => setSelected(photos.slice(0, PHOTO_MAX).map((p) => p.path));
  const clearAll = () => setSelected([]);

  const merged = useMemo(() => {
    const v: Record<string, string> = {
      ...(values ?? {}),
      ...(leadName ? { Name: leadName } : {}),
      ...(portfolioUrl ? { "Portfolio link": portfolioUrl } : {}),
      ...(videoUrl ? { "Video link": videoUrl } : {}),
      ...(mapsLink ? { "Maps link": mapsLink } : {}),
      ...(address ? { Address: address } : {}),
    };
    let out = body;
    Object.entries(v).forEach(([k, val]) => {
      out = out.split(`[${k}]`).join(val);
    });
    return renderPreview(out);
  }, [body, values, leadName, portfolioUrl, videoUrl, mapsLink, address]);

  const selectedPhotos = photos.filter((p) => selected.includes(p.path));
  const tel = (leadPhone ?? "").replace(/\D/g, "").slice(-10);

  const send = () => {
    if (!tel) { toast.error("No phone number"); return; }
    const url = buildWaMeLink(leadPhone ?? undefined, merged);
    if (!url) { toast.error("Invalid phone number"); return; }
    window.location.href = url;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tpl?.name ?? "WhatsApp message"}</DialogTitle>
          <DialogDescription>Preview the message and pick photos before sending.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Message</div>
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} className="text-sm" />
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{merged}</div>

            {autoMedia.photos && photos.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Photos · {selected.length}/{PHOTO_MAX}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectFirst3}>First 3</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearAll}>Clear all</Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  {photos.map((p) => {
                    const isSel = selected.includes(p.path);
                    return (
                      <button key={p.path} type="button" onClick={() => toggle(p.path)}
                        className={`relative aspect-square rounded-md border-2 overflow-hidden transition ${
                          isSel ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/30"
                        }`}>
                        <img src={p.url} alt="" className="h-full w-full object-cover" />
                        {isSel && (
                          <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] inline-flex items-center justify-center font-bold">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedPhotos.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] text-muted-foreground mb-1">Will send these photos</div>
                    <div className="flex gap-2">
                      {selectedPhotos.map((p) => (
                        <img key={p.path} src={p.url} alt="" className="h-14 w-14 object-cover rounded-md border-2 border-primary" />
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-1">
                  WhatsApp Web does not attach photos automatically. Share the selected images alongside the message.
                </div>
              </div>
            )}

            {(autoMedia.video || autoMedia.maps || autoMedia.portfolio) && (
              <div className="text-xs flex flex-wrap gap-2">
                {autoMedia.portfolio && portfolioUrl && <span className="px-2 py-0.5 rounded-full border bg-primary/10 text-primary">Portfolio: {portfolioUrl}</span>}
                {autoMedia.video && videoUrl && <span className="px-2 py-0.5 rounded-full border bg-accent">Video: {videoUrl}</span>}
                {autoMedia.maps && mapsLink && <span className="px-2 py-0.5 rounded-full border bg-accent">Maps: {mapsLink}</span>}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={!tel || loading}>
            <Send className="h-4 w-4 mr-1.5" /> Send via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
