import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface FilterSearchableSelectProps {
  value: string | null;
  onValueChange: (v: string | null) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  allLabel: string;
  className?: string;
}

export function FilterSearchableSelect({ value, onValueChange, options, placeholder, allLabel, className }: FilterSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value ? options.find((o) => o.value === value)?.label || placeholder : allLabel;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn("justify-between bg-background font-normal", className)}>
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Cerca ${placeholder.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Nessun risultato</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => { onValueChange(null); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} /> {allLabel}
              </CommandItem>
              {options.map((opt) => (
                <CommandItem key={opt.value} value={opt.label} onSelect={() => { onValueChange(opt.value); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} /> {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
