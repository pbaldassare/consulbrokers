import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

const round2 = (n: number) => Math.round(n * 100) / 100;

const todayISO = () => new Date().toISOString().slice(0, 10);

const CAUSALE_STOP_RE =
  /\s+(CIG|RINNOVO|POLIZZ[AE]|PAGAMENTO|LIQUIDAZIONE|Info aggiuntive|PERP|RAMO|CYBER|CREAZIONE|ASSICURATIV).*$/i;

/** Estrae il pagatore da descrizione movimento (BCC, Intesa, ecc.) quando manca colonna Ordinante. */
export function extractOrdinanteFromDescrizione(descrizione: string): string {
  const desc = String(descrizione ?? "").trim();
  if (!desc) return "";

  const ordinanteLabel = desc.match(/ORDINANTE[:\s]+([^/\n]+?)(?:\s{2,}|$|CRO|TRN|IBAN)/i);
  if (ordinanteLabel) return ordinanteLabel[1].trim();

  const da = desc.match(/DA\s+([A-ZÀ-Ü][A-ZÀ-Ü0-9\s&.'-]+?)(?:\s{2,}|$|CRO|TRN|IBAN)/);
  if (da) return da[1].trim();

  const bcc = desc.match(/Bonifico\s+a\s+vs\s+favore\s+\*([^*]+)/i);
  if (bcc) {
    let name = bcc[1].trim();
    name = name.replace(CAUSALE_STOP_RE, "").trim();
    name = name.replace(/\s+\d{4}-\d{5,}-\d{6,}.*$/, "").trim();
    name = name.replace(/\s+\d{10,}.*$/, "").trim();
    return name;
  }

  return desc.split(/\s{2,}|;|\|/)[0].slice(0, 120).trim();
}

/** Normalizza chiavi colonna Excel/CSV (spazi; BOM). */
export function normalizeExcelRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.replace(/^\uFEFF/, "").trim(), v]),
  );
}

/** Risolve ordinante: colonna dedicata, altrimenti estrazione da descrizione. */
export function resolveOrdinanteImport(
  ordinanteRaw: string,
  descrizione: string,
): string {
  const fromCol = String(ordinanteRaw ?? "").trim();
  if (fromCol) return fromCol;
  return extractOrdinanteFromDescrizione(descrizione);
}

