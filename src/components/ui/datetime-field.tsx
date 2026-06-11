import { DateConfirmField } from "@/components/ui/date-confirm-field";
import { TimeClockField } from "@/components/ui/time-clock-picker";

interface Props {
  value: string; // "YYYY-MM-DDTHH:MM"
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Combines DateConfirmField + TimeClockField for datetime-local replacement.
 * value / onChange use the same "YYYY-MM-DDTHH:MM" format as <input type="datetime-local">.
 */
export function DateTimeField({ value, onChange, disabled, className }: Props) {
  const date = value ? value.slice(0, 10) : "";
  const time = value ? (value.slice(11, 16) || "10:00") : "10:00";

  const setDate = (d: string) => onChange(`${d}T${time}`);
  const setTime = (t: string) => onChange(`${date || new Date().toISOString().slice(0, 10)}T${t}`);

  return (
    <div className={`grid grid-cols-2 gap-2 ${className ?? ""}`}>
      <DateConfirmField value={date} onChange={setDate} disabled={disabled} placeholder="Pick date" />
      <TimeClockField   value={time} onChange={setTime} disabled={disabled} placeholder="Pick time" />
    </div>
  );
}
