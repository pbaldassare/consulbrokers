import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SearchableSelectOptionDetail {
  label: string;
  value: string;
}

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Optional secondary line shown under the label inside the dropdown (not in the trigger). */
  description?: string;
  /** Extra text included in the search index but not displayed. */
  searchText?: string;
  /** Righe etichetta/valore sotto il numero (es. prodotto, garanzia). */
  details?: SearchableSelectOptionDetail[];
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
  /** Boundary opzionale per collision detection Radix (default: viewport Radix). */
  popoverCollisionBoundary?: Element | Element[];
  /** Mostra la description anche nel trigger quando un valore è selezionato. */
  showSelectedDescription?: boolean;
  loading?: boolean;
}

/** Larghezza popover allineata al trigger (Radix CSS var). */
export const popoverMatchTriggerWidthClass =
  "w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] p-0";

/** Sempre sotto il campo: niente flip verso l’alto. */
export const searchPopoverContentProps = {
  side: "bottom" as const,
  align: "start" as const,
  sideOffset: 8,
  avoidCollisions: false,
};

/** Lista scrollabile, altezza stabile così il menu non “salta” in alto. */
export const searchableSelectListClass = "max-h-[20rem]";

/** Evidenziazione tenue + padding uniforme per le voci. */
export const searchableSelectItemClass =
  "py-2 data-[selected=true]:bg-kpi-teal-bg data-[selected=true]:text-foreground";

function OptionDetails({ details }: { details: SearchableSelectOptionDetail[] }) {
  return (
    <div className="mt-1 space-y-0.5">
      {details.map((d) => (
        <div key={d.label} className="grid grid-cols-[4.75rem_1fr] gap-x-2 text-[11px] leading-snug">
          <span className="text-muted-foreground">{d.label}</span>
          <span className="font-medium text-foreground min-w-0 break-words">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function optionSearchValue(option: SearchableSelectOption): string {
  const detailText = (option.details ?? []).map((d) => `${d.label} ${d.value}`).join(" ");
  return `${option.label} ${option.description ?? ""} ${detailText} ${option.searchText ?? ""}`.trim();
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
  showSelectedDescription = false,
  loading = false,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((o) => o.value === value);
  const selectedLabel = selectedOption?.label;
  const selectedDetails = selectedOption?.details?.length ? selectedOption.details : undefined;
  const showTriggerDescription =
    showSelectedDescription && (!!selectedDetails || !!selectedOption?.description);
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
          disabled={disabled || loading}
          className={cn(
            "w-full justify-between font-normal",
            !selectedLabel && !loading && "text-muted-foreground",
            showTriggerDescription && "h-auto py-2",
            className,
          )}
        >
          {loading ? (
            <span className="truncate text-muted-foreground/70">Caricamento…</span>
          ) : showTriggerDescription ? (
            <span className="flex flex-col items-start min-w-0 text-left w-full">
              <span className="truncate w-full font-medium">{selectedLabel}</span>
              {selectedDetails ? (
                <OptionDetails details={selectedDetails} />
              ) : (
                <span className="text-[10px] text-muted-foreground truncate w-full">{selectedOption?.description}</span>
              )}
            </span>
          ) : (
            <span className="truncate">{selectedLabel || placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={popoverMatchTriggerWidthClass}
        {...searchPopoverContentProps}
        {...(popoverCollisionBoundary ? { collisionBoundary: popoverCollisionBoundary, collisionPadding: 12 } : {})}
      >
        <Command shouldFilter={!serverSideSearch}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={(q) => {
              if (onSearchChange) onSearchChange(q);
            }}
          />
          <CommandList className={searchableSelectListClass}>
            <CommandEmpty>{serverSideSearch ? serverEmptyMessage : emptyText}</CommandEmpty>
            <CommandGroup>
              {clearable && value && (
                <CommandItem
                  key="__clear__"
                  value={clearLabel}
                  className={searchableSelectItemClass}
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
                  value={optionSearchValue(option)}
                  className={cn(
                    searchableSelectItemClass,
                    (option.details?.length || option.description) && "items-start py-2.5",
                  )}
                  onSelect={() => {
                    onValueChange(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 mt-0.5 shrink-0", value === option.value ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col min-w-0 w-full gap-0.5">
                    <span className="truncate font-medium">{option.label}</span>
                    {option.details?.length ? (
                      <OptionDetails details={option.details} />
                    ) : option.description ? (
                      <span className="text-[11px] text-muted-foreground truncate">{option.description}</span>
                    ) : null}
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

export default SearchableSelect;
