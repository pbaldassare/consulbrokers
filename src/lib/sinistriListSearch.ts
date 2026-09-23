import { resolveClienteNome, type ClienteEcAnagrafica } from "@/lib/ecClienteAnagrafica";

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

/** Campi ordinabili nella lista `/sinistri` (Elenco/Ricerca). */
export const SINISTRI_SORT_FIELDS = [
  "numero_sinistro",
  "cliente",
  "polizza",
  "controparte",
  "tipo_sinistro",
  "stato",
  "compagnia_id",
  "data_evento",
  "data_apertura",
  "data_denuncia",
  "created_at",
] as const;

export type SinistriSortField = (typeof SINISTRI_SORT_FIELDS)[number];

export type SinistriSortDirection = "asc" | "desc";

export type SinistriOrderClause = {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
};

export function isRelatedSinistriSort(field: SinistriSortField): field is "cliente" | "polizza" {
  return field === "cliente" || field === "polizza";
}

/**
 * Mapping campo UI → `.order()` PostgREST/Supabase (paginazione `.range` sul resultset ordinato).
 * Cliente/Polizza: top-level order su relazione many-to-one (`order=clienti(col)` / `titoli(numero_titolo)`).
 * Data accadimento = colonna `sinistri.data_evento` (non esiste `data_accadimento`).
 */
export function sinistriOrderClauses(
  field: SinistriSortField,
  direction: SinistriSortDirection,
): SinistriOrderClause[] {
  const ascending = direction === "asc";
  switch (field) {
    case "cliente":
      return [
        { column: "clienti(ragione_sociale)", ascending, nullsFirst: false },
        { column: "clienti(cognome)", ascending, nullsFirst: false },
        { column: "clienti(nome)", ascending, nullsFirst: false },
      ];
    case "polizza":
      return [
        { column: "titoli(numero_titolo)", ascending, nullsFirst: false },
        { column: "numero_polizza", ascending, nullsFirst: false },
      ];
    case "data_evento":
      return [{ column: "data_evento", ascending, nullsFirst: false }];
    default:
      return [{ column: field, ascending }];
  }
}

export function applySinistriOrder<
  T extends { order: (column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => T },
>(query: T, field: SinistriSortField, direction: SinistriSortDirection): T {
  return sinistriOrderClauses(field, direction).reduce(
    (acc, clause) =>
      acc.order(clause.column, {
        ascending: clause.ascending,
        ...(clause.nullsFirst === undefined ? {} : { nullsFirst: clause.nullsFirst }),
      }),
    query,
  );
}

type TitoliEmbed = { numero_titolo?: string | null } | { numero_titolo?: string | null }[] | null | undefined;

function unwrapTitoli(titoli: TitoliEmbed): { numero_titolo?: string | null } | null {
  if (titoli == null) return null;
  return Array.isArray(titoli) ? titoli[0] ?? null : titoli;
}

function unwrapCliente(
  clienti: ClienteEcAnagrafica | ClienteEcAnagrafica[] | null | undefined,
): ClienteEcAnagrafica | null {
  if (clienti == null) return null;
  return Array.isArray(clienti) ? clienti[0] ?? null : clienti;
}

/** Stesso valore mostrato in colonna Polizza. */
export function sinistroPolizzaDisplay(s: {
  sinistro_terzi?: boolean | null;
  numero_polizza?: string | null;
  titoli?: TitoliEmbed;
}): string {
  const titoli = unwrapTitoli(s.titoli);
  const raw = s.sinistro_terzi ? (s.numero_polizza || "") : (titoli?.numero_titolo || "");
  return raw.trim() || "—";
}

export function sinistroClienteSortKey(
  clienti: ClienteEcAnagrafica | ClienteEcAnagrafica[] | null | undefined,
): string {
  const nome = resolveClienteNome(unwrapCliente(clienti));
  return nome === "—" ? "" : nome.toLocaleLowerCase("it");
}

export function sinistroPolizzaSortKey(s: {
  sinistro_terzi?: boolean | null;
  numero_polizza?: string | null;
  titoli?: TitoliEmbed;
}): string {
  const d = sinistroPolizzaDisplay(s);
  return d === "—" ? "" : d.toLocaleLowerCase("it");
}

export type SinistriRelatedSortRow = {
  id: string;
  clienti?: ClienteEcAnagrafica | ClienteEcAnagrafica[] | null;
  sinistro_terzi?: boolean | null;
  numero_polizza?: string | null;
  titoli?: TitoliEmbed;
};

export function sortSinistriRelatedRows<T extends SinistriRelatedSortRow>(
  rows: T[],
  field: "cliente" | "polizza",
  direction: SinistriSortDirection,
): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const ak = field === "cliente" ? sinistroClienteSortKey(a.clienti) : sinistroPolizzaSortKey(a);
    const bk = field === "cliente" ? sinistroClienteSortKey(b.clienti) : sinistroPolizzaSortKey(b);
    const cmp = ak.localeCompare(bk, "it", { numeric: true, sensitivity: "base" });
    if (cmp !== 0) return sign * cmp;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function paginateSortedIds(ids: string[], from: number, to: number): string[] {
  if (from < 0 || to < from) return [];
  return ids.slice(from, to + 1);
}
