/** Cliente ha pagato il premio direttamente alla compagnia (broker incassa solo la logica di chiusura / provvigione). */
export const TIPO_PAGAMENTO_DIREITO_COMPAGNIA = "pagamento_diretto_compagnia";

/** Incasso registrato come costi Consulbrokers (interno); verso agenzia trattato come bonifico. */
export const TIPO_PAGAMENTO_COSTI_CONSULBROKERS = "costi_consulbrokers";

/** Incasso registrato come compensazione (interno); verso agenzia trattato come bonifico. */
export const TIPO_PAGAMENTO_COMPENSAZIONE = "compensazione";

/** Messa a cassa completa senza inviare la comunicazione all'agenzia/compagnia. */
export const TIPO_PAGAMENTO_INCASSO_ZERO = "incasso_zero";

export const TIPI_PAGAMENTO_MESSA_CASSA = [
  { value: "contanti", label: "Contanti" },
  { value: "pos", label: "POS" },
  { value: "bonifico", label: "Bonifico" },
  { value: "assegno", label: "Assegno" },
  { value: TIPO_PAGAMENTO_COSTI_CONSULBROKERS, label: "Costi Consulbrokers" },
  { value: TIPO_PAGAMENTO_COMPENSAZIONE, label: "Compensazione" },
  { value: TIPO_PAGAMENTO_DIREITO_COMPAGNIA, label: "Pagamento diretto compagnia" },
  { value: TIPO_PAGAMENTO_INCASSO_ZERO, label: "Messa a cassa a zero" },
] as const;

export function isPagamentoDirettoCompagnia(tipo: string | null | undefined): boolean {
  return (tipo || "").toLowerCase() === TIPO_PAGAMENTO_DIREITO_COMPAGNIA;
}

export function isTipoPagamentoIncassoZero(tipo: string | null | undefined): boolean {
  return (tipo || "").toLowerCase() === TIPO_PAGAMENTO_INCASSO_ZERO;
}

export function isTipoPagamentoCostiConsulbrokers(tipo: string | null | undefined): boolean {
  return (tipo || "").toLowerCase() === TIPO_PAGAMENTO_COSTI_CONSULBROKERS;
}

export function isTipoPagamentoCompensazione(tipo: string | null | undefined): boolean {
  return (tipo || "").toLowerCase() === TIPO_PAGAMENTO_COMPENSAZIONE;
}

/**
 * Tipi che internamente hanno codice proprio ma verso agenzia/E/C/notifica
 * si comportano come bonifico (label "Bonifico", codice MI "B", niente conto obbligatorio).
 */
export function isTipoPagamentoAliasBonificoEsterno(tipo: string | null | undefined): boolean {
  const tp = (tipo || "").toLowerCase();
  return (
    tp === "bonifico" ||
    tp === TIPO_PAGAMENTO_COSTI_CONSULBROKERS ||
    tp === TIPO_PAGAMENTO_COMPENSAZIONE
  );
}

/** Label modalità incasso per email notifica agenzia. */
export function resolveTipoPagamentoPerNotificaAgenzia(tipo: string | null | undefined): string {
  const tp = (tipo || "").toLowerCase();
  if (
    tp === "bonifico" ||
    tp === "garantito" ||
    tp === TIPO_PAGAMENTO_COSTI_CONSULBROKERS ||
    tp === TIPO_PAGAMENTO_COMPENSAZIONE
  ) {
    return "Bonifico bancario";
  }
  const labels: Record<string, string> = {
    contanti: "Contanti",
    assegno: "Assegno",
    pos: "POS / Carta",
    carta_credito: "POS / Carta",
    rid: "RID / Addebito SEPA",
  };
  return labels[tp] || (tipo || "—");
}

/** Label leggibile della modalità di incasso mostrata nell'interfaccia. */
export function resolveTipoPagamentoLabel(tipo: string | null | undefined): string {
  const valore = (tipo || "").trim();
  const tp = valore.toLowerCase();

  const labels: Record<string, string> = {
    bonifico: "Bonifico",
    contanti: "Contanti",
    assegno: "Assegno",
    pos: "POS / Carta",
    carta_credito: "POS / Carta",
    rid: "RID / Addebito SEPA",
    garantito: "Garantito",
    [TIPO_PAGAMENTO_COSTI_CONSULBROKERS]: "Costi Consulbrokers",
    [TIPO_PAGAMENTO_COMPENSAZIONE]: "Compensazione",
    [TIPO_PAGAMENTO_DIREITO_COMPAGNIA]: "Pagamento diretto compagnia",
    anticipo: "Acconto",
    anticipo_misto: "Acconto + altro pagamento",
    [TIPO_PAGAMENTO_INCASSO_ZERO]: "Messa a cassa a zero",
  };

  if (labels[tp]) return labels[tp];
  if (!valore) return "Modalità non registrata";

  return valore
    .replace(/_/g, " ")
    .replace(/\b\w/g, (lettera) => lettera.toUpperCase());
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

  // La modalità scelta deve restare salvata anche in presenza di acconti o compensazioni:
  // è il discriminante persistente che impedisce la notifica all'agenzia.
  if (isTipoPagamentoIncassoZero(principale)) {
    return TIPO_PAGAMENTO_INCASSO_ZERO;
  }

  if (dovuto === 0 && usatoAnticipi === 0) {
    return TIPO_PAGAMENTO_INCASSO_ZERO;
  }

  if (principale === "bonifico") {
    return "bonifico";
  }

  if (isTipoPagamentoCostiConsulbrokers(principale)) {
    return TIPO_PAGAMENTO_COSTI_CONSULBROKERS;
  }

  if (isTipoPagamentoCompensazione(principale)) {
    return TIPO_PAGAMENTO_COMPENSAZIONE;
  }

  if (usatoAnticipi > 0) {
    if (anticipiDaContoBancario && residuoCash === 0) {
      return "bonifico";
    }
    return residuoCash > 0 ? "anticipo_misto" : "anticipo";
  }

  return tipoPagamentoPrincipale || "contanti";
}
