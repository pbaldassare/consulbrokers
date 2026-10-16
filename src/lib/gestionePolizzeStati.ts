/**
 * Stati titolo per operazioni in Gestione polizze.
 * Sostituzione: allineata ad AzioniPolizzaToolbar (blocco solo annullata/estinta/sostituita).
 * Con «polizza = prima rata incassabile» la madre è spesso `incassato` dopo messa a cassa.
 */

export const STATI_POLIZZA_BLOCCATI_SOSTITUZIONE = [
  "annullata",
  "annullato",
  "estinta",
  "estinto",
  "sostituita",
] as const;

/** Stati inclusi nel filtro lista «Sostituzione» (query `.in('stato', …)`). */
export const STATI_SOSTITUZIONE_GESTIONE: readonly string[] = [
  "attivo",
  "incassato",
  "sospeso",
  "scaduto",
  "stornato",
];

export function isPolizzaSostituibileStato(stato: string | null | undefined): boolean {
  if (!stato) return false;
  if ((STATI_POLIZZA_BLOCCATI_SOSTITUZIONE as readonly string[]).includes(stato)) return false;
  return (STATI_SOSTITUZIONE_GESTIONE as readonly string[]).includes(stato);
}
