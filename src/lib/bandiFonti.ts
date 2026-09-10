export const FONTI_BANDI = [
  { value: "ted", label: "TED Europa" },
  { value: "mondoappalti", label: "Mondo Appalti" },
] as const;

export type FonteBando = (typeof FONTI_BANDI)[number]["value"];

export function isFonteBando(value: string): value is FonteBando {
  return FONTI_BANDI.some((f) => f.value === value);
}

export function labelFonteBando(fonte: string | null | undefined): string {
  return FONTI_BANDI.find((f) => f.value === fonte)?.label ?? "TED Europa";
}

export type MondoWebHit = { title: string; url: string; snippet: string };

const SKIP_PATH = /\/(login|account|register|privacy|cookie|servizi|cart|checkout)(\/|$)/i;

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
    if (!h.url || !isMondoAppaltiUrl(h.url)) return false;
    try {
      if (SKIP_PATH.test(new URL(h.url).pathname)) return false;
    } catch {
      return false;
    }
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
  };
}
