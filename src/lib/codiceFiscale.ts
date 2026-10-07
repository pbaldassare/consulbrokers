/**
 * Calcolo del Codice Fiscale italiano delle persone fisiche (DM 23/12/1976).
 * Comuni: elenco ISTAT con codice catastale (public/data/comuni-catastali.json, [nome, sigla, codice]),
 * generato dal CSV "Elenco-comuni-italiani" di istat.it.
 * ponytail: solo comuni italiani vigenti; nati all'estero o in comuni soppressi → CF a mano.
 */

export type Sesso = "M" | "F";
/** [denominazione, sigla provincia, codice catastale] */
export type ComuneCatastale = [string, string, string];

const MESI = "ABCDEHLMPRST";
const VOCALI = /[AEIOU]/;

const DISPARI: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

/** Maiuscolo, senza accenti/apostrofi/spazi, solo lettere. */
function soloLettere(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function splitLettere(s: string) {
  const l = soloLettere(s).split("");
  return { cons: l.filter((c) => !VOCALI.test(c)), voc: l.filter((c) => VOCALI.test(c)) };
}

function codiceCognome(cognome: string): string {
  const { cons, voc } = splitLettere(cognome);
  return [...cons, ...voc, "X", "X", "X"].slice(0, 3).join("");
}

function codiceNome(nome: string): string {
  const { cons, voc } = splitLettere(nome);
  const c = cons.length >= 4 ? [cons[0], cons[2], cons[3]] : cons;
  return [...c, ...voc, "X", "X", "X"].slice(0, 3).join("");
}

export function carattereControllo(cf15: string): string {
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const ch = cf15[i];
    // posizioni 1,3,5… (indice 0,2,4…) sono "dispari"
    somma += i % 2 === 0 ? DISPARI[ch] : /\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 65;
  }
  return String.fromCharCode(65 + (somma % 26));
}

export function calcolaCodiceFiscale(d: {
  nome: string;
  cognome: string;
  sesso: Sesso;
  dataNascita: string; // YYYY-MM-DD
  codiceCatastale: string;
}): string {
  const [y, m, g] = d.dataNascita.split("-").map(Number);
  const giorno = g + (d.sesso === "F" ? 40 : 0);
  const cf15 =
    codiceCognome(d.cognome) +
    codiceNome(d.nome) +
    String(y % 100).padStart(2, "0") +
    MESI[m - 1] +
    String(giorno).padStart(2, "0") +
    d.codiceCatastale.toUpperCase();
  return cf15 + carattereControllo(cf15);
}

/**
 * Codice catastale dal luogo di nascita scritto come "Roma" o "Roma (RM)".
 * La provincia serve solo per i pochi comuni con lo stesso nome.
 */
export function risolviComune(
  luogo: string,
  comuni: ComuneCatastale[],
): { ok: true; comune: ComuneCatastale } | { ok: false; errore: string } {
  const m = luogo.trim().match(/^(.*?)\s*\(([A-Za-z]{2})\)$/);
  const testo = (m ? m[1] : luogo).trim();
  const sigla = m?.[2].toUpperCase();
  if (!testo) return { ok: false, errore: "Inserisci il luogo di nascita" };
  let trovati = comuni.filter((c) => soloLettere(c[0]) === soloLettere(testo));
  if (sigla) trovati = trovati.filter((c) => c[1] === sigla);
  if (!trovati.length) return { ok: false, errore: `Comune "${luogo.trim()}" non trovato tra i comuni italiani` };
  if (trovati.length > 1) {
    return { ok: false, errore: `Ci sono più comuni "${testo}": indica la provincia, es. ${trovati[0][0]} (${trovati[0][1]})` };
  }
  return { ok: true, comune: trovati[0] };
}
