export type TipoTitoloRestituzione = "polizza" | "quietanza" | "regolazione";

export type RestituzioneDocRiga = {
  documentoId: string;
  nomeFile: string;
  createdAt: string | null;
  titoloId: string;
  numeroTitolo: string;
  tipoTitolo: TipoTitoloRestituzione;
  clienteId: string | null;
  clienteNome: string;
  compagniaId: string | null;
  compagniaNome: string;
  inviato: boolean;
};

export type RestituzioneGruppoCompagnia = {
  key: string;
  compagniaId: string | null;
  compagniaNome: string;
  rows: RestituzioneDocRiga[];
};

export function tipoTitoloRestituzione(t: {
  sostituisce_polizza?: unknown;
  is_regolazione?: unknown;
}): TipoTitoloRestituzione {
  if (t.is_regolazione) return "regolazione";
  if (t.sostituisce_polizza) return "quietanza";
  return "polizza";
}

export function labelTipoTitoloRestituzione(tipo: TipoTitoloRestituzione): string {
  if (tipo === "quietanza") return "Quietanza";
  if (tipo === "regolazione") return "Regolazione";
  return "Polizza";
}

export function wrapTestoPdf(text: string, maxChars: number): string[] {
  const raw = (text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  const out: string[] = [];
  for (const paragraph of raw.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (next.length > maxChars && line) {
        out.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export type AgenziaDaCliente = {
  compagniaId: string | null;
  compagniaNome: string;
  titoloId: string | null;
  numeroTitolo: string | null;
  clienteId: string | null;
  clienteNome: string;
};

export const CATEGORIA_DISTINTA_RESTITUZIONE = "distinta_restituzione";

/** Agenzie uniche dalle polizze del cliente (compagnia del titolo). */
export function agenzieDaTitoliClienti(
  titoli: Array<{
    id?: string | null;
    numero_titolo?: string | null;
    compagnia_id?: string | null;
    compagnia_nome?: string | null;
    cliente_anagrafica_id?: string | null;
    cliente_id?: string | null;
    cliente_nome_display?: string | null;
  }>,
): AgenziaDaCliente[] {
  const map = new Map<string, AgenziaDaCliente>();
  for (const t of titoli) {
    const nome = (t.compagnia_nome || "").trim();
    if (!t.compagnia_id && !nome) continue;
    const key = t.compagnia_id || `nome:${nome.toLowerCase()}`;
    if (map.has(key)) continue;
    map.set(key, {
      compagniaId: t.compagnia_id ?? null,
      compagniaNome: nome || "Agenzia non indicata",
      titoloId: t.id ?? null,
      numeroTitolo: t.numero_titolo ?? null,
      clienteId: t.cliente_anagrafica_id || t.cliente_id || null,
      clienteNome: t.cliente_nome_display || "",
    });
  }
  return [...map.values()].sort((a, b) => a.compagniaNome.localeCompare(b.compagniaNome, "it"));
}

/** Con documenti: un gruppo per agenzia. Senza documenti: gruppi dalle agenzie del cliente. */
export function gruppiPerDistinta(
  rows: RestituzioneDocRiga[],
  fallback?: { compagniaId?: string | null; compagniaNome?: string | null } | AgenziaDaCliente[],
): RestituzioneGruppoCompagnia[] {
  if (rows.length > 0) return groupRestituzioneByCompagnia(rows);
  if (Array.isArray(fallback)) {
    return fallback.map((a) => ({
      key: a.compagniaId || `nome:${a.compagniaNome.toLowerCase()}`,
      compagniaId: a.compagniaId,
      compagniaNome: a.compagniaNome,
      rows: [],
    }));
  }
  const nome = (fallback?.compagniaNome || "").trim() || "Restituzione originali";
  return [
    {
      key: "_note",
      compagniaId: fallback?.compagniaId ?? null,
      compagniaNome: nome,
      rows: [],
    },
  ];
}

export function groupRestituzioneByCompagnia(rows: RestituzioneDocRiga[]): RestituzioneGruppoCompagnia[] {
  const map = new Map<string, RestituzioneGruppoCompagnia>();
  for (const r of rows) {
    const nome = (r.compagniaNome || "").trim();
    const key = r.compagniaId || (nome ? `nome:${nome.toLowerCase()}` : "_senza");
    const existing = map.get(key);
    if (existing) {
      existing.rows.push(r);
      continue;
    }
    map.set(key, {
      key,
      compagniaId: r.compagniaId,
      compagniaNome: (r.compagniaNome || "").trim() || "Agenzia non indicata",
      rows: [r],
    });
  }
  return [...map.values()].sort((a, b) => a.compagniaNome.localeCompare(b.compagniaNome, "it"));
}

export function slugAgenziaFilename(nome: string): string {
  const slug = (nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return slug || "agenzia";
}

export function filenameDistintaRestituzione(compagniaNome: string, at: Date): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `distinta_originali_${slugAgenziaFilename(compagniaNome)}_${y}${m}${d}.pdf`;
}

export function chunkIds(ids: string[], size = 200): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export function clientiOrFilter(clienteIds: string[]): string {
  const list = clienteIds.filter(Boolean).join(",");
  return `cliente_id.in.(${list}),cliente_anagrafica_id.in.(${list})`;
}

export function formatCapCitta(
  cap?: string | null,
  citta?: string | null,
  provincia?: string | null,
): string {
  const city = [citta, provincia ? `(${provincia})` : ""].filter(Boolean).join(" ").trim();
  return [cap, city].filter(Boolean).join(" ");
}

export function protocolloDistinta(compagniaNome: string, at: Date): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `RO/${y}/${m}${d}-${slugAgenziaFilename(compagniaNome).slice(0, 16)}`;
}

export type DistintaMittente = {
  ragioneSociale: string;
  sedeNome?: string;
  indirizzo?: string;
  capCitta?: string;
  telefono?: string;
  email?: string;
};

export type DistintaDestinatario = {
  nome: string;
  indirizzo?: string;
  capCitta?: string;
};

export type DistintaPreviewRiga = {
  n: number;
  cliente: string;
  numeroTitolo: string;
  tipo: string;
  documento: string;
  data: string;
};

export type DistintaRestituzioneModel = {
  titolo: string;
  protocollo: string;
  dataLabel: string;
  generatoDa?: string;
  mittente: DistintaMittente;
  destinatario: DistintaDestinatario;
  clientiLabel: string;
  oggetto: string;
  intro: string;
  rows: DistintaPreviewRiga[];
  note: string;
  chiusura: string;
};

export const DEFAULT_MITTENTE_RESTITUZIONE: DistintaMittente = {
  ragioneSociale: "Consulbrokers S.p.A.",
};

function fmtDataDoc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function buildDistintaRestituzioneModel(
  gruppo: RestituzioneGruppoCompagnia,
  generatedAt: Date,
  options?: {
    note?: string;
    clientiLabel?: string;
    generatoDa?: string;
    mittente?: DistintaMittente;
    destinatario?: DistintaDestinatario;
    dataLabel?: string;
  },
): DistintaRestituzioneModel {
  const clientiLabel = (options?.clientiLabel || "").trim();
  const note = (options?.note || "").trim();
  const destinatario: DistintaDestinatario = options?.destinatario ?? {
    nome: gruppo.compagniaNome,
  };
  const rows = gruppo.rows.map((r, i) => ({
    n: i + 1,
    cliente: r.clienteNome || "—",
    numeroTitolo: r.numeroTitolo || "—",
    tipo: labelTipoTitoloRestituzione(r.tipoTitolo),
    documento: r.nomeFile || "—",
    data: fmtDataDoc(r.createdAt),
  }));
  const oggettoClienti = clientiLabel || destinatario.nome;
  return {
    titolo: "Distinta di restituzione originali",
    protocollo: protocolloDistinta(destinatario.nome, generatedAt),
    dataLabel: options?.dataLabel || fmtDataDoc(generatedAt.toISOString()),
    generatoDa: options?.generatoDa,
    mittente: { ...DEFAULT_MITTENTE_RESTITUZIONE, ...options?.mittente },
    destinatario,
    clientiLabel,
    oggetto: `Restituzione documenti originali — ${oggettoClienti}`,
    intro:
      rows.length > 0
        ? "Con la presente si restituiscono in originale i documenti elencati, relativi alle polizze dei clienti indicati. Si prega di prendere in carico e archiviare presso l'agenzia / compagnia destinataria."
        : "Con la presente si comunica la restituzione degli originali come da note. Non risultano documenti selezionati in elenco.",
    rows,
    note,
    chiusura: "Cordiali saluti.",
  };
}
