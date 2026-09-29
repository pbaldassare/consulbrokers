import { isAppendice, isQuietanza, type TitoloLike } from "@/lib/quietanze";

export type TitoloStoricoLike = TitoloLike & {
  riga?: number | null;
  premio_lordo?: number | null;
};

/**
 * Prima quietanza della catena: ordine garanzia_da, riga, created_at.
 * Diventa la polizza nello storico (le altre restano quietanze).
 */
export function scegliPrimaQuietanza<T extends TitoloStoricoLike>(rate: T[]): T | null {
  const qs = rate.filter((t) => isQuietanza(t));
  if (qs.length === 0) return null;
  return [...qs].sort((a, b) => {
    const da = a.garanzia_da || a.created_at || "";
    const db = b.garanzia_da || b.created_at || "";
    if (da !== db) return da.localeCompare(db);
    const ra = a.riga ?? 0;
    const rb = b.riga ?? 0;
    if (ra !== rb) return ra - rb;
    return (a.created_at || "").localeCompare(b.created_at || "");
  })[0];
}

/**
 * Vecchio modello: la madre ripete il premio della prima quietanza sullo stesso periodo.
 * In quel caso i totali non devono sommare la madre (doppio conteggio).
 */
export function isCatenaModelloVecchio<T extends TitoloStoricoLike>(
  madre: T | null | undefined,
  rate: T[],
): boolean {
  if (!madre || isAppendice(madre) || rate.length === 0) return false;
  const prima = scegliPrimaQuietanza(rate);
  if (!prima) return false;
  const stessoPeriodo =
    !madre.garanzia_da || !prima.garanzia_da || madre.garanzia_da === prima.garanzia_da;
  if (!stessoPeriodo) return false;
  const pm = Number(madre.premio_lordo) || 0;
  const pq = Number(prima.premio_lordo) || 0;
  return Math.abs(pm - pq) < 0.02;
}
