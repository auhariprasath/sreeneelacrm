import { useState } from "react";
import { MoreVertical, Eye, Download, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  quotationId: string;
  leadId: string;
  pdfUrl?: string | null;
  versionLabel?: string;
  onView?: () => void;
  onResend?: () => void;
  onDeleted?: () => void;
}

export function InvoiceRowMenu({
  quotationId,
  leadId,
  pdfUrl,
  versionLabel,
  onView,
  onResend,
  onDeleted,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDownload = () => {
    if (!pdfUrl) {
      toast.error("PDF not generated yet. Send the invoice first.");
      return;
    }
    window.open(pdfUrl, "_blank", "noopener");
  };

  const handleDelete = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("quotations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", quotationId);
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    await supabase.from("activity_logs").insert({
      lead_id: leadId,
      action: `Invoice ${versionLabel ?? ""} deleted`.trim(),
      action_type: "system",
      performed_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
    toast.success("Invoice deleted");
    setBusy(false);
    setConfirmOpen(false);
    onDeleted?.();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Invoice actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {onView && (
            <DropdownMenuItem onClick={onView}>
              <Eye className="h-4 w-4 mr-2" /> View invoice
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" /> Download PDF
          </DropdownMenuItem>
          {onResend && (
            <DropdownMenuItem onClick={onResend}>
              <Send className="h-4 w-4 mr-2" /> Resend to client
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete invoice
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This invoice will be moved to deleted items. It will no longer appear in the lead profile or
              quotations list, but a Super Admin can restore it later. Linked bookings and payments are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Deleting…" : "Delete invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
