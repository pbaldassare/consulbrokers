/**
 * Regole voci messa a cassa / acconti cliente.
 *
 * - Abbuoni e arrotondamenti: salvati su titoli_compensazioni (manuale),
 *   NON vanno in «Acconti» del cliente.
 * - Acconti: solo cliente_anticipi (scheda Acconti).
 * - Eccedenza / sconto commerciale / spese accessorie: non usate.
 */

/** Causali selezionabili in messa a cassa (abbuoni / arrotondamenti). */
export const CAUSALI_COMP_MESSA_CASSA_UI = [
  "ABB_ATT",
  "ABB_PAS",
  "ARROT_A",
  "ARROT_P",
] as const;

/** Causali per creazione manuale acconto cliente. */
export const CAUSALI_ACCONTO_CLIENTE = ["ACC_STOR", "ACC_CRED"] as const;

/** Causali da disattivare (non più selezionabili). */
export const CAUSALI_COMP_DISATTIVATE = ["ECCED", "SCONTO", "SPESE"] as const;

export type CodiceCompMessaCassaUi = (typeof CAUSALI_COMP_MESSA_CASSA_UI)[number];

export function isCausaleCompMessaCassaUi(codice: string | null | undefined): boolean {
  return !!codice && (CAUSALI_COMP_MESSA_CASSA_UI as readonly string[]).includes(codice);
}

export function isCausaleAccontoCliente(codice: string | null | undefined): boolean {
  if (!codice) return false;
  if ((CAUSALI_ACCONTO_CLIENTE as readonly string[]).includes(codice)) return true;
  return codice.startsWith("ACC_");
}
