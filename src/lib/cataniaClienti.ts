/**
 * Mapping anagrafiche gestionale sede Catania → clienti CBnet.
 *
 * Decisioni chiuse con il broker (2026-10-01):
 * - Sede sempre Catania. Unit/Filiale Excel (Napoli/Milano/…) ignorate.
 * - Specialist sempre Turco Alida. Guarracino / Ghiglieri / Gestione Milano ignorati.
 * - Prod1/2/3 si agganciano tutti (Digital, Interfidi, Rondinella, Tranquillo, Baretto).
 * - Doppioni già attivi su altre sedi: si lasciano dove sono. P.IVA unica attiva → skip.
 * - CF non è univoco: omonimo/CF su altra sede si crea comunque a Catania.
 * - CF a 15 caratteri: si ricostruisce il carattere di controllo. Spazzatura → null.
 * - Ente con P.IVA nel campo CF: si copia su P.IVA / CF azienda. P.IVA a 10 cifre: pad.
 * - Mail mancante → catania@consulbrokers.it. Se più mail, si prende la prima.
 * - codice_ricerca = Codice gestionale; codice_cliente lo genera CBnet.
 * - Nessun UPDATE su righe di altre sedi. Nessuna polizza in questo giro.
 */

import { inferFormaGiuridica, splitNomeCognome } from "@/lib/romaExeClienti";
import {
  gruppoFinanziarioKey,
  inferTipoCampobasso,
  isDummyTaxId,
  isPecAddress,
  normalizeNomeKey,
  normalizeTaxId,
  padPartitaIva,
  trimTxt,
  type CatalogoClienteCBnet,
  type TipoClienteCBnet,
} from "@/lib/campobassoClienti";
import { cfCheckChar } from "@/lib/inventFiscalIds";
import { validateCF } from "@/lib/validateCF";
import { validatePIVA } from "@/lib/validatePIVA";

export const CATANIA_UFFICIO_CODICE = "CT";
export const CATANIA_SEDE_EMAIL = "catania@consulbrokers.it";
export const CATANIA_UFFICIO_ID = "d2c47452-4bb2-4b3b-8a24-a1606357e909";
export const CATANIA_TURCO_PROFILE_ID = "98513846-0b24-4517-bacc-c9278a4ee358";
export const CATANIA_FILIALE = "SEDE CATANIA";
export const CATANIA_TURCO_EMAIL = "aturco@consulbrokers.it";

export const CATANIA_ANAG_ALIASES: Record<string, string> = {
  "CONSULBROKERS DIGITAL SRL": "0be427e0-3fd4-44b5-a141-5d79596ae731",
  "CONSULBROKERS DIGITAL": "0be427e0-3fd4-44b5-a141-5d79596ae731",
  "INTERFIDI SRL": "cbe0e599-5f2e-4be9-b9d4-8b48347368d3",
  "INTERFIDI S R L": "cbe0e599-5f2e-4be9-b9d4-8b48347368d3",
  INTERFIDI: "cbe0e599-5f2e-4be9-b9d4-8b48347368d3",
  "RONDINELLA SALVATORE": "ffbe7308-271d-4136-950f-e2a0d2481263",
  RONDINELLA: "ffbe7308-271d-4136-950f-e2a0d2481263",
  "ALDO TRANQUILLO": "4cfb0c26-42be-41f1-88e0-e8b893728d2a",
  "TRANQUILLO ALDO": "4cfb0c26-42be-41f1-88e0-e8b893728d2a",
  "BARETTO SAMUELE": "85d7b262-1552-44b5-8488-9c6581d92353",
  "SAMUELE BARETTO": "85d7b262-1552-44b5-8488-9c6581d92353",
};

const CF16_RE =
  /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
const CF15_RE =
  /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}$/;

