import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TOOLTIPS, type TooltipKey } from "@/lib/labels";

interface InfoTipProps {
  /** Either a preset key from TOOLTIPS or a custom string. */
  tip: TooltipKey | string;
  className?: string;
  size?: number;
  label?: string;
}

/**
 * Plain-language "ⓘ" info popover (Phase 8 Change 1).
 * Tap/click to read a one-sentence explanation. Works on mobile + desktop.
 */
export function InfoTip({ tip, className, size = 14, label }: InfoTipProps) {
  const text = (TOOLTIPS as Record<string, string>)[tip] ?? tip;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label ?? "More info"}
          className={cn(
            "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors align-middle ml-1",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Info style={{ width: size, height: size }} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="max-w-xs text-xs leading-relaxed">
        {text}
      </PopoverContent>
    </Popover>
  );
}
