/** Campi titolo necessari per il calcolo provvigione E/C Agenzie/Compagnia. */
export type TitoloProvvigioneEC = {
  provvigioni_firma?: number | null;
  provvigioni_quietanza?: number | null;
  sostituisce_polizza?: string | null;
};

/**
 * Provvigione per titoli incassati in E/C Agenzie/Compagnia.
 * Evita il doppio conteggio firma + quietanza (es. quietanza incassata con entrambi a 150 → 150, non 300).
 *
 * Regola: il valore scritto a mano vince sempre, zero compreso.
 * - Quietanza/rata: solo provvigioni_quietanza (zero compreso).
 * - Polizza madre: provvigioni_firma se il campo è valorizzato (anche 0 esplicito);
 *   il fallback su provvigioni_quietanza scatta solo quando firma è null/vuoto
 *   (mai compilato, casi legacy).
 */
export function getProvvigioneEC(titolo: TitoloProvvigioneEC): number {
  const quietanza = Number(titolo.provvigioni_quietanza) || 0;
  if (titolo.sostituisce_polizza) return quietanza;
  if (titolo.provvigioni_firma !== null && titolo.provvigioni_firma !== undefined) {
    return Number(titolo.provvigioni_firma) || 0;
  }
  return quietanza;
}