export type CataniaRiga = {
  Codice?: string | number | null;
  Nome?: string | null;
  Indirizzo?: string | null;
  Cap?: string | null;
  Comune?: string | null;
  Prov?: string | null;
  Tel?: string | null;
  Email?: string | null;
  AttenDi?: string | null;
  "F/G"?: string | null;
  CF?: string | null;
  PIva?: string | null;
  Brand?: string | null;
  Unit?: string | null;
  Specialist?: string | null;
  GruStat?: string | null;
  GruFin?: string | null;
  Prod1?: string | null;
  Prod2?: string | null;
  Prod3?: string | null;
  Indotto?: string | null;
  Filiale?: string | null;
  Zona?: string | null;
  Attivita?: string | null;
  SpecialistSX?: string | null;
  Stato?: string | null;
  Acquisito?: string | Date | number | null;
};

export type CatalogoCatania = CatalogoClienteCBnet & {
  attivo?: boolean | null;
};

export type CataniaEsito = "da_creare" | "collegare" | "saltato";

export type CataniaRisolto = {
  codice: string;
  tipoCliente: TipoClienteCBnet;
  ragioneSociale: string | null;
  nome: string | null;
  cognome: string | null;
  codiceFiscale: string | null;
  partitaIva: string | null;
  codiceFiscaleAzienda: string | null;
  formaGiuridica: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  email: string;
  pec: string | null;
  telefono: string | null;
  attenzioneDi: string | null;
  gruppoFinanziarioKey: "linea_persona" | "aziende_private" | "enti_territoriali" | "enti_no_lucro";
  gruppoStatistico: string | null;
  indotto: string | null;
  zona: string | null;
  attivita: string | null;
  specSx: string | null;
  brand: string;
  specialist: "Turco Alida";
  prod1: string | null;
  prod2: string | null;
  prod3: string | null;
  produttori: string[];
  dataAcquisito: string | null;
  esito: CataniaEsito;
  clienteId: string | null;
  motivo: string;
  pivaPadded: boolean;
  cfRicostruito: boolean;
};

export function isGarbageFiscal(raw: unknown): boolean {
  const t = trimTxt(raw);
  if (!t) return false;
  if (t.includes("@")) return true;
  const v = normalizeTaxId(t);
  if (isDummyTaxId(v)) return true;
  if (/[A-Z]{8,}/.test(v) && !/\d/.test(v)) return true;
  return false;
}

export function firstEmail(raw: unknown): string {
  const parts = trimTxt(raw)
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[0] || "";
}

export function resolveCataniaEmail(
  raw: string | null | undefined,
  sedeEmail = CATANIA_SEDE_EMAIL,
): { email: string; pec: string | null } {
  const first = firstEmail(raw).toLowerCase();
  const extras = trimTxt(raw)
    .split(/[;,]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s !== first);
  const looksMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(first);
  const pecExtra = extras.find((s) => isPecAddress(s)) || null;
  if (!looksMail) return { email: sedeEmail, pec: pecExtra };
  if (isPecAddress(first)) return { email: sedeEmail, pec: first };
  return { email: first, pec: pecExtra };
}

export function completePersonaCf(raw: unknown): {
  value: string | null;
  completed: boolean;
  garbage: boolean;
} {
  if (isGarbageFiscal(raw)) return { value: null, completed: false, garbage: true };
  const v = normalizeTaxId(raw);
  if (!v || isDummyTaxId(v)) return { value: null, completed: false, garbage: false };
  if (CF16_RE.test(v)) {
    const check = validateCF(v, { allowPIVAFormat: false });
    if (check.valid) return { value: v, completed: false, garbage: false };
    const first15 = v.slice(0, 15);
    if (CF15_RE.test(first15)) {
      return { value: first15 + cfCheckChar(first15), completed: true, garbage: false };
    }
    return { value: null, completed: false, garbage: true };
  }
  if (v.length === 15 && CF15_RE.test(v)) {
    return { value: v + cfCheckChar(v), completed: true, garbage: false };
  }
  return { value: null, completed: false, garbage: false };
}

export function usablePartitaIva(raw: unknown): { value: string | null; padded: boolean } {
  if (isGarbageFiscal(raw)) return { value: null, padded: false };
  const compact = normalizeTaxId(raw);
  if (!compact || /[A-Z]/.test(compact)) return { value: null, padded: false };
  const padded = padPartitaIva(raw);
  if (padded.value && /^\d{11}$/.test(padded.value)) return padded;
  return { value: null, padded: false };
}

