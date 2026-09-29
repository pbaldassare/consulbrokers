/**
 * Genera CF / P.IVA di formato valido quando il gestionale non li ha.
 * Non sono identificativi reali: seed deterministico (sede + codice + nome)
 * + checksum italiano, univoci rispetto al set `taken`.
 */
import { validateCF } from "@/lib/validateCF";
import { validatePIVA } from "@/lib/validatePIVA";

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
const MONTH_LETTERS = ["A", "B", "C", "D", "E", "H", "L", "M", "P", "R", "S", "T"];
const VOWELS = new Set(["A", "E", "I", "O", "U"]);

export const COMUNE_CATASTALE: Record<string, string> = {
  MI: "F205",
  PR: "G337",
  PZ: "G942",
};

export function hash32(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function onlyLetters(raw: string): string {
  return raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z]/g, "");
}

function take3(word: string, isFirstName: boolean): string {
  const letters = onlyLetters(word) || "X";
  const cons = [...letters].filter((c) => !VOWELS.has(c));
  const vows = [...letters].filter((c) => VOWELS.has(c));
  if (isFirstName && cons.length >= 4) {
    return (cons[0] + cons[2] + cons[3]).padEnd(3, "X");
  }
  return (cons.join("") + vows.join("") + "XXX").slice(0, 3);
}

export function cfCheckChar(first15: string): string {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const table = (i + 1) % 2 === 1 ? ODD : EVEN;
    sum += table[first15[i]] ?? 0;
  }
  return CHECK_CHARS[sum % 26];
}

export function inventPartitaIva(seed: string, taken: Set<string> = new Set()): string {
  let n = hash32(`PIVA:${seed}`);
  for (let i = 0; i < 20000; i++) {
    const first10 = String(1000000000 + (n % 9000000000)).slice(0, 10);
    for (let d = 0; d <= 9; d++) {
      const cand = first10 + String(d);
      if (taken.has(cand)) continue;
      if (validatePIVA(cand).valid) {
        taken.add(cand);
        return cand;
      }
    }
    n = (n + 97) >>> 0;
  }
  throw new Error(`Impossibile inventare P.IVA per ${seed}`);
}

export function inventCodiceFiscale(opts: {
  seed: string;
  cognome: string;
  nome: string;
  comune?: string;
  taken?: Set<string>;
}): string {
  const taken = opts.taken ?? new Set<string>();
  const cognome3 = take3(opts.cognome || opts.nome || "CLIENTE", false);
  const nome3 = take3(opts.nome || opts.cognome || "NUOVO", true);
  const comune = opts.comune && /^[A-Z]\d{3}$/.test(opts.comune) ? opts.comune : "F205";
  let n = hash32(`CF:${opts.seed}`);

  for (let i = 0; i < 20000; i++) {
    const year = String(n % 100).padStart(2, "0");
    const month = MONTH_LETTERS[(n >>> 8) % 12];
    const female = ((n >>> 12) & 1) === 1;
    const dayNum = 1 + ((n >>> 13) % 28);
    const day = String(dayNum + (female ? 40 : 0)).padStart(2, "0");
    const first15 = `${cognome3}${nome3}${year}${month}${day}${comune}`;
    const cand = first15 + cfCheckChar(first15);
    if (!taken.has(cand) && validateCF(cand, { allowPIVAFormat: false }).valid) {
      taken.add(cand);
      return cand;
    }
    n = (n + 131) >>> 0;
  }
  throw new Error(`Impossibile inventare CF per ${opts.seed}`);
}
