/**
 * Set di codici sottoramo (rami.codice) che rappresentano la garanzia
 * "principale" RCA Auto / RC Natanti / Corpi Nautica e che richiedono
 * la formula tasse:  lordo = netto + IPT + SSN
 *
 * Riusato sia in TitoloDetail (post-creazione) sia in Immissione Polizza
 * (creazione) per attivare la card RCA con sub-righe IPT/SSN.
 */
export const RCA_PRINCIPALE_CODES = new Set<string>([
  // Auto
  "PI", "QA", "QAC", "QC", "QF", "QG", "QR", "QU", "DAB", "PJ",
  // Natanti / Nautica
  "QN", "QT", "QNA", "DD", "DN", "DNA",
]);

export const isRcaPrincipaleCodice = (codice?: string | null): boolean => {
  if (!codice) return false;
  const c = String(codice).toUpperCase().trim();
  if (RCA_PRINCIPALE_CODES.has(c)) return true;
  if (c.startsWith("RV")) return true; // RV01..RV16 = tipi veicolo
  return false;
};

/** Aliquota fissa SSN in % */
export const SSN_PCT = 10.5;

/** Aliquota fissa IPT RCA Auto in % (Immissione Polizza) */
export const IPT_RCA_PCT = 16;