export function interpretCataniaFiscal(cfRaw: unknown, pivaRaw: unknown): {
  cfPersona: string | null;
  piva: string | null;
  cfAzienda: string | null;
  completedCf: boolean;
  paddedPiva: boolean;
} {
  const persona = completePersonaCf(cfRaw);
  const pivaCol = usablePartitaIva(pivaRaw);
  const cfDigits = normalizeTaxId(cfRaw).replace(/\D/g, "");
  const cfAsPiva =
    !persona.value && !isGarbageFiscal(cfRaw) && /^\d{10,11}$/.test(cfDigits)
      ? usablePartitaIva(cfDigits)
      : { value: null, padded: false };
  const piva = pivaCol.value || cfAsPiva.value;
  return {
    cfPersona: persona.value,
    piva,
    cfAzienda: piva,
    completedCf: persona.completed,
    paddedPiva: pivaCol.padded || cfAsPiva.padded,
  };
}

export function mapProduttoreNome(raw: string | null | undefined): string | null {
  const k = normalizeNomeKey(raw);
  if (!k) return null;
  return CATANIA_ANAG_ALIASES[k] || null;
}

export function listProduttori(riga: Pick<CataniaRiga, "Prod1" | "Prod2" | "Prod3">): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [riga.Prod1, riga.Prod2, riga.Prod3]) {
    const name = trimTxt(raw);
    const key = normalizeNomeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function excelDateToIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}

export function matchGiaInSede(
  tax: { piva?: string | null; codice?: string | null; cf?: string | null },
  catalogo: CatalogoCatania[],
  ufficioId = CATANIA_UFFICIO_ID,
): CatalogoCatania | null {
  const inSede = catalogo.filter((c) => c.ufficio_id === ufficioId && c.attivo !== false);
  const codice = trimTxt(tax.codice);
  if (codice) {
    const byCod = inSede.find((c) => trimTxt(c.codice_ricerca) === codice);
    if (byCod) return byCod;
  }
  const piva = normalizeTaxId(tax.piva);
  if (piva) {
    const byPiva = inSede.find((c) => normalizeTaxId(c.partita_iva) === piva);
    if (byPiva) return byPiva;
  }
  const cf = normalizeTaxId(tax.cf);
  if (cf && cf.length === 16) {
    const byCf = inSede.find((c) => normalizeTaxId(c.codice_fiscale) === cf);
    if (byCf) return byCf;
  }
  return null;
}

export function matchPivaAttivaAltraSede(
  piva: string | null | undefined,
  catalogo: CatalogoCatania[],
  ufficioId = CATANIA_UFFICIO_ID,
): CatalogoCatania | null {
  const key = normalizeTaxId(piva);
  if (!key) return null;
  return (
    catalogo.find(
      (c) =>
        c.attivo !== false &&
        c.ufficio_id !== ufficioId &&
        normalizeTaxId(c.partita_iva) === key,
    ) || null
  );
}

