import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Paperclip, Camera, Trash2, Download, Loader2, FileText, FileSpreadsheet, File } from "lucide-react";
import { formatDateTimeIN } from "@/lib/format";

interface FileEntry {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  url: string;
  created_at: string;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return null; // show thumbnail
  if (type === "application/pdf") return <FileText className="h-8 w-8 text-red-500" />;
  if (type.includes("spreadsheet") || type.includes("excel")) return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
  if (type.includes("word") || type.includes("document")) return <FileText className="h-8 w-8 text-blue-500" />;
  return <File className="h-8 w-8 text-muted-foreground" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeadFilesTab({ leadId }: { leadId: string }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lead_files")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    const rows = (data as any[]) ?? [];
    // Generate signed URLs
    const withUrls = await Promise.all(
      rows.map(async (r) => {
        const { data: signed } = await supabase.storage
          .from("lead-attachments")
          .createSignedUrl(r.path, 60 * 60 * 24);
        return { ...r, url: signed?.signedUrl ?? "" };
      }),
    );
    setFiles(withUrls);
    setLoading(false);
  };

  useEffect(() => { loadFiles(); }, [leadId]);

  const uploadFiles = async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    setUploading(true);
    for (const file of Array.from(picked)) {
      const path = `${leadId}/files/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("lead-attachments")
        .upload(path, file, { contentType: file.type });
      if (upErr) { toast.error(`Failed to upload ${file.name}`); continue; }

      await supabase.from("lead_files").insert({
        lead_id: leadId,
        name: file.name,
        path,
        type: file.type,
        size: file.size,
      });
    }
    toast.success("Uploaded successfully");
    setUploading(false);
    loadFiles();
  };

  const deleteFile = async (f: FileEntry) => {
    if (!window.confirm(`Delete "${f.name}"?`)) return;
    await supabase.storage.from("lead-attachments").remove([f.path]);
    await supabase.from("lead_files").delete().eq("id", f.id);
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    toast.success("File deleted");
  };

  return (
    <div className="space-y-4">
      {/* Upload buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="gap-2"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          Upload file
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          disabled={uploading}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="h-4 w-4" /> Take photo
        </Button>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
      </div>

      {/* Files list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          No files yet. Upload documents or take a photo.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {files.map((f) => (
            <div key={f.id} className="group relative rounded-lg border bg-card overflow-hidden">
              {/* Preview */}
              {f.type.startsWith("image/") ? (
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  <img src={f.url} alt={f.name} className="w-full h-28 object-cover" />
                </a>
              ) : (
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center h-28 bg-muted/30 hover:bg-muted/60 transition-colors">
                  {fileIcon(f.type)}
                </a>
              )}

              {/* Info */}
              <div className="p-2 space-y-0.5">
                <div className="text-xs font-medium truncate">{f.name}</div>
                <div className="text-[10px] text-muted-foreground">{formatBytes(f.size)} · {formatDateTimeIN(f.created_at)}</div>
              </div>

              {/* Actions on hover */}
              <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                <a href={f.url} download={f.name} target="_blank" rel="noopener noreferrer"
                  className="h-6 w-6 flex items-center justify-center rounded-md bg-background/90 border shadow-sm hover:bg-muted">
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => deleteFile(f)}
                  className="h-6 w-6 flex items-center justify-center rounded-md bg-background/90 border shadow-sm hover:bg-destructive hover:text-white transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
