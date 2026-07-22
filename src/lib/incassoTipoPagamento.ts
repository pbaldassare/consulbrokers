/** Cliente ha pagato il premio direttamente alla compagnia (broker incassa solo la logica di chiusura / provvigione). */
export const TIPO_PAGAMENTO_DIREITO_COMPAGNIA = "pagamento_diretto_compagnia";

export function isPagamentoDirettoCompagnia(tipo: string | null | undefined): boolean {
  return (tipo || "").toLowerCase() === TIPO_PAGAMENTO_DIREITO_COMPAGNIA;
}

/**
 * Risolve il tipo_pagamento da salvare su titoli in fase di messa a cassa.
 * Abbuono/compensazioni sono quadratura interna broker: non compaiono come
 * tipo_pagamento verso l'agenzia. Resta il mezzo reale (bonifico, contanti, …).
 */
export function resolveTipoPagamentoTitoloIncasso(opts: {
  dovuto: number;
  usatoAnticipi: number;
  residuoCash: number;
  haCompensazioni: boolean;
  tipoPagamentoPrincipale: string;
  /** true se gli acconti utilizzati provengono da conti bancari (incasso bonifico). */
  anticipiDaContoBancario?: boolean;
}): string {
  const { dovuto, usatoAnticipi, residuoCash, tipoPagamentoPrincipale, anticipiDaContoBancario } = opts;
  const principale = (tipoPagamentoPrincipale || "").toLowerCase();

  if (isPagamentoDirettoCompagnia(principale)) {
    return TIPO_PAGAMENTO_DIREITO_COMPAGNIA;
  }

  if (dovuto === 0 && usatoAnticipi === 0) {
    return "incasso_zero";
  }

  if (principale === "bonifico") {
    return "bonifico";
  }

  if (usatoAnticipi > 0) {
    if (anticipiDaContoBancario && residuoCash === 0) {
      return "bonifico";
    }
    return residuoCash > 0 ? "anticipo_misto" : "anticipo";
  }

  return tipoPagamentoPrincipale || "contanti";
}