export function resolveCataniaCliente(
  riga: CataniaRiga,
  catalogo: CatalogoCatania[] = [],
  opts?: { sedeEmail?: string; ufficioId?: string },
): CataniaRisolto {
  const codice = trimTxt(riga.Codice);
  const nome = trimTxt(riga.Nome);
  const fg = trimTxt(riga["F/G"]).toUpperCase();
  const gruFin = trimTxt(riga.GruFin);
  const sedeEmail = opts?.sedeEmail || CATANIA_SEDE_EMAIL;
  const ufficioId = opts?.ufficioId || CATANIA_UFFICIO_ID;

  const fiscal = interpretCataniaFiscal(riga.CF, riga.PIva);
  const tipo = inferTipoCampobasso({
    nome,
    fg,
    gruFin,
    cfPersona: fiscal.cfPersona,
    piva: fiscal.piva,
  });
  const codiceFiscale = tipo === "privato" ? fiscal.cfPersona : null;
  const codiceFiscaleAzienda = tipo === "privato" ? null : fiscal.cfPersona || fiscal.cfAzienda;
  const forma = tipo === "privato" ? null : inferFormaGiuridica(nome);
  const split = tipo === "privato" ? splitNomeCognome(nome) : null;
  const mail = resolveCataniaEmail(riga.Email, sedeEmail);
  const produttori = listProduttori(riga);

  const base: CataniaRisolto = {
    codice,
    tipoCliente: tipo,
    ragioneSociale: tipo === "privato" ? null : nome || null,
    nome: split?.nome || null,
    cognome: split?.cognome || null,
    codiceFiscale,
    partitaIva: fiscal.piva,
    codiceFiscaleAzienda,
    formaGiuridica: forma,
    indirizzo: trimTxt(riga.Indirizzo) || null,
    cap: trimTxt(riga.Cap) || null,
    citta: trimTxt(riga.Comune) || null,
    provincia: trimTxt(riga.Prov).toUpperCase() || null,
    email: mail.email,
    pec: mail.pec,
    telefono: trimTxt(riga.Tel) || null,
    attenzioneDi: trimTxt(riga.AttenDi) || null,
    gruppoFinanziarioKey: gruppoFinanziarioKey(tipo, gruFin),
    gruppoStatistico: trimTxt(riga.GruStat) || null,
    indotto: trimTxt(riga.Indotto) || null,
    zona: trimTxt(riga.Zona) || null,
    attivita: trimTxt(riga.Attivita) || null,
    specSx: trimTxt(riga.SpecialistSX) || null,
    brand: trimTxt(riga.Brand) || "Consulbrokers",
    specialist: "Turco Alida",
    prod1: trimTxt(riga.Prod1) || null,
    prod2: trimTxt(riga.Prod2) || null,
    prod3: trimTxt(riga.Prod3) || null,
    produttori,
    dataAcquisito: excelDateToIso(riga.Acquisito),
    esito: "da_creare",
    clienteId: null,
    motivo: "nuovo",
    pivaPadded: fiscal.paddedPiva,
    cfRicostruito: fiscal.completedCf,
  };

  if (!codice) {
    return { ...base, esito: "saltato", motivo: "senza_codice" };
  }

  const inSede = matchGiaInSede(
    { piva: fiscal.piva, codice, cf: codiceFiscale },
    catalogo,
    ufficioId,
  );
  if (inSede) {
    return {
      ...base,
      esito: "collegare",
      clienteId: inSede.id,
      motivo: "gia_in_sede_catania",
    };
  }

  const clash = matchPivaAttivaAltraSede(fiscal.piva, catalogo, ufficioId);
  if (clash) {
    return {
      ...base,
      esito: "saltato",
      clienteId: clash.id,
      motivo: "piva_gia_attiva_altra_sede",
    };
  }

  return base;
}

export function pickKeepersCatania(resolved: CataniaRisolto[]): {
  keepers: CataniaRisolto[];
  dups: CataniaRisolto[];
} {
  const seenTax = new Set<string>();
  const keepers: CataniaRisolto[] = [];
  const dups: CataniaRisolto[] = [];

  const rank = (r: CataniaRisolto) => {
    let n = 0;
    if (r.codiceFiscale) n += 3;
    if (r.partitaIva && validatePIVA(r.partitaIva).valid) n += 3;
    if (r.indirizzo) n += 1;
    if (r.email !== CATANIA_SEDE_EMAIL) n += 1;
    if (r.telefono) n += 1;
    return n;
  };

  const sorted = [...resolved].sort((a, b) => {
    if (a.esito !== b.esito) {
      if (a.esito === "collegare") return -1;
      if (b.esito === "collegare") return 1;
      if (a.esito === "saltato") return 1;
      if (b.esito === "saltato") return -1;
    }
    return rank(b) - rank(a) || a.codice.localeCompare(b.codice);
  });

  for (const r of sorted) {
    if (r.esito === "saltato") {
      dups.push(r);
      continue;
    }
    const keys = [r.codiceFiscale, r.partitaIva, r.codiceFiscaleAzienda]
      .map((x) => normalizeTaxId(x))
      .filter((x) => x.length >= 11);
    const clash = keys.find((k) => seenTax.has(k));
    if (clash && r.esito === "da_creare") {
      dups.push({ ...r, esito: "saltato", motivo: `doppione_file:${clash}` });
      continue;
    }
    for (const k of keys) seenTax.add(k);
    keepers.push(r);
  }

  return { keepers, dups };
}
