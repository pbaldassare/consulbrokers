// Validazione Codice Fiscale italiano (16 caratteri + carattere di controllo)
// Per persone giuridiche è ammesso anche il formato 11 cifre (uguale alla P.IVA).
import { validatePIVA } from "./validatePIVA";

export interface CFValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
  isPIVAFormat?: boolean;
}

const CF_REGEX = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;

const ODD: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const EVEN: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12,
  N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

const CHECK_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface ValidateCFOptions {
  /** Se true ammette anche CF azienda in formato 11 cifre (P.IVA). Default true. */
  allowPIVAFormat?: boolean;
}

export function validateCF(
  input: string | null | undefined,
  opts: ValidateCFOptions = {},
): CFValidationResult {
  const { allowPIVAFormat = true } = opts;
  if (!input || !input.trim()) {
    return { valid: false, error: "Codice Fiscale obbligatorio" };
  }
  const cf = input.replace(/\s+/g, "").toUpperCase();

  // Formato 11 cifre (CF azienda = P.IVA)
  if (/^\d{11}$/.test(cf)) {
    if (!allowPIVAFormat) {
      return { valid: false, error: "Codice Fiscale persona deve essere di 16 caratteri" };
    }
    const r = validatePIVA(cf);
    return { valid: r.valid, error: r.error, normalized: r.normalized, isPIVAFormat: true };
  }

  if (cf.length !== 16) {
    return { valid: false, error: `Codice Fiscale deve avere 16 caratteri (attuali: ${cf.length})` };
  }
  if (!CF_REGEX.test(cf)) {
    return { valid: false, error: "Formato Codice Fiscale non valido" };
  }
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const ch = cf[i];
    const table = (i + 1) % 2 === 1 ? ODD : EVEN; // posizione 1-based: dispari→ODD
    const v = table[ch];
    if (v === undefined) return { valid: false, error: "Carattere non valido nel CF" };
    sum += v;
  }
  const expected = CHECK_CHARS[sum % 26];
  if (expected !== cf[15]) {
    return { valid: false, error: "Codice Fiscale non valido (carattere di controllo errato)" };
  }
  return { valid: true, normalized: cf };
}

export function isCFValid(input: string | null | undefined, opts?: ValidateCFOptions): boolean {
  return validateCF(input, opts).valid;
}
