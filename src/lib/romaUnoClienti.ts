/**
 * Mapping elenco clienti gestionale Roma Uno → anagrafiche CBnet.
 *
 * Scelte chiuse con il broker:
 * - Tutto collegato alla sede Roma Uno (`009` / gestionerm@consulbrokers.it).
 * - Mail mancante o non valida → mail dell'account Roma Uno.
 * - Mail presente sul file → si tiene quella.
 * - CF / P.IVA inventati SOLO se obbligatori e mancanti/non validi.
 * - Righe `_nuovo_cliente` saltate.
 * - Niente doppioni: se CF o P.IVA CBnet già esiste, si collega (ufficio → Roma Uno)
 *   senza sovrascrivere l'anagrafica.
 */

import {
  cleanCodiceFiscalePersona,
  cleanPartitaIva,
  extractEmails,
  inferFormaGiuridica,
  inferTipoCliente,
  isDummyTaxId,
  matchCatalogoCliente,
  normalizeTaxId,
  splitNomeCognome,
  type CatalogoClienteCBnet,
  type FormaGiuridicaCBnet,
  type TipoClienteCBnet,
} from "@/lib/romaExeClienti";
import { validateCF } from "@/lib/validateCF";
import { validatePIVA } from "@/lib/validatePIVA";

export const ROMA_UNO_UFFICIO_ID = "cdb3a9e1-2603-4147-819e-2bf5729c6731";
export const ROMA_UNO_UFFICIO_CODICE = "009";
export const ROMA_UNO_SEDE_EMAIL = "gestionerm@consulbrokers.it";
export const ROMA_UNO_INDIRIZZO = "Via Reno, 30";
export const ROMA_UNO_CAP = "00198";
export const ROMA_UNO_CITTA = "Roma";
export const ROMA_UNO_PROVINCIA = "RM";

export const ROMA_UNO_GRUPPI = {
  linea_persona: "a3d9b7c4-dacc-43bc-ba25-7829475a0697",
  aziende_private: "9f712168-3abc-4b09-b7f2-81e819848bd0",
  enti_territoriali: "0e090595-0f3e-475c-b70b-583ec70fb0b0",
  asd: "c0a26d1f-a4d4-4e43-ba9d-d1878d22b9fb",
} as const;

export type RomaUnoGruppoKey = keyof typeof ROMA_UNO_GRUPPI;

export type RomaUnoExcelRiga = {
  Codice?: string | number | null;
  Nome?: string | null;
  Indirizzo?: string | null;
  Cap?: string | number | null;
  Comune?: string | null;
  Prov?: string | null;
  Tel?: string | null;
  Email?: string | null;
  AttenDi?: string | null;
  "F/G"?: string | null;
  CF?: string | null;
  PIva?: string | null;
  Specialist?: string | null;
  GruFin?: string | null;
  GruStat?: string | null;
  Indotto?: string | null;
  Attivita?: string | null;
  Stato?: string | null;
};

export type RomaUnoClienteRisolto = {
  excelCodice: string;
  codiceCliente: string;
  tipoCliente: TipoClienteCBnet;
  ragioneSociale: string;
  nome: string | null;
  cognome: string | null;
  titolo: string | null;
  codiceFiscale: string | null;
  partitaIva: string | null;
  codiceFiscaleAzienda: string | null;
  formaGiuridica: FormaGiuridicaCBnet | null;
  gruppoKey: RomaUnoGruppoKey;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  email: string;
  pec: string | null;
  telefono: string | null;
  attenzioneDi: string | null;
  gruppoStatistico: string | null;
  indotto: string | null;
  attivita: string | null;
  statoCliente: "attivo" | "sospeso" | "non_operativo";
  attivo: boolean;
  note: string | null;
  cfInventato: boolean;
  pivaInventata: boolean;
  indirizzoInventato: boolean;
  emailFallback: boolean;
  esito: "esistente" | "da_creare" | "saltata";
  clienteId: string | null;
  motivo: string;
};

