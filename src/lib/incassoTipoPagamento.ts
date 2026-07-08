/**
 * Risolve il tipo_pagamento da salvare su titoli in fase di messa a cassa.
 * Gli acconti utilizzati sono dettaglio contabile interno: se il pagamento
 * principale della sessione è bonifico, l'E/C agenzia deve mostrare Bonifico
 * su tutte le righe del batch (es. incasso multiplo da movimento bancario).
 */
export function resolveTipoPagamentoTitoloIncasso(opts: {
  dovuto: number;
  usatoAnticipi: number;
  residuoCash: number;
  haCompensazioni: boolean;
  tipoPagamentoPrincipale: string;
}): string {
  const { dovuto, usatoAnticipi, residuoCash, haCompensazioni, tipoPagamentoPrincipale } = opts;
  const principale = (tipoPagamentoPrincipale || "").toLowerCase();

  if (dovuto === 0 && !haCompensazioni && usatoAnticipi === 0) {
    return "incasso_zero";
  }
  if (haCompensazioni) {
    return usatoAnticipi > 0 ? "misto_compensato" : "compensato";
  }
  if (principale === "bonifico") {
    return "bonifico";
  }
  if (usatoAnticipi > 0) {
    return residuoCash > 0 ? "anticipo_misto" : "anticipo";
  }
  return tipoPagamentoPrincipale || "contanti";
}
