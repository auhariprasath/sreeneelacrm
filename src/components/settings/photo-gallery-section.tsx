import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImagePlus, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";

interface Photo { path: string; url: string }

interface Props { companyId: string | undefined }

const MAX = 10;

async function signedUrl(path: string): Promise<string> {
  const { data } = await supabase.storage.from("venue-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? "";
}

export function PhotoGallerySection({ companyId }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("companies").select("venue_photos").eq("id", companyId).maybeSingle();
      const paths = (Array.isArray((data as any)?.venue_photos) ? (data as any).venue_photos : []) as string[];
      const list: Photo[] = [];
      for (const p of paths) list.push({ path: p, url: await signedUrl(p) });
      setPhotos(list);
      setLoading(false);
    })();
  }, [companyId]);

  const persist = async (next: Photo[]) => {
    setPhotos(next);
    if (!companyId) return;
    await supabase.from("companies").update({ venue_photos: next.map((p) => p.path) as any }).eq("id", companyId);
  };

  const upload = async (file: File) => {
    if (!companyId) return;
    if (photos.length >= MAX) { toast.error(`Max ${MAX} photos`); return; }
    setBusy(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("venue-photos").upload(path, file, { upsert: false, contentType: file.type });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const url = await signedUrl(path);
    await persist([...photos, { path, url }]);
    toast.success("Photo added ✓");
  };

  const remove = async (idx: number) => {
    const p = photos[idx];
    await supabase.storage.from("venue-photos").remove([p.path]);
    await persist(photos.filter((_, i) => i !== idx));
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[idx], next[j]] = [next[j], next[idx]];
    await persist(next);
  };

  if (!companyId) return <div className="text-sm text-muted-foreground p-6">Select a company first.</div>;
  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">Up to {MAX} venue photos. Used in meeting confirmation WhatsApp messages.</div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {photos.map((p, i) => (
          <div key={p.path} className="relative group border rounded-md overflow-hidden bg-muted aspect-square">
            <img src={p.url} alt={`Photo ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-x-1 top-1 flex justify-between">
              <span className="bg-background/80 rounded px-1.5 py-0.5 text-[10px] font-medium">#{i + 1}</span>
            </div>
            <div className="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}>
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === photos.length - 1}>
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="destructive" className="h-7 w-7 ml-auto" onClick={() => remove(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        {photos.length < MAX && (
          <label className="aspect-square border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-accent text-muted-foreground text-xs gap-1">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span>{busy ? "Uploading…" : "Add photo"}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
