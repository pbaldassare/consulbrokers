import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Optional secondary line shown under the label inside the dropdown (not in the trigger). */
  description?: string;
  /** Extra text included in the search index but not displayed. */
  searchText?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  searchValue?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  clearable?: boolean;
  clearLabel?: string;
  /** Disabilita il filtro client di cmdk: usa quando le `options` sono già filtrate dal server. */
  serverSideSearch?: boolean;
  /** Boundary per collision detection Radix (default: document.body). */
  popoverCollisionBoundary?: Element | "clippingAncestors";
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Seleziona...",
  emptyText = "Nessun risultato.",
  className,
  disabled = false,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Cerca...",
  clearable = false,
  clearLabel = "— Nessuno —",
  serverSideSearch = false,
  popoverCollisionBoundary,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);

  const collisionBoundary =
    popoverCollisionBoundary ??
    (typeof document !== "undefined" ? document.body : undefined);

  const selectedLabel = options.find((o) => o.value === value)?.label;
  const trimmedSearch = (searchValue ?? "").trim();
  const serverEmptyMessage = trimmedSearch.length === 0
    ? "Digita per cercare…"
    : emptyText;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selectedLabel && "text-muted-foreground", className)}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        side="bottom"
        collisionBoundary={collisionBoundary}
        collisionPadding={12}
      >
        <Command shouldFilter={!serverSideSearch}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={(q) => {
              if (onSearchChange) onSearchChange(q);
            }}
          />
          <CommandList>
            <CommandEmpty>{serverSideSearch ? serverEmptyMessage : emptyText}</CommandEmpty>
            <CommandGroup>
              {clearable && value && (
                <CommandItem
                  key="__clear__"
                  value={clearLabel}
                  onSelect={() => {
                    onValueChange("");
                    setOpen(false);
                  }}
                >
                  <Check className="mr-2 h-4 w-4 mt-0.5 shrink-0 opacity-0" />
                  <span className="truncate text-muted-foreground italic">{clearLabel}</span>
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.description ?? ""} ${option.searchText ?? ""}`.trim()}
                  onSelect={() => {
                    onValueChange(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 mt-0.5 shrink-0", value === option.value ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="text-[10px] text-muted-foreground truncate">{option.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