const CF_ODD: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const CF_EVEN: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12,
  N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

const CF_CHECK = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function trimCell(v: string | number | null | undefined): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

export function isRigaNuovoCliente(riga: RomaUnoExcelRiga): boolean {
  return /_nuovo_cliente/i.test(trimCell(riga.Nome)) || /_nuovo_cliente/i.test(trimCell(riga.Codice));
}

export function checksumCfPersona(first15: string): string {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const table = (i + 1) % 2 === 1 ? CF_ODD : CF_EVEN;
    sum += table[first15[i]] ?? 0;
  }
  return CF_CHECK[sum % 26];
}

export function inventCodiceFiscalePersona(seed: string, used: Set<string> = new Set()): string {
  const digits = seed.replace(/\D/g, "").padStart(6, "0").slice(-6);
  for (let n = 0; n < 4000; n++) {
    const year = String((80 + (n % 20)) % 100).padStart(2, "0");
    const day = String(((parseInt(digits.slice(2, 4), 10) + n) % 28) + 1).padStart(2, "0");
    const serial = String((parseInt(digits.slice(4, 6), 10) * 17 + n) % 1000).padStart(3, "0");
    const first15 = `RMUNOC${year}A${day}H${serial}`;
    const cf = first15 + checksumCfPersona(first15);
    if (!used.has(cf) && validateCF(cf, { allowPIVAFormat: false }).valid) {
      used.add(cf);
      return cf;
    }
  }
  throw new Error(`Impossibile inventare un CF valido per ${seed}`);
}

export function inventPartitaIva(seed: string, used: Set<string> = new Set()): string {
  const digits = seed.replace(/\D/g, "").padStart(6, "0").slice(-6);
  for (let n = 0; n < 4000; n++) {
    const body = `99${digits}${String(n).padStart(3, "0")}`.slice(0, 10);
    for (let check = 0; check <= 9; check++) {
      const piva = `${body}${check}`;
      if (!used.has(piva) && validatePIVA(piva).valid) {
        used.add(piva);
        return piva;
      }
    }
  }
  throw new Error(`Impossibile inventare una P.IVA valida per ${seed}`);
}

export function mapGruFin(raw: string | null | undefined, tipo: TipoClienteCBnet): RomaUnoGruppoKey {
  const g = trimCell(raw).toLowerCase();
  if (g.includes("linea persona")) return "linea_persona";
  if (g.includes("sportiva") || g.includes("asd")) return "asd";
  if (g.includes("enti pubblici") || g.includes("territorial")) return "enti_territoriali";
  if (g.includes("aziende private")) return "aziende_private";
  if (tipo === "privato") return "linea_persona";
  if (tipo === "ente") return "enti_territoriali";
  return "aziende_private";
}

export function mapStatoCliente(raw: string | null | undefined): {
  statoCliente: RomaUnoClienteRisolto["statoCliente"];
  attivo: boolean;
} {
  const s = trimCell(raw).toLowerCase();
  if (s.includes("sospeso")) return { statoCliente: "sospeso", attivo: true };
  if (s.includes("non attivo") || s.includes("non_operativo")) {
    return { statoCliente: "non_operativo", attivo: false };
  }
  return { statoCliente: "attivo", attivo: true };
}

function tipoDaExcel(riga: RomaUnoExcelRiga, cfPersona: string | null, piva: string | null, cfAzienda: string | null): TipoClienteCBnet {
  const fg = trimCell(riga["F/G"]).toUpperCase();
  const gf = trimCell(riga.GruFin).toLowerCase();
  if (gf.includes("enti pubblici") || gf.includes("territorial")) return "ente";
  if (fg === "F") return "privato";
  if (fg === "G") {
    return inferTipoCliente(trimCell(riga.Nome), cfPersona, piva, cfAzienda) === "ente" ? "ente" : "azienda";
  }
  return inferTipoCliente(trimCell(riga.Nome), cfPersona, piva, cfAzienda);
}

