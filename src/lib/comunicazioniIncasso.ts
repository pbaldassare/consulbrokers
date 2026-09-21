import { supabase } from "@/integrations/supabase/client";
import { formatClienteEc } from "@/lib/ecAgenziaDisplay";

export const DOC_CATEGORIA_NOTIFICA_INCASSO = "notifica_messa_cassa";
export const AZIONE_INCASSO_INVIATA = "notifica_messa_cassa_inviata";
export const AZIONE_INCASSO_ERRORE = "notifica_messa_cassa_errore";
const DOC_BUCKET_DEFAULT = "documenti_titoli";
const IN_CHUNK = 200;
const TITOLI_PAGE = 1000;

export type StatoComunicazioneIncasso = "inviato" | "non_inviato";
export type FiltroStatoIncasso = "tutti" | StatoComunicazioneIncasso;

export type DocumentoIncassoPreview = {
  id: string;
  nome_file: string;
  bucket_name: string;
  path_storage: string;
  created_at?: string | null;
};

export type ComunicazioneIncassoRow = {
  titoloId: string;
  numeroPolizza: string;
  clienteNome: string;
  agenziaNome: string;
  compagniaId: string | null;
  ufficioId: string | null;
  ufficioNome: string;
  dataMessaCassa: string | null;
  stato: StatoComunicazioneIncasso;
  inviatoIl: string | null;
  documento: DocumentoIncassoPreview | null;
};

export type GruppoSedeComunicazioni = {
  sedeId: string;
  sedeNome: string;
  rows: ComunicazioneIncassoRow[];
};

export type FetchComunicazioniIncassoParams = {
  giornoIncasso: string;
  ufficioId?: string | null;
  agenziaId?: string | null;
};

type ClienteSnippet = {
  ragione_sociale?: string | null;
  cognome?: string | null;
  nome?: string | null;
};

type AgenziaSnippet = {
  nome_rapporto?: string | null;
  sede_denominazione?: string | null;
};

type CompagniaSnippet = {
  nome?: string | null;
};

type UfficioSnippet = {
  nome_ufficio?: string | null;
};

type TitoloIncassoRaw = {
  id: string;
  numero_titolo: string | null;
  data_messa_cassa: string | null;
  compagnia_id: string | null;
  compagnia_rapporto_id: string | null;
  ufficio_id: string | null;
  clienti?: ClienteSnippet | ClienteSnippet[] | null;
  compagnie?: CompagniaSnippet | CompagniaSnippet[] | null;
  compagnia_rapporti?: AgenziaSnippet | AgenziaSnippet[] | null;
  uffici?: UfficioSnippet | UfficioSnippet[] | null;
};

type LogIncassoRaw = {
  entita_id: string | null;
  azione: string | null;
  created_at: string | null;
  dettagli_json: Record<string, unknown> | null;
};

type DocumentoRaw = {
  id: string;
  nome_file: string | null;
  bucket_name: string | null;
  path_storage: string | null;
  entita_id: string | null;
  created_at?: string | null;
};

export function todayISODate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function formatAgenziaRiferimento(
  rapporto: AgenziaSnippet | null | undefined,
  compagnia: CompagniaSnippet | null | undefined,
  fallbackLog?: string | null,
): string {
  const fromRapporto =
    rapporto?.nome_rapporto?.trim() || rapporto?.sede_denominazione?.trim() || "";
  const fromCompagnia = compagnia?.nome?.trim() || "";
  const fromLog = fallbackLog?.trim() || "";
  return fromRapporto || fromCompagnia || fromLog || "—";
}

export function resolveStatoIncasso(azione: string | null | undefined): StatoComunicazioneIncasso {
  return azione === AZIONE_INCASSO_INVIATA ? "inviato" : "non_inviato";
}

