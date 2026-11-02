import { resolveFonteBando, type FonteBando } from "@/lib/bandiFonti";
import { toIsoDate } from "@/lib/bandiDettaglio";
import { KEYWORD_BROKERAGGIO, KEYWORD_RICERCA_DEFAULT } from "@/lib/bandiKeywords";

/** Secret condiviso tra pg_cron e l'edge function (come provision-sedi-users). */
export const BANDI_CRON_SECRET = "bandi-cron-mattina-2026";
export const BANDI_CRON_FONTE = "tutte";
export const BANDI_CRON_KEYWORD = KEYWORD_RICERCA_DEFAULT;
export const BANDI_CRON_KEYWORD_LABEL = KEYWORD_BROKERAGGIO;
export const BANDI_CRON_TZ = "Europe/Rome";
export const BANDI_CRON_ORARIO = "07:00";

const CANTIERE_ARCHIVIARE = new Set([
  "da_approfondire",
  "in_monitoraggio",
  "pronto_trattativa",
  "in_trattativa",
]);

export type BandoRicercaUpsert = {
  scheda_id?: string | null;
  titolo?: string | null;
  ente?: string | null;
  ente_tipo?: string | null;
  categoria?: string | null;
  importo?: number | null;
  scadenza?: string | null;
  cig?: string | null;
  link?: string | null;
  localita?: string | null;
  regione?: string | null;
  stato?: string | null;
  pdf_url?: string | null;
  keyword?: string | null;
  fonte?: string | null;
  tipo_avviso?: string | null;
  notice_type?: string | null;
  form_type?: string | null;
  aggiudicato?: boolean | null;
  aggiudicatario?: string | null;
  data_decisione?: string | null;
  data_contratto?: string | null;
  servizio_da?: string | null;
  servizio_a?: string | null;
  tipo_procedura?: string | null;
  dataPublicazione?: string | null;
  data_pubblicazione?: string | null;
};

export type BandoPubblicoUpsertRow = {
  scheda_id: string;
  titolo: string | null;
  oggetto: string | null;
  ente: string | null;
  ente_tipo: string | null;
  tipologia: string | null;
  importo: number | null;
  scadenza: string | null;
  cig: string | null;
  link: string | null;
  localita: string | null;
  regione: string | null;
  stato: string;
  pdf_url: string | null;
  keyword: string;
  fonte: FonteBando;
  tipo_avviso: string;
  notice_type: string | null;
  form_type: string | null;
  aggiudicato: boolean;
  aggiudicatario: string | null;
  data_decisione: string | null;
  data_contratto: string | null;
  servizio_da: string | null;
  servizio_a: string | null;
  tipo_procedura: string | null;
  data_pubblicazione: string | null;
  last_harvest_at: string;
};

/** Data civile in Europe/Rome (YYYY-MM-DD). */
export function oggiEuropeRome(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANDI_CRON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isBandoScaduto(
  scadenza: string | null | undefined,
  today: string = oggiEuropeRome(),
): boolean {
  const iso = toIsoDate(scadenza);
  return !!iso && iso < today;
}

/**
 * Storico Gare solo per partecipati/cantiere già in lavorazione.
 * I bandi pubblici scaduti restano in lista con stato=scaduto.
 */
export function shouldArchiveToStorico(opts: {
  scadenza?: string | null;
  esito?: string | null;
  cantiere?: string | null;
  storicoGaraId?: string | null;
  trattativeCount?: number | null;
  today?: string;
}): boolean {
  if (opts.storicoGaraId || opts.cantiere === "archiviato_storico") return false;
  if (opts.cantiere === "abbandonato") return false;
  if (!isBandoScaduto(opts.scadenza, opts.today)) return false;
  if (opts.esito === "voglio_partecipare" || opts.esito === "in_trattativa") return true;
  if (opts.cantiere && CANTIERE_ARCHIVIARE.has(opts.cantiere)) return true;
  return (opts.trattativeCount || 0) > 0;
}

export function mapBandoToUpsertRow(
  bando: BandoRicercaUpsert,
  keywordFallback: string,
  harvestedAt: string = new Date().toISOString(),
): BandoPubblicoUpsertRow | null {
  const schedaId = String(bando.scheda_id || "").trim();
  if (!schedaId) return null;
  const aggiudicato = !!bando.aggiudicato;
  return {
    scheda_id: schedaId,
    titolo: bando.titolo || null,
    oggetto: bando.titolo || null,
    ente: bando.ente || null,
    ente_tipo: bando.ente_tipo || null,
    tipologia: bando.categoria || null,
    importo: bando.importo ?? null,
    scadenza: toIsoDate(bando.scadenza),
    cig: bando.cig || null,
    link: bando.link || null,
    localita: bando.localita || null,
    regione: bando.regione || null,
    stato: aggiudicato ? "scaduto" : (bando.stato || "aperto"),
    pdf_url: bando.pdf_url || null,
    keyword: bando.keyword || bando.categoria || keywordFallback,
    fonte: resolveFonteBando(bando.fonte, bando.link),
    tipo_avviso: bando.tipo_avviso || (aggiudicato ? "esito" : "gara"),
    notice_type: bando.notice_type || null,
    form_type: bando.form_type || null,
    aggiudicato,
    aggiudicatario: bando.aggiudicatario || null,
    data_decisione: toIsoDate(bando.data_decisione),
    data_contratto: toIsoDate(bando.data_contratto),
    servizio_da: toIsoDate(bando.servizio_da),
    servizio_a: toIsoDate(bando.servizio_a),
    tipo_procedura: bando.tipo_procedura || null,
    data_pubblicazione: toIsoDate(bando.dataPublicazione || bando.data_pubblicazione),
    last_harvest_at: harvestedAt,
  };
}