export function resolveRomaUnoCliente(
  riga: RomaUnoExcelRiga,
  catalogo: CatalogoClienteCBnet[] = [],
  opts?: { usedTax?: Set<string>; ufficioId?: string | null },
): RomaUnoClienteRisolto {
  const codice = trimCell(riga.Codice);
  const ragione = trimCell(riga.Nome) || `CLIENTE ROMA UNO ${codice}`;

  if (isRigaNuovoCliente(riga)) {
    return {
      excelCodice: codice,
      codiceCliente: `RM1-${codice}`,
      tipoCliente: "azienda",
      ragioneSociale: ragione,
      nome: null,
      cognome: null,
      titolo: null,
      codiceFiscale: null,
      partitaIva: null,
      codiceFiscaleAzienda: null,
      formaGiuridica: null,
      gruppoKey: "aziende_private",
      indirizzo: ROMA_UNO_INDIRIZZO,
      cap: ROMA_UNO_CAP,
      citta: ROMA_UNO_CITTA,
      provincia: ROMA_UNO_PROVINCIA,
      email: ROMA_UNO_SEDE_EMAIL,
      pec: null,
      telefono: null,
      attenzioneDi: null,
      gruppoStatistico: null,
      indotto: null,
      attivita: null,
      statoCliente: "attivo",
      attivo: true,
      note: null,
      cfInventato: false,
      pivaInventata: false,
      indirizzoInventato: false,
      emailFallback: true,
      esito: "saltata",
      clienteId: null,
      motivo: "Riga placeholder _nuovo_cliente: non importata",
    };
  }

  const used = opts?.usedTax ?? new Set<string>();
  const cfRaw = trimCell(riga.CF);
  const pivaRaw = trimCell(riga.PIva);

  let cfPersona = cleanCodiceFiscalePersona(cfRaw);
  if (cfPersona && !validateCF(cfPersona, { allowPIVAFormat: false }).valid) cfPersona = null;

  let piva = cleanPartitaIva(pivaRaw);
  if (piva && !validatePIVA(piva).valid) piva = null;

  const cf11 = cleanPartitaIva(cfRaw);
  const cf11Valid = cf11 && validatePIVA(cf11).valid ? cf11 : null;
  if (!piva && !cfPersona && cf11Valid) piva = cf11Valid;
  let cfAzienda = cf11Valid && !cfPersona ? cf11Valid : piva;

  const tipo = tipoDaExcel(riga, cfPersona, piva, cfAzienda);
  const formaNome = inferFormaGiuridica(ragione);
  const forma: FormaGiuridicaCBnet | null =
    tipo === "privato"
      ? null
      : formaNome || (tipo === "ente" ? "ente_pubblico" : piva && cfPersona ? "ditta_individuale" : "altro");

  const noteParts: string[] = ["Import elenco clienti Roma Uno."];
  if (cfRaw && !cfPersona && !cf11Valid && !isDummyTaxId(cfRaw)) {
    noteParts.push(`CF file non importato (formato/checksum): ${normalizeTaxId(cfRaw)}`);
  }
  if (pivaRaw && !cleanPartitaIva(pivaRaw) && !isDummyTaxId(pivaRaw)) {
    noteParts.push(`P.IVA file non importata (formato/checksum): ${normalizeTaxId(pivaRaw)}`);
  }

  let cfInventato = false;
  let pivaInventata = false;
  if (tipo === "privato" && !cfPersona) {
    cfPersona = inventCodiceFiscalePersona(codice || ragione, used);
    cfInventato = true;
    noteParts.push("CF inventato in import: mancante o non valido sul file.");
  }
  if (tipo !== "privato" && !piva && !cfAzienda) {
    piva = inventPartitaIva(codice || ragione, used);
    cfAzienda = piva;
    pivaInventata = true;
    noteParts.push("P.IVA inventata in import: mancante o non valida sul file.");
  } else if (tipo !== "privato" && piva && !cfAzienda) {
    cfAzienda = piva;
  }

  const split = tipo === "privato" ? splitNomeCognome(ragione) : null;
  const mails = extractEmails(String(riga.Email ?? ""));
  const pec = mails.find((e) => e.includes("pec.")) || null;
  const emailOwn = mails.find((e) => e !== pec) || mails[0] || null;
  const emailFallback = !emailOwn;
  const email = emailOwn || ROMA_UNO_SEDE_EMAIL;

  const indirizzoFile = trimCell(riga.Indirizzo);
  const indirizzoInventato = !indirizzoFile;
  const indirizzo = indirizzoFile || ROMA_UNO_INDIRIZZO;
  const cap = trimCell(riga.Cap) || (indirizzoInventato ? ROMA_UNO_CAP : "");
  const citta = trimCell(riga.Comune) || (indirizzoInventato ? ROMA_UNO_CITTA : "");
  const provincia = (trimCell(riga.Prov) || (indirizzoInventato ? ROMA_UNO_PROVINCIA : "")).toUpperCase().slice(0, 2);
  if (indirizzoInventato) noteParts.push("Indirizzo assente sul file: usata sede Roma Uno (Via Reno 30).");

  if (emailOwn && emailOwn !== ROMA_UNO_SEDE_EMAIL) {
    noteParts.push(`Mail file: ${mails.join(", ")}`);
  }
  const specialist = trimCell(riga.Specialist);
  if (specialist) noteParts.push(`Specialist file: ${specialist}`);

  const taxReali = {
    cf: cfInventato ? null : cfPersona,
    piva: pivaInventata ? null : piva,
    cfAzienda: pivaInventata ? null : cfAzienda,
  };
  const hit = matchCatalogoCliente(taxReali, catalogo, opts?.ufficioId ?? ROMA_UNO_UFFICIO_ID);

  if (cfPersona) used.add(cfPersona);
  if (piva) used.add(piva);
  if (cfAzienda) used.add(cfAzienda);

  const { statoCliente, attivo } = mapStatoCliente(riga.Stato);

  return {
    excelCodice: codice,
    codiceCliente: `RM1-${codice}`,
    tipoCliente: tipo,
    ragioneSociale: ragione,
    nome: split?.nome || null,
    cognome: split?.cognome || null,
    titolo: split?.titolo || null,
    codiceFiscale: tipo === "privato" ? cfPersona : null,
    partitaIva: tipo === "privato" ? null : piva,
    codiceFiscaleAzienda: tipo === "privato" ? null : cfAzienda || piva,
    formaGiuridica: forma,
    gruppoKey: mapGruFin(riga.GruFin, tipo),
    indirizzo: indirizzo || ROMA_UNO_INDIRIZZO,
    cap: cap || ROMA_UNO_CAP,
    citta: citta || ROMA_UNO_CITTA,
    provincia: provincia || ROMA_UNO_PROVINCIA,
    email,
    pec,
    telefono: trimCell(riga.Tel) || null,
    attenzioneDi: trimCell(riga.AttenDi) || null,
    gruppoStatistico: trimCell(riga.GruStat) || null,
    indotto: trimCell(riga.Indotto) || null,
    attivita: trimCell(riga.Attivita) || null,
    statoCliente,
    attivo,
    note: noteParts.join("\n"),
    cfInventato,
    pivaInventata,
    indirizzoInventato,
    emailFallback,
    esito: hit ? "esistente" : "da_creare",
    clienteId: hit?.id || null,
    motivo: hit
      ? "CF/P.IVA già in CBnet: collegato a Roma Uno senza sovrascrivere"
      : "Nuova anagrafica Roma Uno",
  };
}

export function lookupRomaUnoClienteId(
  excelCodice: string | number | null | undefined,
  map: Array<{ excel_codice: string; cliente_id: string | null }>,
): string | null {
  if (excelCodice == null || excelCodice === "") return null;
  const key = String(excelCodice).trim();
  return map.find((r) => r.excel_codice === key)?.cliente_id ?? null;
}