export function pickLogIncassoPreferito(logs: LogIncassoRaw[]): LogIncassoRaw | null {
  if (logs.length === 0) return null;
  const sorted = [...logs].sort((a, b) => {
    const aInv = a.azione === AZIONE_INCASSO_INVIATA ? 1 : 0;
    const bInv = b.azione === AZIONE_INCASSO_INVIATA ? 1 : 0;
    if (aInv !== bInv) return bInv - aInv;
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
  return sorted[0] ?? null;
}

export function filterComunicazioniByStato(
  rows: ComunicazioneIncassoRow[],
  stato: FiltroStatoIncasso,
): ComunicazioneIncassoRow[] {
  if (stato === "tutti") return rows;
  return rows.filter((r) => r.stato === stato);
}

export function groupComunicazioniBySede(rows: ComunicazioneIncassoRow[]): GruppoSedeComunicazioni[] {
  const map = new Map<string, GruppoSedeComunicazioni>();
  for (const row of rows) {
    const sedeId = row.ufficioId || "_none";
    const sedeNome = row.ufficioNome || "Sede non assegnata";
    const g = map.get(sedeId);
    if (g) g.rows.push(row);
    else map.set(sedeId, { sedeId, sedeNome, rows: [row] });
  }
  return [...map.values()].sort((a, b) => a.sedeNome.localeCompare(b.sedeNome, "it"));
}

export function paginateComunicazioni<T>(rows: T[], page: number, pageSize: number): T[] {
  const from = Math.max(0, page) * pageSize;
  return rows.slice(from, from + pageSize);
}

export function mapTitoloToComunicazione(
  titolo: TitoloIncassoRaw,
  log: LogIncassoRaw | null,
  documento: DocumentoIncassoPreview | null,
): ComunicazioneIncassoRow {
  const dettagli = log?.dettagli_json ?? null;
  const inviatoDaLog = log?.azione === AZIONE_INCASSO_INVIATA;
  const inviatoIl =
    (typeof dettagli?.inviato_il === "string" && dettagli.inviato_il) ||
    (inviatoDaLog ? log?.created_at : null) ||
    documento?.created_at ||
    null;
  return {
    titoloId: titolo.id,
    numeroPolizza: (titolo.numero_titolo || "").trim() || "—",
    clienteNome: formatClienteEc(unwrapOne(titolo.clienti)),
    agenziaNome: formatAgenziaRiferimento(
      unwrapOne(titolo.compagnia_rapporti),
      unwrapOne(titolo.compagnie),
      typeof dettagli?.agenzia === "string" ? dettagli.agenzia : null,
    ),
    compagniaId: titolo.compagnia_id,
    ufficioId: titolo.ufficio_id,
    ufficioNome: unwrapOne(titolo.uffici)?.nome_ufficio?.trim() || "Sede non assegnata",
    dataMessaCassa: titolo.data_messa_cassa,
    stato: inviatoDaLog || !!documento ? "inviato" : resolveStatoIncasso(log?.azione),
    inviatoIl,
    documento,
  };
}

function docFromRaw(d: DocumentoRaw | null | undefined): DocumentoIncassoPreview | null {
  if (!d?.path_storage) return null;
  return {
    id: d.id,
    nome_file: d.nome_file || "Avviso incasso.pdf",
    bucket_name: d.bucket_name || DOC_BUCKET_DEFAULT,
    path_storage: d.path_storage,
    created_at: d.created_at ?? null,
  };
}

function docFromLog(dettagli: Record<string, unknown> | null): DocumentoIncassoPreview | null {
  const path = typeof dettagli?.path_storage === "string" ? dettagli.path_storage : null;
  if (!path) return null;
  return {
    id: "",
    nome_file: "Avviso incasso.pdf",
    bucket_name: DOC_BUCKET_DEFAULT,
    path_storage: path,
  };
}

async function fetchTitoliGiorno(params: FetchComunicazioniIncassoParams): Promise<TitoloIncassoRaw[]> {
  const out: TitoloIncassoRaw[] = [];
  let from = 0;
  while (true) {
    let q = supabase
      .from("titoli")
      .select(
        [
          "id",
          "numero_titolo",
          "data_messa_cassa",
          "compagnia_id",
          "compagnia_rapporto_id",
          "ufficio_id",
          "clienti:clienti!titoli_cliente_anagrafica_id_fkey(ragione_sociale, cognome, nome)",
          "compagnie:compagnie!titoli_compagnia_id_fkey(nome)",
          "compagnia_rapporti:compagnia_rapporti!titoli_compagnia_rapporto_id_fkey(nome_rapporto, sede_denominazione)",
          "uffici(nome_ufficio)",
        ].join(", "),
      )
      .eq("data_messa_cassa", params.giornoIncasso)
      .order("numero_titolo", { ascending: true })
      .range(from, from + TITOLI_PAGE - 1);

    if (params.ufficioId) q = q.eq("ufficio_id", params.ufficioId);
    if (params.agenziaId) q = q.eq("compagnia_id", params.agenziaId);

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data || []) as unknown as TitoloIncassoRaw[];
    out.push(...batch);
    if (batch.length < TITOLI_PAGE) break;
    from += TITOLI_PAGE;
  }
  return out;
}

async function fetchLogsForTitoli(titoloIds: string[]): Promise<LogIncassoRaw[]> {
  const out: LogIncassoRaw[] = [];
  for (let i = 0; i < titoloIds.length; i += IN_CHUNK) {
    const chunk = titoloIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("log_attivita")
      .select("entita_id, azione, created_at, dettagli_json")
      .eq("entita_tipo", "titolo")
      .in("azione", [AZIONE_INCASSO_INVIATA, AZIONE_INCASSO_ERRORE])
      .in("entita_id", chunk);
    if (error) throw error;
    out.push(...((data || []) as unknown as LogIncassoRaw[]));
  }
  return out;
}

async function fetchDocumentiIncasso(opts: {
  titoloIds: string[];
  documentoIds: string[];
}): Promise<DocumentoRaw[]> {
  const seen = new Set<string>();
  const out: DocumentoRaw[] = [];
  const push = (rows: DocumentoRaw[]) => {
    for (const r of rows) {
      if (!r.id || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  };

  const select = "id, nome_file, bucket_name, path_storage, entita_id, created_at";
  for (let i = 0; i < opts.titoloIds.length; i += IN_CHUNK) {
    const chunk = opts.titoloIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("documenti")
      .select(select)
      .eq("entita_tipo", "titolo")
      .eq("categoria", DOC_CATEGORIA_NOTIFICA_INCASSO)
      .in("entita_id", chunk);
    if (error) throw error;
    push((data || []) as unknown as DocumentoRaw[]);
  }
  for (let i = 0; i < opts.documentoIds.length; i += IN_CHUNK) {
    const chunk = opts.documentoIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("documenti")
      .select(select)
      .in("id", chunk);
    if (error) throw error;
    push((data || []) as unknown as DocumentoRaw[]);
  }
  return out;
}

export async function fetchComunicazioniIncasso(
  params: FetchComunicazioniIncassoParams,
): Promise<ComunicazioneIncassoRow[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.giornoIncasso)) return [];

  const titoli = await fetchTitoliGiorno(params);
  if (titoli.length === 0) return [];

  const titoloIds = titoli.map((t) => t.id);
  const logs = await fetchLogsForTitoli(titoloIds);
  const logsByTitolo = new Map<string, LogIncassoRaw[]>();
  for (const log of logs) {
    if (!log.entita_id) continue;
    const list = logsByTitolo.get(log.entita_id);
    if (list) list.push(log);
    else logsByTitolo.set(log.entita_id, [log]);
  }

  const documentoIds: string[] = [];
  for (const log of logs) {
    const ids = log.dettagli_json?.documenti_ids;
    if (Array.isArray(ids)) {
      for (const id of ids) {
        if (typeof id === "string" && id) documentoIds.push(id);
      }
    }
  }

  const docs = await fetchDocumentiIncasso({ titoloIds, documentoIds });
  const docById = new Map(docs.map((d) => [d.id, d]));
  const docByTitolo = new Map<string, DocumentoRaw>();
  for (const d of docs) {
    if (d.entita_id && !docByTitolo.has(d.entita_id)) docByTitolo.set(d.entita_id, d);
  }

  return titoli.map((titolo) => {
    const log = pickLogIncassoPreferito(logsByTitolo.get(titolo.id) || []);
    const dettagli = log?.dettagli_json ?? null;
    const ids = Array.isArray(dettagli?.documenti_ids) ? dettagli.documenti_ids : [];
    const fromIds = ids
      .map((id) => (typeof id === "string" ? docById.get(id) : undefined))
      .find(Boolean);
    const documento =
      docFromRaw(fromIds) ||
      docFromRaw(docByTitolo.get(titolo.id)) ||
      docFromLog(dettagli);
    return mapTitoloToComunicazione(titolo, log, documento);
  });
}
