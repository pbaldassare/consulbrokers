import { SearchableSelect } from "@/components/SearchableSelect";
import { TEMPLATE_SEDE_GLOBALE, sedeFormValue, sedeToUfficioId } from "@/lib/emailBrandingSede";

export type UfficioOption = { id: string; nome_ufficio: string; codice_ufficio: string | null };

export function sedeOptions(uffici: UfficioOption[]) {
  return [
    { value: TEMPLATE_SEDE_GLOBALE, label: "Globale (tutte le sedi)" },
    ...uffici.map((u) => ({
      value: u.id,
      label: `${u.codice_ufficio || "—"} — ${u.nome_ufficio}`,
    })),
  ];
}

export function SedeTemplateSelect({
  uffici,
  value,
  onChange,
  placeholder = "Seleziona sede...",
  className,
}: {
  uffici: UfficioOption[];
  value: string | null | undefined;
  onChange: (ufficioId: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <SearchableSelect
      options={sedeOptions(uffici)}
      value={sedeFormValue(value)}
      onValueChange={(v) => onChange(sedeToUfficioId(v))}
      placeholder={placeholder}
      searchPlaceholder="Cerca sede..."
      className={className}
    />
  );
}
