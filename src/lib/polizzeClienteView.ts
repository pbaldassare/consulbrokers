// Helpers PURI usati dalla vista "Polizze · Quietanze" del ClienteDetail.
// Estratti per testabilità: stessa semantica del componente PolizzeClienteTable.
import { groupTitoliByPolizza, type TitoloLike, type CatenaPolizza } from "./quietanze";

export type FiltroTipo = "tutti" | "polizze" | "quietanze";

/** showRate del componente: chevron/espansione SOLO in modalità "tutti" e se ci sono rate. */
export function shouldShowRate(filtroTipo: FiltroTipo, hasRate: boolean): boolean {
  return filtroTipo === "tutti" && hasRate;
}

/**
 * Vista flat delle quietanze (mode="quietanze"): per ogni catena emette N righe
 * (una per rata) con il `madreNum` e `madreId` della polizza madre.
 *
 * NB: la polizza madre è il contratto, NON una rata. Le quietanze sono numerate
 * 1..N su N = c.rate.length (numero di figli, esclusa la madre).
 */
export function computeFlatQuietanze<T extends TitoloLike>(
  catene: CatenaPolizza<T>[],
): { rata: T; madreNum: string | null; madreId: string | null; idx: number; totale: number }[] {
  const out: { rata: T; madreNum: string | null; madreId: string | null; idx: number; totale: number }[] = [];
  for (const c of catene) {
    const head = c.madre || c.all[0];
    const madreNum = head?.numero_titolo ?? null;
    const madreId = head?.id ?? null;
    const totale = c.rate.length;
    c.rate.forEach((r, i) => out.push({ rata: r, madreNum, madreId, idx: i + 1, totale }));
  }
  return out;
}


/**
 * Conteggi mostrati nella toolbar (polizze / quietanze) — sono calcolati sui titoli
 * filtrati indipendentemente dalla modalità di rendering. Sono quindi stabili
 * tra "tutti", "polizze" e "quietanze".
 */
export function computeCounts<T extends TitoloLike>(titoli: T[]): {
  polizze: number;
  quietanze: number;
} {
  let polizze = 0;
  let quietanze = 0;
  for (const t of titoli) {
    if (t.sostituisce_polizza) quietanze++;
    else polizze++;
  }
  return { polizze, quietanze };
}

/**
 * Numero di righe che la tabella renderizza per una data modalità, dato
 * l'insieme delle catene e lo stato di espansione (per "tutti").
 */
export function computeRenderedRowCount<T extends TitoloLike>(
  catene: CatenaPolizza<T>[],
  filtroTipo: FiltroTipo,
  expanded: Record<string, boolean> = {},
): number {
  if (filtroTipo === "quietanze") {
    return computeFlatQuietanze(catene).length;
  }
  if (filtroTipo === "polizze") {
    // una riga per catena (madre o fallback all[0]); niente chevron, niente figlie
    return catene.length;
  }
  // tutti: madre + (se espansa) tutte le rate
  let n = 0;
  for (const c of catene) {
    n += 1;
    if (expanded[c.numero] && c.rate.length > 0) n += c.rate.length;
  }
  return n;
}

// Re-export per comodità nei test
export { groupTitoliByPolizza };
