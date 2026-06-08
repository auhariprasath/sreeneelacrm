import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  value?: string; // ISO date "YYYY-MM-DD"
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean | ((date: Date) => boolean);
  className?: string;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Date field with shadcn Calendar in a popover.
 * Requires explicit tap on the purple "Confirm date" button to lock the selection.
 */
export function DateConfirmField({
  value, onChange, placeholder = "Pick a date",
  disabled, className, fromDate, toDate,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Date | undefined>(value ? parseISO(value) : undefined);

  React.useEffect(() => {
    setDraft(value ? parseISO(value) : undefined);
  }, [value, open]);

  const isDateDisabled = typeof disabled === "function" ? disabled : undefined;
  const buttonDisabled = typeof disabled === "boolean" ? disabled : false;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          disabled={buttonDisabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(parseISO(value), "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <Calendar
          mode="single"
          selected={draft}
          onSelect={setDraft}
          disabled={isDateDisabled}
          fromDate={fromDate}
          toDate={toDate}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="border-t p-3">
          <Button
            type="button"
            onClick={() => {
              if (draft) {
                onChange(formatISO(draft));
                setOpen(false);
              }
            }}
            disabled={!draft}
            className="w-full font-semibold h-10"
          >
            <Check className="h-4 w-4 mr-2" /> Confirm date
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function parseISO(s: string): Date {
  // Treat YYYY-MM-DD as a local date (avoid UTC off-by-one)
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
