export const TIPI_DOCUMENTO_BANDO = [
  "bando",
  "disciplinare",
  "capitolato",
  "chiarimento",
  "esito",
  "altro",
] as const;
export type TipoDocumentoBando = (typeof TIPI_DOCUMENTO_BANDO)[number];

export const STATI_DOCUMENTO_BANDO = ["nuovo", "invariato", "aggiornato", "rimosso"] as const;
export type StatoDocumentoBando = (typeof STATI_DOCUMENTO_BANDO)[number];

export type BandoDocumentoRow = {
  id: string;
  bando_id: string;
  harvest_run_id?: string | null;
  tipo: string;
  nome: string | null;
  mime: string | null;
  url_origine: string | null;
  storage_path: string | null;
  hash_sha256: string | null;
  stato: string;
  visto_il: string | null;
  scaricato_il: string | null;
};

export type BandoHarvestRunRow = {
  id: string;
  bando_id: string;
  avviato_il: string;
  concluso_il: string | null;
  esito: "ok" | "parziale" | "errore";
  motore: string | null;
  documenti_nuovi: number;
  documenti_aggiornati: number;
  novita_json: Record<string, unknown>;
  errore: string | null;
};

export function inferTipoDocumentoBando(
  nome?: string | null,
  url?: string | null,
): TipoDocumentoBando {
  const blob = `${nome || ""} ${url || ""}`.toLowerCase();
  if (/esito|aggiudic|award|canv/.test(blob)) return "esito";
  if (/disciplinar/.test(blob)) return "disciplinare";
  if (/capitolat/.test(blob)) return "capitolato";
  if (/chiariment|faq|quesit/.test(blob)) return "chiarimento";
  if (/bando|avviso|notice|ted/.test(blob)) return "bando";
  return "altro";
}

export function labelTipoDocumentoBando(tipo: string | null | undefined): string {
  switch (tipo) {
    case "disciplinare":
      return "Disciplinare";
    case "capitolato":
      return "Capitolato";
    case "chiarimento":
      return "Chiarimento";
    case "esito":
      return "Esito";
    case "bando":
      return "Bando";
    default:
      return "Altro";
  }
}

export function labelStatoDocumentoBando(stato: string | null | undefined): string {
  switch (stato) {
    case "nuovo":
      return "Nuovo";
    case "aggiornato":
      return "Aggiornato";
    case "rimosso":
      return "Rimosso";
    default:
      return "Invariato";
  }
}

export function classifyDocumentoHash(
  existingHash: string | null | undefined,
  nextHash: string | null | undefined,
): StatoDocumentoBando {
  if (!existingHash) return "nuovo";
  if (!nextHash) return "invariato";
  return existingHash === nextHash ? "invariato" : "aggiornato";
}

export function countNovitaDocumenti(
  docs: Array<{ stato?: string | null }>,
): { nuovi: number; aggiornati: number } {
  return {
    nuovi: docs.filter((d) => d.stato === "nuovo").length,
    aggiornati: docs.filter((d) => d.stato === "aggiornato").length,
  };
}

export function buildHarvestNote(opts: {
  arricchito?: boolean;
  nuovi?: number;
  aggiornati?: number;
  errore?: string | null;
}): string {
  if (opts.errore) return `Harvest parziale: ${opts.errore}`;
  const parti: string[] = [];
  if (opts.arricchito) parti.push("scheda aggiornata");
  if ((opts.nuovi || 0) > 0) parti.push(`${opts.nuovi} doc nuov${opts.nuovi === 1 ? "o" : "i"}`);
  if ((opts.aggiornati || 0) > 0) {
    parti.push(`${opts.aggiornati} aggiornat${opts.aggiornati === 1 ? "o" : "i"}`);
  }
  if (parti.length === 0) return "Nessuna novità dal portale";
  return `Harvest: ${parti.join(", ")}`;
}

