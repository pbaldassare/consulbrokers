import { isInfordatUrl } from "@/lib/infordatBandi";

export const FONTI_BANDI = [
  { value: "ted", label: "TED Europa" },
  { value: "mondoappalti", label: "Mondo Appalti" },
  { value: "infordat", label: "Infordat" },
] as const;

export const FONTI_RICERCA = [
  ...FONTI_BANDI,
  { value: "tutte", label: "Tutte le fonti" },
] as const;

export const FILTRI_FONTE_LISTA = [
  { value: "tutte", label: "Tutte" },
  ...FONTI_BANDI,
] as const;

export type FonteBando = (typeof FONTI_BANDI)[number]["value"];
export type FonteRicerca = (typeof FONTI_RICERCA)[number]["value"];
export type FiltroFonteLista = (typeof FILTRI_FONTE_LISTA)[number]["value"];

export function isFonteBando(value: string): value is FonteBando {
  return FONTI_BANDI.some((f) => f.value === value);
}

export function isFonteRicerca(value: string): boolean {
  return FONTI_RICERCA.some((f) => f.value === value) || value === "entrambe";
}

export function labelFonteBando(fonte: string | null | undefined): string {
  return FONTI_BANDI.find((f) => f.value === fonte)?.label ?? "TED Europa";
}

export function labelFonteRicerca(fonte: string | null | undefined): string {
  if (fonte === "entrambe") return "Tutte le fonti";
  return FONTI_RICERCA.find((f) => f.value === fonte)?.label ?? "TED Europa";
}

export function progressMsgRicerca(fonte: string | null | undefined): string {
  if (fonte === "mondoappalti") return "Ricerca su Mondo Appalti in corso…";
  if (fonte === "infordat") return "Ricerca su Infordat in corso…";
  if (fonte === "tutte" || fonte === "entrambe") {
    return "Ricerca su TED Europa, Mondo Appalti e Infordat in corso…";
  }
  return "Ricerca su TED Europa in corso…";
}

/** Quali fonti interrogare per una ricerca. Default: tutte. */
export function fontiDaRicerca(fonte: string | null | undefined): FonteBando[] {
  if (fonte === "ted") return ["ted"];
  if (fonte === "mondoappalti") return ["mondoappalti"];
  if (fonte === "infordat") return ["infordat"];
  return ["ted", "mondoappalti", "infordat"];
}

export function inferFonteFromLink(link: string | null | undefined): FonteBando {
  if (link && isInfordatUrl(link)) return "infordat";
  if (link && isMondoAppaltiUrl(link)) return "mondoappalti";
  return "ted";
}

export function resolveFonteBando(
  fonte: string | null | undefined,
  link?: string | null,
): FonteBando {
  if (fonte && isFonteBando(fonte)) return fonte;
  return inferFonteFromLink(link);
}

export function matchesFiltroFonte(
  fonte: string | null | undefined,
  link: string | null | undefined,
  filtro: string,
): boolean {
  if (!filtro || filtro === "tutte") return true;
  return resolveFonteBando(fonte, link) === filtro;
}

export function isEnteBandoGenerico(ente: string | null | undefined): boolean {
  if (!ente) return true;
  return /^(fonte web|scheda mondo appalti|scheda infordat)$/i.test(ente.trim());
}

export type MondoWebHit = { title: string; url: string; snippet: string };

const SKIP_PATH = /\/(login|account|register|privacy|cookie|servizi|cart|checkout|landing)(\/|$)/i;
const MARKETING_PATH = /\/(Main|Landing|Servizi|GareAppalti)(\/|$)/i;

export function isMondoSchedaUrl(url: string): boolean {
  if (!isMondoAppaltiUrl(url)) return false;
  try {
    const path = new URL(url).pathname;
    if (SKIP_PATH.test(path)) return false;
    if (MARKETING_PATH.test(path) && !/scheda/i.test(path)) return false;
    return /\/(bancadati\/)?scheda\//i.test(path) || /\/Scheda\/\d{5,}/.test(path);
  } catch {
    return false;
  }
}

export function isMondoAppaltiUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "mondoappalti.it" || host.endsWith(".mondoappalti.it");
  } catch {
    return false;
  }
}

export function schedaIdFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const digits = u.pathname.match(/(\d{5,})/);
    if (digits) return digits[1];
    return `${u.hostname}${u.pathname}`.replace(/\/+$/, "").slice(0, 180) || url.slice(0, 180);
  } catch {
    return url.slice(0, 180);
  }
}

export function regioneFromText(text: string, regioni: string[]): string | null {
  const hay = text.toLowerCase();
  for (const r of regioni) {
    if (hay.includes(r.toLowerCase())) return r;
  }
  return null;
}

export function filterMondoHits(hits: MondoWebHit[]): MondoWebHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (!h.url || !isMondoSchedaUrl(h.url)) return false;
    const key = schedaIdFromUrl(h.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mapMondoHitToBando(
  hit: MondoWebHit,
  i: number,
  regioniCatalogo: string[],
): {
  id: string;
  titolo: string;
  ente: string;
  ente_tipo: string | null;
  importo: number | null;
  scadenza: string | null;
  stato: string;
  dataPublicazione: string;
  link: string | null;
  categoria: string | null;
  scheda_id: string | null;
  cig: string | null;
  localita: string | null;
  regione: string | null;
  pdf_url: string | null;
  fonte: FonteBando;
} {
  const id = schedaIdFromUrl(hit.url) || `mondo-${i}`;
  const text = `${hit.title} ${hit.snippet}`;
  return {
    id,
    titolo: (hit.title || "Titolo non disponibile").slice(0, 300),
    ente: "Scheda Mondo Appalti",
    ente_tipo: null,
    importo: null,
    scadenza: null,
    stato: "aperto",
    dataPublicazione: "",
    link: hit.url,
    categoria: "Brokeraggio assicurativo",
    scheda_id: id,
    cig: null,
    localita: null,
    regione: regioneFromText(text, regioniCatalogo),
    pdf_url: null,
    fonte: "mondoappalti",
  };
}
