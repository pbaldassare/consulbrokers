export type SinistriListFilters = {
  quickSearch: string;
  clienteId: string;
  clienteLabel: string;
  controparte: string;
  tipo: string;
  numero: string;
  polizza: string;
  stato: string;
  compagniaId: string;
  compagniaLabel: string;
  terzi: string;
  responsabileId: string;
  responsabileLabel: string;
  dataDa: string;
  dataA: string;
};

export const EMPTY_SINISTRI_FILTERS: SinistriListFilters = {
  quickSearch: "",
  clienteId: "",
  clienteLabel: "",
  controparte: "",
  tipo: "",
  numero: "",
  polizza: "",
  stato: "tutti",
  compagniaId: "tutti",
  compagniaLabel: "",
  terzi: "tutti",
  responsabileId: "tutti",
  responsabileLabel: "",
  dataDa: "",
  dataA: "",
};

export function sanitizePostgrestTerm(raw: string): string {
  return raw.replace(/[,()]/g, " ").replace(/%/g, "").replace(/\s+/g, " ").trim();
}

export type SinistriFilterChip = { key: keyof SinistriListFilters | "cliente" | "date"; label: string };

export function sinistriFilterChips(
  filters: SinistriListFilters,
  tipoLabel?: string,
): SinistriFilterChip[] {
  const chips: SinistriFilterChip[] = [];
  if (filters.quickSearch.trim()) chips.push({ key: "quickSearch", label: `Testo: ${filters.quickSearch.trim()}` });
  if (filters.clienteId) chips.push({ key: "cliente", label: `Cliente: ${filters.clienteLabel || "selezionato"}` });
  if (filters.controparte.trim()) chips.push({ key: "controparte", label: `Controparte: ${filters.controparte.trim()}` });
  if (filters.tipo) chips.push({ key: "tipo", label: `Tipo: ${tipoLabel || filters.tipo}` });
  if (filters.numero.trim()) chips.push({ key: "numero", label: `N. sinistro: ${filters.numero.trim()}` });
  if (filters.polizza.trim()) chips.push({ key: "polizza", label: `Polizza: ${filters.polizza.trim()}` });
  if (filters.stato && filters.stato !== "tutti") {
    chips.push({ key: "stato", label: `Stato: ${filters.stato === "bozza" ? "Bozza" : filters.stato === "archiviato" ? "Archiviato" : filters.stato.replace(/_/g, " ")}` });
  }
  if (filters.compagniaId && filters.compagniaId !== "tutti") {
    chips.push({ key: "compagniaId", label: `Compagnia: ${filters.compagniaLabel || "selezionata"}` });
  }
  if (filters.terzi === "terzi") chips.push({ key: "terzi", label: "Sinistro Terzi" });
  if (filters.terzi === "con_polizza") chips.push({ key: "terzi", label: "Con polizza" });
  if (filters.responsabileId && filters.responsabileId !== "tutti") {
    chips.push({ key: "responsabileId", label: `Responsabile: ${filters.responsabileLabel || "selezionato"}` });
  }
  if (filters.dataDa || filters.dataA) {
    const range = [filters.dataDa || "…", filters.dataA || "…"].join(" → ");
    chips.push({ key: "date", label: `Apertura: ${range}` });
  }
  return chips;
}

export function hasSinistriFilters(filters: SinistriListFilters): boolean {
  return sinistriFilterChips(filters).length > 0;
}
