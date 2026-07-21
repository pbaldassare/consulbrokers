import * as React from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Parse yyyy-MM-dd (o ISO con time) in Date locale, senza shift timezone. */
export function parseIsoDateOnly(raw: string | null | undefined): Date | undefined {
  const s = String(raw ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

export function formatIsoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type DateInputProps = Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> & {
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

/**
 * Sostituto italiano di &lt;input type="date"&gt;.
 * - Visualizza gg/mm/aaaa
 * - Value/onChange restano in yyyy-MM-dd (compatibile con i form esistenti)
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      className,
      value,
      defaultValue,
      onChange,
      onBlur,
      disabled,
      id,
      name,
      min,
      max,
      required,
      placeholder = "gg/mm/aaaa",
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [uncontrolled, setUncontrolled] = React.useState(() =>
      String(defaultValue ?? ""),
    );
    const controlled = value !== undefined;
    const iso = controlled ? String(value ?? "") : uncontrolled;
    const selected = parseIsoDateOnly(iso);
    const minDate = parseIsoDateOnly(typeof min === "string" ? min : undefined);
    const maxDate = parseIsoDateOnly(typeof max === "string" ? max : undefined);

    const emit = (nextIso: string) => {
      if (!controlled) setUncontrolled(nextIso);
      if (!onChange) return;
      const fake = {
        target: { value: nextIso, name: name ?? "", type: "date" },
        currentTarget: { value: nextIso, name: name ?? "", type: "date" },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(fake);
    };

    return (
      <div className="relative w-full">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              id={id}
              aria-required={required}
              className={cn(
                "h-10 w-full justify-start px-3 text-left font-normal",
                !selected && "text-muted-foreground",
                className,
              )}
              onBlur={onBlur as unknown as React.FocusEventHandler<HTMLButtonElement>}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
              {selected ? format(selected, "dd/MM/yyyy", { locale: it }) : placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              locale={it}
              selected={selected}
              defaultMonth={selected}
              onSelect={(d) => {
                if (!d) {
                  emit("");
                  return;
                }
                emit(formatIsoDateOnly(d));
                setOpen(false);
              }}
              disabled={(date) => {
                if (minDate && date < minDate) return true;
                if (maxDate && date > maxDate) return true;
                return false;
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <input
          ref={ref}
          type="hidden"
          name={name}
          value={iso.slice(0, 10)}
          required={required}
          readOnly
          tabIndex={-1}
          aria-hidden
        />
      </div>
    );
  },
);
DateInput.displayName = "DateInput";
