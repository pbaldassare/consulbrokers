/**
 * Anagrafiche e matching condivisi per i carichi sede (MI / PZ / PR).
 * Una sola fonte per uffici, alias compagnia/cliente e match per nome.
 */
import { trimTxt } from "@/lib/campobassoPolizze";

export const SEDI_UFFICI = {
  MI: {
    codice: "MI",
    filiale: "MI",
    ufficioId: "193e0821-4105-4ad6-a72e-0ebb6c116797",
    email: "gestionemilano@consulbrokers.it",
    label: "Milano",
  },
  PZ: {
    codice: "PZ",
    filiale: "PZ",
    ufficioId: "e4f0d1f5-e344-4920-b178-d8754904a108",
    email: "potenza@consulbrokers.it",
    label: "Potenza",
  },
  PR: {
    codice: "PR",
    filiale: "PR",
    ufficioId: "a0d09b81-777d-43be-9615-e9d051786e2c",
    email: "parma@consulbrokers.it",
    label: "Parma",
  },
} as const;

export type SedeCodice = keyof typeof SEDI_UFFICI;

export const SEDI_TIPI_PIPQ = new Set(["PI", "PQ"]);
export const SEDI_TIPI_EXTRA = new Set(["AM", "PR", "PS", "DP", "AP"]);

export const SEDI_COMPAGNIA_ALIAS: Record<string, string> = {
  VIT000: "VIT104",
  REA100: "REAPZ0",
  REAASL: "REAPZ0",
  UNIASL: "FON105",
  COFSOL: "SOL",
  BALCIA: "B0699",
  XLKRM: "B0715",
  AIB000: "AIB",
};

/** Codice file gestionale → codice_ricerca già in CBnet (stesso soggetto). */
export const SEDI_CLIENTE_ALIAS: Record<string, string> = {
  "006881": "000909",
  "011023": "002591",
  "015924": "D02885",
};

const STOPWORDS = new Set([
  "DI", "DEL", "DELLA", "DELLE", "DEI", "DEGLI", "E", "C", "SAS", "SRL", "SRLS",
  "SPA", "SNC", "SS", "SOC", "COOP", "COOPERATIVA", "SOCIETA", "SOCIETÀ", "&",
  "THE", "DA", "IN",
]);

export type SediTipoFile = "PI" | "PQ" | "AM" | "AP" | "PR" | "PS" | "DP" | "altro";

export function fileTipoTitolo(raw: unknown): SediTipoFile {
  const t = trimTxt(raw).toUpperCase();
  if (t === "PI" || t === "PQ" || t === "AM" || t === "AP" || t === "PR" || t === "PS" || t === "DP") {
    return t;
  }
  return "altro";
}

export function isTipoPipq(tipoTit: unknown): boolean {
  return SEDI_TIPI_PIPQ.has(trimTxt(tipoTit).toUpperCase());
}

export function isTipoExtra(tipoTit: unknown): boolean {
  return SEDI_TIPI_EXTRA.has(trimTxt(tipoTit).toUpperCase());
}

export function mapCompagniaCodiceSede(cdComp: unknown): string {
  const raw = trimTxt(cdComp).toUpperCase();
  if (!raw) return "";
  return SEDI_COMPAGNIA_ALIAS[raw] ?? raw;
}

export function fileClienteKey(cdClie: unknown): string {
  return trimTxt(cdClie).toUpperCase();
}

export function fileClienteCodici(cdClie: unknown): { file: string; canonico: string } {
  const file = fileClienteKey(cdClie);
  return { file, canonico: file ? (SEDI_CLIENTE_ALIAS[file] ?? file) : "" };
}

/** Codice file → codice_ricerca canonico (dopo alias). */
export function fileClienteCodiceCanonico(cdClie: unknown): string {
  return fileClienteCodici(cdClie).canonico;
}

export function normalizeDenominazione(raw: unknown): string {
  return trimTxt(raw)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function denominazioneKeys(raw: unknown): string[] {
  const n = normalizeDenominazione(raw);
  if (!n) return [];
  const tokens = n.split(" ").filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const meaningful = tokens.length ? tokens : n.split(" ").filter(Boolean);
  const sorted = [...meaningful].sort().join(" ");
  return [...new Set([n, sorted, meaningful.join(" ")].filter(Boolean))];
}

export function normalizeProduttoreKey(raw: unknown): string {
  const first = trimTxt(raw).split("/")[0];
  return first
    .toUpperCase()
    .replace(/[.'’]/g, "")
    .replace(/\bSRLS?\b/g, "")
    .replace(/\bSPA\b/g, "")
    .replace(/\bSAS\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function lookupProduttoreId(nome: unknown, catalog: Record<string, string>): string | null {
  const key = normalizeProduttoreKey(nome);
  if (!key) return null;
  if (catalog[key]) return catalog[key];
  const compact = key.replace(/\s+/g, "");
  if (catalog[compact]) return catalog[compact];
  for (const [k, id] of Object.entries(catalog)) {
    if (k.includes(key) || key.includes(k)) return id;
  }
  return null;
}

export function buildClienteNameIndex(
  rows: Array<{ id: string; ragione?: string | null; nome?: string | null; cognome?: string | null }>,
): Map<string, string> {
  const counts = new Map<string, Set<string>>();
  const add = (key: string, id: string) => {
    if (!key) return;
    const set = counts.get(key) ?? new Set<string>();
    set.add(id);
    counts.set(key, set);
  };
  for (const r of rows) {
    for (const key of denominazioneKeys(r.ragione)) add(key, r.id);
    const nc = `${trimTxt(r.nome)} ${trimTxt(r.cognome)}`;
    const cn = `${trimTxt(r.cognome)} ${trimTxt(r.nome)}`;
    for (const key of denominazioneKeys(nc)) add(key, r.id);
    for (const key of denominazioneKeys(cn)) add(key, r.id);
  }
  const index = new Map<string, string>();
  for (const [key, ids] of counts) {
    if (ids.size === 1) index.set(key, [...ids][0]);
  }
  return index;
}

export function matchClienteByNome(nomeFile: unknown, index: Map<string, string>): string | null {
  for (const key of denominazioneKeys(nomeFile)) {
    const id = index.get(key);
    if (id) return id;
  }
  return null;
}

export function yearsBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 1;
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 1;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000 / 365));
}

export { trimTxt };
