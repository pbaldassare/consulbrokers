/** Stati pratica sinistro (colonna `sinistri.stato`, check Postgres). */

export const SINISTRO_STATO_ARCHIVIATO = "archiviato" as const;

export const SINISTRO_STATI = [
  "bozza",
  "in_valutazione",
  "aperto",
  "in_lavorazione",
  "in_attesa_documenti",
  "in_liquidazione",
  "chiuso",
  "respinto",
  "archiviato",
] as const;

export type SinistroStato = (typeof SINISTRO_STATI)[number];

/** Stati visibili di default in elenco/ricerca staff e nelle estrazioni. */
export const SINISTRO_STATI_OPERATIVI = SINISTRO_STATI.filter(
  (s) => s !== SINISTRO_STATO_ARCHIVIATO,
);

export const SINISTRO_STATI_TERMINALI = ["chiuso", "respinto", "archiviato"] as const;

export const SINISTRO_STATO_BADGE: Record<string, string> = {
  bozza: "bg-slate-100 text-slate-700 border border-slate-300",
  in_valutazione: "bg-amber-100 text-amber-800",
  aperto: "bg-blue-100 text-blue-800",
  in_lavorazione: "bg-yellow-100 text-yellow-800",
  in_attesa_documenti: "bg-orange-100 text-orange-800",
  in_liquidazione: "bg-purple-100 text-purple-800",
  chiuso: "bg-green-100 text-green-800",
  respinto: "bg-red-100 text-red-800",
  archiviato: "bg-gray-200 text-gray-700 border border-gray-300",
};

export function isArchiviato(stato?: string | null): boolean {
  return String(stato || "").toLowerCase() === SINISTRO_STATO_ARCHIVIATO;
}

export function isSinistroTerminale(stato?: string | null): boolean {
  return (SINISTRO_STATI_TERMINALI as readonly string[]).includes(String(stato || "").toLowerCase());
}

/** Aperto = non chiuso, non respinto, non archiviato. */
export function isSinistroAperto(stato?: string | null): boolean {
  return !isSinistroTerminale(stato);
}

/** Normalizza lo stato pratica per confronti (case, spazi, trattini). */
function normalizzaStatoSinistro(stato?: string | null): string {
  return String(stato || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Compagnia assicurativa modificabile in testata: sì per tutti gli stati
 * tranne `chiuso` e `archiviato` (e varianti di casing/spaziatura).
 */
export function puoModificareCompagniaSinistro(stato?: string | null): boolean {
  const s = normalizzaStatoSinistro(stato);
  return s !== "chiuso" && s !== "archiviato";
}

export function labelStatoSinistro(stato?: string | null): string {
  const s = String(stato || "").toLowerCase();
  if (!s) return "—";
  if (s === "bozza") return "Bozza";
  if (s === "in_valutazione") return "In valutazione";
  if (s === "archiviato") return "Archiviato";
  return s.replace(/_/g, " ");
}

export function statiVisibiliDefault(): readonly string[] {
  return SINISTRO_STATI_OPERATIVI;
}

export function excludeArchiviati<T extends { stato?: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => !isArchiviato(r.stato));
}

export type StatoListaFiltro = { kind: "eq" | "neq"; value: string };

/**
 * Elenco/Ricerca: "tutti" = tutti tranne archiviato.
 * Tab Archiviati: solo archiviato.
 * Filtro esplicito (anche archiviato) = eq su quello stato.
 */
export function resolveStatoFiltroLista(opts: {
  tab?: string;
  stato?: string;
}): StatoListaFiltro {
  if (opts.tab === "archiviati") {
    return { kind: "eq", value: SINISTRO_STATO_ARCHIVIATO };
  }
  if (opts.stato && opts.stato !== "tutti") {
    return { kind: "eq", value: opts.stato };
  }
  return { kind: "neq", value: SINISTRO_STATO_ARCHIVIATO };
}

export function applyStatoFiltroLista<
  Q extends { eq: (column: string, value: string) => Q; neq: (column: string, value: string) => Q },
>(q: Q, opts: { tab?: string; stato?: string }): Q {
  const filtro = resolveStatoFiltroLista(opts);
  return filtro.kind === "eq" ? q.eq("stato", filtro.value) : q.neq("stato", filtro.value);
}

/** Portale cliente e report: mai gli archiviati. */
export function applyFiltroPortaleCliente<Q extends { neq: (column: string, value: string) => Q }>(
  q: Q,
): Q {
  return q.neq("stato", SINISTRO_STATO_ARCHIVIATO);
}

/** Pagine operative (prescrizioni/reminder/SIR): default nascosti, visibili solo con filtro esplicito. */
export function applyStatoFiltroOperativo<
  Q extends { in: (column: string, values: string[]) => Q; neq: (column: string, value: string) => Q },
>(q: Q, statiSelezionati: string[], column = "stato"): Q {
  if (statiSelezionati.length > 0) return q.in(column, statiSelezionati);
  return q.neq(column, SINISTRO_STATO_ARCHIVIATO);
}
