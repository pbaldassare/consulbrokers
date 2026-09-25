import { SearchableSelect } from "@/components/SearchableSelect";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
  /** Testo secondario mostrato sotto il label (es. codice agenzia) */
  description?: string;
  /** Testo usato per la ricerca; se omesso usa label + description */
  searchText?: string;
}

interface FilterSearchableSelectProps {
  value: string | null;
  onValueChange: (v: string | null) => void;
  options: FilterOption[];
  placeholder: string;
  allLabel: string;
  className?: string;
  loading?: boolean;
}

export function FilterSearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  allLabel,
  className,
  loading,
}: FilterSearchableSelectProps) {
  return (
    <SearchableSelect
      options={options}
      value={value || ""}
      onValueChange={(v) => onValueChange(v || null)}
      placeholder={allLabel}
      searchPlaceholder={`Cerca ${placeholder.toLowerCase()}...`}
      emptyText="Nessun risultato"
      clearable
      clearLabel={allLabel}
      loading={loading}
      className={cn("bg-background", className)}
    />
  );
}
