/** Titolo in fase copertura garantita (Garantito) senza incasso reale. */
export function isInCoperturaGarantita(t: {
  conferimento_gestito?: boolean | null;
  data_copertura?: string | null;
  data_messa_cassa?: string | null;
}): boolean {
  return !!t.conferimento_gestito && !!t.data_copertura && !t.data_messa_cassa;
}

/** Tab/filtro Garantiti: solo copertura confermata, non ancora messa a cassa. */
export function isGarantitoDaIncassare(t: {
  conferimento_gestito?: boolean | null;
  data_copertura?: string | null;
  data_messa_cassa?: string | null;
  stato?: string | null;
}): boolean {
  if (t.data_messa_cassa) return false;
  if (t.stato === "incassato") return false;
  return isInCoperturaGarantita(t);
}

export type GarantitoInput = {
  dataCopertura: string;
  dataDecorrenza: string;
};

/** Payload DB per conferma Garantito (solo copertura, senza incasso). */
export function buildGarantitoPayload(input: GarantitoInput): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);
  return {
    stato: "attivo",
    data_copertura: input.dataCopertura,
    data_decorrenza_rinnovo: input.dataDecorrenza,
    data_messa_cassa: null,
    data_incasso: null,
    data_pagamento: null,
    importo_incassato: null,
    banca_pagamento: null,
    tipo_pagamento: "garantito",
    conferimento_gestito: true,
    fondi_ricevuti: false,
    data_conferimento_gestito: today,
    updated_at: new Date().toISOString(),
  };
}
