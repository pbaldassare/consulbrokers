export type StatoContrattoRisolto = {
  isAnnullato: boolean;
  isEstinto: boolean;
  isSospeso: boolean;
  isAttivo: boolean;
  /** Badge contratto: non mostrare "attiva" se il titolo è già chiuso. */
  polizzaStatoDisplay: string | null;
};

/**
 * Lo stato sul titolo vince sul contratto `polizze` (che può restare "attiva"
 * se il titolo è una duplica agganciata a un'altra polizza).
 */
export function resolveStatoContrattoTitolo(
  titoloStato: string | null | undefined,
  polizzaStato: string | null | undefined,
): StatoContrattoRisolto {
  const ts = (titoloStato || "").toLowerCase();
  const ps = (polizzaStato || "").toLowerCase();
  const isAnnullato = ts === "annullato" || ps === "annullata";
  const isEstinto = ts === "estinto" || ps === "estinta";
  const isSospeso = !isAnnullato && !isEstinto && (ts === "sospeso" || ps === "sospesa");
  const isAttivo =
    !isAnnullato && !isEstinto && !isSospeso && (ps === "attiva" || ts === "attivo" || (!ps && ts === "attivo"));
  const polizzaStatoDisplay = isAnnullato
    ? "annullata"
    : isEstinto
      ? "estinta"
      : polizzaStato ?? null;
  return { isAnnullato, isEstinto, isSospeso, isAttivo, polizzaStatoDisplay };
}
