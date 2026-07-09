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

}): string {

  const { dovuto, usatoAnticipi, residuoCash, tipoPagamentoPrincipale } = opts;

  const principale = (tipoPagamentoPrincipale || "").toLowerCase();



  if (dovuto === 0 && usatoAnticipi === 0) {

    return "incasso_zero";

  }



  if (principale === "bonifico") {

    return "bonifico";

  }



  if (usatoAnticipi > 0) {

    return residuoCash > 0 ? "anticipo_misto" : "anticipo";

  }



  return tipoPagamentoPrincipale || "contanti";

}