/** Importo numerico da cella (IT: 1.234,56 / EN: 1234.56). */
export function parseImportoBancario(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw == null || raw === "") return 0;
  let s = String(raw).replace(/[€$\s]/g, "").trim();
  if (!s) return 0;
  if (/^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Data movimento da cella (preferisce gg/mm/aaaa italiani e ISO). */
export function parseDataBancaria(raw: unknown): string {
  if (raw == null || raw === "") return todayISO();
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    // Estratti CSV spesso sono midnight UTC → usa UTC per non spostare il giorno
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, "0");
    const d = String(raw.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof raw === "number") {
    const d = XLSX.SSF?.parse_date_code?.(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // gg/mm/aaaa (estratti IT)
  const it = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (it) {
    const y = it[3].length === 2 ? `20${it[3]}` : it[3];
    const day = Number(it[1]);
    const month = Number(it[2]);
    // Se giorno > 12 è sicuramente IT; se mese > 12 invertito; altrimenti assume IT
    if (day > 12 || month <= 12) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return todayISO();
}

export type ColonneEstratto = {
  data: string | null;
  importo: string | null;
  avere: string | null;
  dare: string | null;
  ordinante: string | null;
  descrizione: string | null;
  clienteId: string | null;
};

export function detectColonneEstratto(cols: string[]): ColonneEstratto {
  const find = (...res: RegExp[]) => cols.find((c) => res.some((re) => re.test(c))) || null;
  return {
    data:
      find(/valuta/i) ||
      find(/data\s*contabile/i) ||
      find(/^data$/i) ||
      find(/^data/i) ||
      cols[0] ||
      null,
    importo: find(/^importo$/i) || find(/importo|amount/i),
    avere: find(/^avere$/i) || find(/avere|accredito|^credito$/i),
    dare: find(/^dare$/i) || find(/dare|addebito|^debito$/i),
    ordinante: find(/^ordinante$/i) || find(/ordinante|mittente|controparte/i),
    descrizione: find(/descri/i) || find(/causale|operazione/i),
    clienteId: find(/cliente\s*id/i),
  };
}

/**
 * Importo da riga estratto: colonna Importo, oppure Avere (entrate).
 * Solo Dare (uscite) → importo 0 con motivo solo_dare.
 */
export function resolveImportoEstratto(
  row: Record<string, unknown>,
  cols: ColonneEstratto,
): { importo: number; motivo?: string } {
  if (cols.importo) {
    const n = Math.abs(parseImportoBancario(row[cols.importo]));
    if (n > 0) return { importo: n };
    return { importo: 0, motivo: "importo_zero_o_invalido" };
  }
  const avere = cols.avere ? Math.abs(parseImportoBancario(row[cols.avere])) : 0;
  const dare = cols.dare ? Math.abs(parseImportoBancario(row[cols.dare])) : 0;
  if (avere > 0) return { importo: avere };
  if (dare > 0) return { importo: 0, motivo: "solo_dare" };
  return { importo: 0, motivo: "importo_zero_o_invalido" };
}

/** Etichette italiane per i motivi di scarto import. */
export const MOTIVO_SCARTO_LABEL: Record<string, string> = {
  solo_dare: "Uscita (Dare): non è un accredito — esclusa dall'import",
  duplicato: "Già presente in archivio (stessa data, importo, ordinante, descrizione)",
  importo_zero_o_invalido: "Importo mancante o non valido",
};

export function labelMotivoScarto(motivo: string | null | undefined): string {
  if (!motivo) return "Motivo non indicato";
  return MOTIVO_SCARTO_LABEL[motivo] || motivo;
}

export type PreviewRigaEstratto = {
  riga: number;
  data_movimento: string;
  importo: number | null;
  ordinante: string | null;
  descrizione: string | null;
  esito: "ok" | "scarto";
  motivo: string | null;
};

export type PreviewEstratto = {
  nomeFile: string;
  colonne: ColonneEstratto;
  righeFile: number;
  daImportare: number;
  scarti: number;
  scartiByMotivo: Record<string, number>;
  preview: PreviewRigaEstratto[];
  rawRows: Record<string, unknown>[];
};

/** Anteprima parsing (senza dedup DB) per conferma import. */
export function buildPreviewEstratto(fileName: string, rows: Record<string, unknown>[]): PreviewEstratto {
  const cols = detectColonneEstratto(Object.keys(rows[0] || {}));
  const scartiByMotivo: Record<string, number> = {};
  let daImportare = 0;
  const preview: PreviewRigaEstratto[] = [];

  rows.forEach((r, idx) => {
    const riga = idx + 2;
    const descrizione = cols.descrizione ? String(r[cols.descrizione] ?? "").trim() : "";
    const ordinante =
      resolveOrdinanteImport(cols.ordinante ? String(r[cols.ordinante] ?? "") : "", descrizione) || null;
    const data_movimento = parseDataBancaria(cols.data ? r[cols.data] : null);
    const { importo, motivo } = resolveImportoEstratto(r, cols);
    if (!importo) {
      const m = motivo || "importo_zero_o_invalido";
      scartiByMotivo[m] = (scartiByMotivo[m] || 0) + 1;
      if (preview.length < 40) {
        preview.push({
          riga,
          data_movimento,
          importo: null,
          ordinante,
          descrizione: descrizione || null,
          esito: "scarto",
          motivo: m,
        });
      }
      return;
    }
    daImportare += 1;
    if (preview.length < 40) {
      preview.push({
        riga,
        data_movimento,
        importo,
        ordinante,
        descrizione: descrizione || null,
        esito: "ok",
        motivo: null,
      });
    }
  });

  const scarti = Object.values(scartiByMotivo).reduce((s, n) => s + n, 0);
  return {
    nomeFile: fileName,
    colonne: cols,
    righeFile: rows.length,
    daImportare,
    scarti,
    scartiByMotivo,
    preview,
    rawRows: rows,
  };
}

export function countByMotivo(motivi: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of motivi) {
    out[m] = (out[m] || 0) + 1;
  }
  return out;
}

/** Legge Excel o CSV (delimiter ; o ,) in righe oggetto. */
export async function readEstrattoBancarioRows(file: File): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv") || name.endsWith(".txt");
  let wb: XLSX.WorkBook;

  if (isCsv) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    // Fallback se file Windows-1252 con caratteri rotti
    if ((text.match(/\uFFFD/g) || []).length > 5) {
      text = new TextDecoder("windows-1252").decode(buf);
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }
    const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || "";
    const semi = (firstLine.match(/;/g) || []).length;
    const comma = (firstLine.match(/,/g) || []).length;
    const FS = semi > comma ? ";" : ",";
    wb = XLSX.read(text, { type: "string", FS, cellDates: true });
  } else {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: "array", cellDates: true });
  }

  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return (XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true }) as Record<string, unknown>[]).map(
    normalizeExcelRow,
  );
}