/** Nota per il controllo scheda (senza download PDF). */
export function buildPortaleRefreshNote(opts: {
  arricchito?: boolean;
  nuoviUrl?: number;
  errore?: string | null;
}): string {
  if (opts.errore) return `Controllo portale parziale: ${opts.errore}`;
  const parti: string[] = [];
  if (opts.arricchito) parti.push("scheda bando aggiornata");
  if ((opts.nuoviUrl || 0) > 0) {
    parti.push(
      `${opts.nuoviUrl} nuov${opts.nuoviUrl === 1 ? "o riferimento" : "i riferimenti"} — usa «Scarica dal portale»`,
    );
  }
  if (parti.length === 0) return "Nessun nuovo dato dal portale";
  return `Portale: ${parti.join("; ")}`;
}

export function lastHarvestLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

export type PortaleAzioneHarvest = "scheda" | "documenti";

export function harvestRunAt(run: Pick<BandoHarvestRunRow, "concluso_il" | "avviato_il">): string | null {
  return run.concluso_il || run.avviato_il || null;
}

export function harvestRunAzione(
  run: Pick<BandoHarvestRunRow, "id" | "documenti_nuovi" | "documenti_aggiornati" | "novita_json">,
  documenti: Array<{ harvest_run_id?: string | null }> = [],
): PortaleAzioneHarvest {
  const raw = run.novita_json?.azione;
  if (raw === "scheda" || raw === "documenti") return raw;
  if (documenti.some((d) => d.harvest_run_id === run.id)) return "documenti";
  if ((run.documenti_aggiornati || 0) > 0) return "documenti";
  if ((run.documenti_nuovi || 0) > 0) return "documenti";
  return "scheda";
}

function maxIso(dates: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestMs = -1;
  for (const iso of dates) {
    if (!iso) continue;
    const ms = new Date(iso).getTime();
    if (!Number.isNaN(ms) && ms > bestMs) {
      best = iso;
      bestMs = ms;
    }
  }
  return best;
}

/** Date distinte: controllo scheda vs download documenti. */
export function lastPortaleAttivita(opts: {
  runs?: Array<BandoHarvestRunRow>;
  documenti?: Array<{ harvest_run_id?: string | null; scaricato_il?: string | null }>;
  harvestAt?: string | null;
}): { ultimoAggiornamento: string | null; ultimoScarico: string | null } {
  const runs = opts.runs || [];
  const documenti = opts.documenti || [];
  const ultimoAggiornamento = maxIso([opts.harvestAt, ...runs.map(harvestRunAt)]);
  const ultimoScarico = maxIso([
    ...runs.filter((r) => harvestRunAzione(r, documenti) === "documenti").map(harvestRunAt),
    ...documenti.map((d) => d.scaricato_il),
  ]);
  return { ultimoAggiornamento, ultimoScarico };
}

export function formatPortaleDateTime(iso: string | null | undefined, empty = "Mai"): string {
  if (!iso) return empty;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return empty;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ORDINE_TIPI_DOCUMENTO: TipoDocumentoBando[] = [
  "bando",
  "disciplinare",
  "capitolato",
  "chiarimento",
  "esito",
  "altro",
];

export function documentiVisibili<T extends { stato?: string | null }>(docs: T[]): T[] {
  return docs.filter((d) => d.stato !== "rimosso");
}

export function groupDocumentiByTipo<T extends { tipo?: string | null }>(
  docs: T[],
): Array<{ tipo: string; label: string; docs: T[] }> {
  const buckets = new Map<string, T[]>();
  for (const tipo of ORDINE_TIPI_DOCUMENTO) buckets.set(tipo, []);
  for (const doc of docs) {
    const tipo = ORDINE_TIPI_DOCUMENTO.includes(doc.tipo as TipoDocumentoBando)
      ? String(doc.tipo)
      : "altro";
    buckets.get(tipo)!.push(doc);
  }
  return ORDINE_TIPI_DOCUMENTO
    .map((tipo) => ({
      tipo,
      label: labelTipoDocumentoBando(tipo),
      docs: buckets.get(tipo) || [],
    }))
    .filter((g) => g.docs.length > 0);
}
