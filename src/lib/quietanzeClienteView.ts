import { isDaChiudereIncasso } from "@/lib/garantitoTitolo";
import { soloIncassabiliInSequenza, type TitoloSequenza } from "@/lib/messaCassaSequenza";
import { isAppendice, isPolizzaMadre } from "@/lib/quietanze";

export const QUIETANZA_SCADENZA_SOGLIA_GIORNI = 60;

/** Data limite (YYYY-MM-DD) per mostrare rate quietanza: oggi + soglia giorni. */
export function quietanzaSogliaGaranziaDa(now: Date = new Date()): string {
  const limite = new Date(now);
  limite.setHours(23, 59, 59, 999);
  limite.setDate(limite.getDate() + QUIETANZA_SCADENZA_SOGLIA_GIORNI);
  return limite.toISOString().slice(0, 10);
}

/** Titolo quietanza/appendice ancora da incassare. */
export function isTitoloNonIncassato(t: {
  stato?: string | null;
  data_messa_cassa?: string | null;
}): boolean {
  return t.stato === "attivo" && !t.data_messa_cassa;
}

type QuietanzaViewTitolo = {
  id?: string;
  numero_titolo?: string | null;
  compagnia_id?: string | null;
  riga?: number | null;
  stato?: string | null;
  data_messa_cassa?: string | null;
  data_copertura?: string | null;
  conferimento_gestito?: boolean | null;
  fondi_ricevuti?: boolean | null;
  tipo_pagamento?: string | null;
  garanzia_da?: string | null;
  sostituisce_polizza?: string | null;
  is_appendice_modifica?: boolean | null;
  is_proroga?: boolean | null;
  is_regolazione?: boolean | null;
};

function isEntroSogliaIncasso(
  t: Pick<QuietanzaViewTitolo, "garanzia_da">,
  now: Date,
): boolean {
  if (!t.garanzia_da) return true;
  const decorrenza = new Date(t.garanzia_da);
  if (Number.isNaN(decorrenza.getTime())) return true;
  return t.garanzia_da <= quietanzaSogliaGaranziaDa(now);
}

/**
 * Vista Quietanze cliente: solo le quietanze successive da incassare.
 * Decorrenza (garanzia_da) entro soglia o già passata (arretrate).
 * La polizza (prima rata) e le appendici NON compaiono nel tab Quietanze:
 * restano sotto la polizza, dove si fa la Messa a Cassa.
 */
export function isQuietanzaDaMostrare(t: QuietanzaViewTitolo): boolean {
  if (!isTitoloNonIncassato(t)) return false;
  if (isAppendice(t)) return false;
  if (isPolizzaMadre(t)) return false;
  return isEntroSogliaIncasso(t, new Date());
}

/**
 * Titolo da mostrare nel filtro cliente "Da incassare".
 * Usa la stessa semantica condivisa degli incassi:
 * - stato attivo e non ancora messo a cassa, oppure garantito ancora aperto;
 * - polizza (prima rata) e appendici sono incassabili;
 * - quietanze successive solo entro la soglia operativa.
 */
export function isTitoloClienteDaIncassare(
  t: QuietanzaViewTitolo,
  now: Date = new Date(),
): boolean {
  if (!isDaChiudereIncasso(t)) return false;
  if (isAppendice(t) || isPolizzaMadre(t)) return true;
  if (!t.sostituisce_polizza) return false;
  return isEntroSogliaIncasso(t, now);
}

/**
 * Titoli effettivamente incassabili: uno solo per catena (prima la polizza,
 * poi la quietanza successiva), più appendici e garantiti aperti.
 */
export function titoliClienteDaIncassare<T extends QuietanzaViewTitolo & { id: string }>(
  titoli: T[],
  now: Date = new Date(),
): T[] {
  return soloIncassabiliInSequenza(titoli as Array<T & TitoloSequenza>)
    .filter((t) => isTitoloClienteDaIncassare(t, now));
}

export function countTitoliClienteDaIncassare(
  titoli: Array<QuietanzaViewTitolo & { id: string }>,
  now: Date = new Date(),
): number {
  return titoliClienteDaIncassare(titoli, now).length;
}

/** Conteggio tab Quietanze: solo quietanze successive da mostrare (no polizza, no appendici). */
export function countQuietanzeDaIncassare(polizze: QuietanzaViewTitolo[]): number {
  return countQuietanzeRateDaIncassare(polizze);
}

/** Quietanze successive da incassare (esclude polizza e appendici) — per conteggi tab. */
export function countQuietanzeRateDaIncassare(polizze: QuietanzaViewTitolo[]): number {
  return polizze.filter((p) => isQuietanzaDaMostrare(p)).length;
}