/** Conti bancari visibili per una sede (per filtrare movimenti). */
export async function fetchContoIdsForUfficio(ufficioId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("conti_bancari_uffici" as any)
    .select("conto_bancario_id")
    .eq("ufficio_id", ufficioId);
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => r.conto_bancario_id as string);
}

/** Primo ufficio collegato al conto (per ufficio_id su import senza cliente). */
export async function resolveUfficioFromConto(contoBancarioId: string): Promise<string | null> {
  const { data } = await supabase
    .from("conti_bancari_uffici" as any)
    .select("ufficio_id")
    .eq("conto_bancario_id", contoBancarioId)
    .limit(1)
    .maybeSingle();
  return (data as any)?.ufficio_id ?? null;
}

export interface FinalizeMovimentoParams {
  movimentoId: string;
  clienteId: string;
  contoBancarioId: string | null;
  dataMessaCassa: string;
  anticipoImporto: number;
  ammancoImporto: number;
  polizzeLineIds: string[];
  userId: string | null;
  note?: string | null;
}

/**
 * Dopo messa a cassa da ricongiungimento: acconto eccedenza, ammanco contabile, chiusura movimento.
 */
export async function finalizeMovimentoBancarioIncasso(p: FinalizeMovimentoParams): Promise<void> {
  const today = p.dataMessaCassa || new Date().toISOString().slice(0, 10);

  if (p.polizzeLineIds.length > 0) {
    const { error: errMp } = await supabase
      .from("movimenti_polizze" as any)
      .update({ messo_a_cassa: true, data_messa_cassa: today } as any)
      .in("id", p.polizzeLineIds)
      .eq("tipo", "polizza");
    if (errMp) throw errMp;
  }

  const ant = round2(Number(p.anticipoImporto) || 0);
  if (ant > 0) {
    const { error: errAnt } = await supabase.from("cliente_anticipi" as any).insert({
      cliente_id: p.clienteId,
      conto_bancario_id: p.contoBancarioId,
      movimento_bancario_id: p.movimentoId,
      data_anticipo: today,
      importo: ant,
      importo_residuo: ant,
      note: p.note ?? `Eccedenza bonifico movimento ${p.movimentoId.slice(0, 8)}`,
      creato_da: p.userId,
    } as any);
    if (errAnt) throw errAnt;
  }

  const amm = round2(Number(p.ammancoImporto) || 0);
  if (amm > 0) {
    const { data: mov } = await supabase
      .from("movimenti_bancari" as any)
      .select("ufficio_id")
      .eq("id", p.movimentoId)
      .maybeSingle();
    const ufficioId = (mov as any)?.ufficio_id ?? null;
    const { error: errMc } = await supabase.from("movimenti_contabili" as any).insert({
      ufficio_id: ufficioId,
      tipo: "uscita",
      categoria: "ammanco_ricongiungimento",
      riferimento_tipo: "movimento_bancario",
      riferimento_id: p.movimentoId,
      importo: amm,
      data_movimento: today,
      descrizione: `Ammanco bonifico (${p.movimentoId.slice(0, 8)})`,
      stato: "registrato",
      created_by: p.userId,
    } as any);
    if (errMc) throw errMc;
  }

  const { error: errMb } = await supabase
    .from("movimenti_bancari" as any)
    .update({ stato: "incassato" } as any)
    .eq("id", p.movimentoId);
  if (errMb) throw errMb;
}

/** Assegna pagatore (cliente pre-matchato) al movimento. */
export async function assegnaPagatoreMovimento(
  movimentoId: string,
  clienteId: string,
  ufficioId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("movimenti_bancari" as any)
    .update({
      cliente_id: clienteId,
      ufficio_id: ufficioId,
      stato: "assegnato",
    } as any)
    .eq("id", movimentoId);
  if (error) throw error;
}
