import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Bell } from "lucide-react";
import type { ReminderFormState } from "@/lib/task-reminders";

interface Props {
  value: ReminderFormState;
  onChange: (v: ReminderFormState) => void;
  hasBookingDate: boolean;
}

export function TaskReminderSection({ value, onChange, hasBookingDate }: Props) {
  const update = (patch: Partial<ReminderFormState>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Bell className="h-4 w-4" /> Set reminder
      </div>

      <RadioGroup
        value={value.mode}
        onValueChange={(v) => update({ mode: v as ReminderFormState["mode"] })}
        className="space-y-2"
      >
        {/* Absolute */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="absolute" id="rmode-abs" />
            <Label htmlFor="rmode-abs" className="text-xs">On a specific date and time</Label>
          </div>
          {value.mode === "absolute" && (
            <div className="grid grid-cols-2 gap-2 pl-6">
              <Input
                type="date"
                value={value.absoluteDate}
                onChange={(e) => update({ absoluteDate: e.target.value })}
              />
              <Input
                type="time"
                value={value.absoluteTime}
                onChange={(e) => update({ absoluteTime: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* Before event */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="before_event" id="rmode-event" disabled={!hasBookingDate} />
            <Label htmlFor="rmode-event" className={`text-xs ${!hasBookingDate ? "opacity-50" : ""}`}>
              Before the event {!hasBookingDate && "(pick a booking first)"}
            </Label>
          </div>
          {value.mode === "before_event" && (
            <OffsetRow value={value} update={update} />
          )}
        </div>

        {/* Before due */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="before_due" id="rmode-due" />
            <Label htmlFor="rmode-due" className="text-xs">Before the task due date</Label>
          </div>
          {value.mode === "before_due" && <OffsetRow value={value} update={update} />}
        </div>
      </RadioGroup>

      {/* Repeat */}
      <div className="space-y-2 border-t pt-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Repeat this reminder</Label>
          <Switch checked={value.repeat} onCheckedChange={(v) => update({ repeat: v })} />
        </div>
        {value.repeat && (
          <div className="space-y-2 pl-1">
            <Select
              value={value.repeatFrequency}
              onValueChange={(v) => update({ repeatFrequency: v as ReminderFormState["repeatFrequency"] })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Every hour</SelectItem>
                <SelectItem value="daily">Every day</SelectItem>
                <SelectItem value="every_2_days">Every 2 days</SelectItem>
                <SelectItem value="custom">Custom interval</SelectItem>
              </SelectContent>
            </Select>
            {value.repeatFrequency === "custom" && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-24"
                  value={value.repeatIntervalHours}
                  onChange={(e) => update({ repeatIntervalHours: Number(e.target.value) || 1 })}
                />
                <span className="text-xs text-muted-foreground">hours</span>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Repeats until the task is marked completed.</p>
          </div>
        )}
      </div>

      {/* Recipients */}
      <div className="space-y-1.5 border-t pt-2">
        <Label className="text-xs">Who gets the reminder</Label>
        <div className="flex flex-col gap-1.5 pl-1">
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={value.notifyAssignee}
              onCheckedChange={(v) => update({ notifyAssignee: !!v })}
            />
            Notify assigned employee
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={value.notifyAdmin}
              onCheckedChange={(v) => update({ notifyAdmin: !!v })}
            />
            Notify booking staff / admin
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={value.sendWa}
              onCheckedChange={(v) => update({ sendWa: !!v })}
            />
            Also send via WhatsApp
          </label>
        </div>
      </div>
    </div>
  );
}

function OffsetRow({
  value,
  update,
}: {
  value: ReminderFormState;
  update: (p: Partial<ReminderFormState>) => void;
}) {
  return (
    <div className="flex items-center gap-2 pl-6">
      <Input
        type="number"
        min={1}
        className="h-8 w-24"
        value={value.offsetValue}
        onChange={(e) => update({ offsetValue: Number(e.target.value) || 1 })}
      />
      <Select
        value={value.offsetUnit}
        onValueChange={(v) => update({ offsetUnit: v as ReminderFormState["offsetUnit"] })}
      >
        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="hours">hours</SelectItem>
          <SelectItem value="days">days</SelectItem>
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">before</span>
    </div>
  );
}
