import { isAppendice } from "@/lib/quietanze";

export const QUIETANZA_SCADENZA_SOGLIA_GIORNI = 60;

/** Titolo quietanza/appendice ancora da incassare. */
export function isTitoloNonIncassato(t: {
  stato?: string | null;
  data_messa_cassa?: string | null;
}): boolean {
  return t.stato === "attivo" && !t.data_messa_cassa;
}

type QuietanzaViewTitolo = {
  stato?: string | null;
  data_messa_cassa?: string | null;
  garanzia_da?: string | null;
  sostituisce_polizza?: string | null;
  is_appendice_modifica?: boolean | null;
  is_proroga?: boolean | null;
  is_regolazione?: boolean | null;
  numero_titolo?: string | null;
};

/**
 * Vista Quietanze cliente: solo titoli da incassare.
 * Rate: decorrenza (garanzia_da) entro soglia o già passata (arretrate).
 * Appendici: sempre visibili se non incassate.
 */
export function isQuietanzaDaMostrare(t: QuietanzaViewTitolo): boolean {
  if (!isTitoloNonIncassato(t)) return false;
  if (isAppendice(t)) return true;
  if (!t.sostituisce_polizza) return false;
  if (!t.garanzia_da) return true;
  const limite = new Date();
  limite.setHours(23, 59, 59, 999);
  limite.setDate(limite.getDate() + QUIETANZA_SCADENZA_SOGLIA_GIORNI);
  const decorrenza = new Date(t.garanzia_da);
  if (Number.isNaN(decorrenza.getTime())) return true;
  return decorrenza <= limite;
}

export function countQuietanzeDaIncassare(polizze: QuietanzaViewTitolo[]): number {
  return polizze.filter(
    (p) => (!!p.sostituisce_polizza || isAppendice(p)) && isQuietanzaDaMostrare(p),
  ).length;
}

/** Solo rate quietanza (esclude appendici) — per conteggi tab separati. */
export function countQuietanzeRateDaIncassare(polizze: QuietanzaViewTitolo[]): number {
  return polizze.filter(
    (p) => !!p.sostituisce_polizza && !isAppendice(p) && isQuietanzaDaMostrare(p),
  ).length;
}
