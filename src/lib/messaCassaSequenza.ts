/**
 * Sequenza di incasso per catena polizza (regola 30/09/2026).
 *
 * Nella catena polizza + quietanze si incassa solo il primo titolo non ancora
 * messo a cassa, in ordine di garanzia: prima la polizza, poi la rata/annualità
 * successiva. Una quietanza 2027 non si incassa se c'è ancora il 2026 aperto.
 * Appendici (AM / AP / PR) restano titoli a sé, fuori dalla sequenza.
 */
import { isGarantitoAperto } from "@/lib/garantitoTitolo";
import { isAppendice } from "@/lib/quietanze";

export type TitoloSequenza = {
  id: string;
  numero_titolo?: string | null;
  sostituisce_polizza?: string | null;
  compagnia_id?: string | null;
  riga?: number | null;
  garanzia_da?: string | null;
  stato?: string | null;
  data_messa_cassa?: string | null;
  conferimento_gestito?: boolean | null;
  tipo_pagamento?: string | null;
  data_copertura?: string | null;
  is_appendice_modifica?: boolean | null;
  is_proroga?: boolean | null;
  is_regolazione?: boolean | null;
};

const STATI_APERTI = new Set(["attivo", "sospeso"]);

export function chiaveCatenaIncasso(t: TitoloSequenza): string | null {
  if (isAppendice(t)) return null;
  const numero = (t.sostituisce_polizza || t.numero_titolo || "").trim();
  if (!numero) return null;
  return `${t.compagnia_id || ""}|${numero.toUpperCase()}`;
}

/** Ancora da mettere a cassa: blocca le rate successive della catena. */
export function isDaMettereACassa(t: TitoloSequenza): boolean {
  return STATI_APERTI.has(String(t.stato || "")) && !t.data_messa_cassa;
}

function ordineCatena(a: TitoloSequenza, b: TitoloSequenza): number {
  const aPol = a.sostituisce_polizza ? 1 : 0;
  const bPol = b.sostituisce_polizza ? 1 : 0;
  if (aPol !== bPol) return aPol - bPol;
  const g = (a.garanzia_da || "").localeCompare(b.garanzia_da || "");
  if (g !== 0) return g;
  return Number(a.riga ?? 0) - Number(b.riga ?? 0);
}

/**
 * Primo titolo della catena ancora da mettere a cassa (o null se tutto incassato).
 * Si parte dopo l'ultimo titolo già a cassa: titoli aperti rimasti indietro
 * (catene del modello precedente) non bloccano la catena.
 */
export function prossimoDaIncassare<T extends TitoloSequenza>(catena: T[]): T | null {
  const ordinata = [...catena].sort(ordineCatena);
  let start = 0;
  ordinata.forEach((t, i) => {
    if (t.data_messa_cassa) start = i + 1;
  });
  return ordinata.slice(start).find(isDaMettereACassa) ?? null;
}

export function raggruppaCatene<T extends TitoloSequenza>(titoli: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const t of titoli) {
    const k = chiaveCatenaIncasso(t);
    if (!k) continue;
    const list = map.get(k);
    if (list) list.push(t);
    else map.set(k, [t]);
  }
  return map;
}

/**
 * Titoli selezionabili per la Messa a Cassa: per ogni catena solo il prossimo,
 * più i garantiti ancora aperti (già a cassa, da chiudere) e le appendici aperte.
 */
export function soloIncassabiliInSequenza<T extends TitoloSequenza>(titoli: T[]): T[] {
  const prossimi = new Set<string>();
  for (const catena of raggruppaCatene(titoli).values()) {
    const next = prossimoDaIncassare(catena);
    if (next) prossimi.add(next.id);
  }
  return titoli.filter((t) => {
    if (!STATI_APERTI.has(String(t.stato || ""))) return false;
    if (isAppendice(t)) return !t.data_messa_cassa || isGarantitoAperto(t);
    if (prossimi.has(t.id)) return true;
    return !!t.data_messa_cassa && isGarantitoAperto(t);
  });
}

export type BloccoSequenza = {
  titoloId: string;
  numero: string;
  primaDa: { id: string; numero: string; garanziaDa: string | null };
};

/**
 * Titoli in distinta che non rispettano la sequenza.
 * `catene` = tutti i titoli delle catene coinvolte (letti dal DB).
 * Ogni catena ammette un solo titolo in distinta: il prossimo da incassare.
 */
export function verificaSequenzaIncasso(
  selezionatiIds: string[],
  catene: TitoloSequenza[],
): BloccoSequenza[] {
  const byId = new Map(catene.map((t) => [t.id, t]));
  const gruppi = raggruppaCatene(catene);
  const blocchi: BloccoSequenza[] = [];
  for (const id of selezionatiIds) {
    const t = byId.get(id);
    if (!t) continue;
    const k = chiaveCatenaIncasso(t);
    if (!k) continue;
    if (!isDaMettereACassa(t)) continue;
    const next = prossimoDaIncassare(gruppi.get(k) ?? []);
    if (!next || next.id === t.id) continue;
    blocchi.push({
      titoloId: t.id,
      numero: t.numero_titolo || t.id.slice(0, 8),
      primaDa: {
        id: next.id,
        numero: next.numero_titolo || next.id.slice(0, 8),
        garanziaDa: next.garanzia_da ?? null,
      },
    });
  }
  return blocchi;
}

export function messaggioBloccoSequenza(b: BloccoSequenza): string {
  const periodo = b.primaDa.garanziaDa
    ? ` (garanzia dal ${new Date(`${b.primaDa.garanziaDa}T00:00:00`).toLocaleDateString("it-IT")})`
    : "";
  return `${b.numero}: prima va incassato ${b.primaDa.numero}${periodo}`;
}
