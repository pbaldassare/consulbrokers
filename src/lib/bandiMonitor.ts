export const MONITOR_INTERVAL_HOURS = 24;
export const HARVEST_URL_LIMIT = 8;

export const CANTIERI_MONITORABILI = [
  "da_approfondire",
  "in_monitoraggio",
  "pronto_trattativa",
] as const;

export type BandoMonitorDocumento = {
  url: string;
  tipo: string;
  nome: string;
};

export type BandiMonitorScriptJson = {
  versione: 1;
  start_url: string;
  motore: string;
  extra_urls: string[];
  link_patterns: string[];
  note: string;
  documenti: BandoMonitorDocumento[];
};

export type BandoMonitorScriptRow = {
  id: string;
  bando_id: string;
  versione: number;
  motore: string | null;
  source_url: string | null;
  script_json: BandiMonitorScriptJson | Record<string, unknown>;
  generated_at: string;
  last_used_at?: string | null;
  last_ok_at?: string | null;
  errore?: string | null;
};

const DOC_EXT = /\.(pdf|zip|docx?|xlsx?)(?:[?#]|$)/i;
const DOC_HINT = /\/(download|document|allegat|atti|bando|disciplinar|capitolat|chiariment|avviso)/i;

export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function uniqueHttpUrls(urls: Array<string | null | undefined>, limit = HARVEST_URL_LIMIT): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    if (!isHttpUrl(raw)) continue;
    const key = raw.split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= limit) break;
  }
  return out;
}

export function resolveHref(href: string, baseUrl: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("mailto:")) return null;
  try {
    const u = new URL(trimmed, baseUrl || undefined);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function looksLikeDocumentUrl(url: string, label = ""): boolean {
  const blob = `${url} ${label}`.toLowerCase();
  return DOC_EXT.test(url) || DOC_HINT.test(blob);
}

export type DiscoveredDocLink = { url: string; nome: string };

export function extractDocumentLinks(html: string, baseUrl: string): DiscoveredDocLink[] {
  if (!html) return [];
  const found: DiscoveredDocLink[] = [];
  const seen = new Set<string>();
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const attrs = match[1] || "";
    const hrefMatch = attrs.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const url = resolveHref(hrefMatch[1], baseUrl);
    if (!url) continue;
    const nome = String(match[2] || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    if (!looksLikeDocumentUrl(url, nome)) continue;
    const key = url.split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ url: key, nome: nome || key.split("/").pop() || "documento" });
  }
  return found.slice(0, 40);
}

export function applyLinkPatterns(urls: string[], patterns: string[]): string[] {
  if (!patterns.length) return urls;
  return urls.filter((url) =>
    patterns.some((p) => {
      try {
        return new RegExp(p, "i").test(url);
      } catch {
        return false;
      }
    }),
  );
}

export function emptyMonitorScript(opts: {
  startUrl?: string | null;
  motore?: string | null;
}): BandiMonitorScriptJson {
  return {
    versione: 1,
    start_url: opts.startUrl || "",
    motore: opts.motore || "",
    extra_urls: [],
    link_patterns: [],
    note: "",
    documenti: [],
  };
}

export function normalizeMonitorScript(raw: unknown): BandiMonitorScriptJson {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const extra = Array.isArray(obj.extra_urls) ? obj.extra_urls : [];
  const patterns = Array.isArray(obj.link_patterns) ? obj.link_patterns : [];
  const docs = Array.isArray(obj.documenti) ? obj.documenti : [];
  return {
    versione: 1,
    start_url: typeof obj.start_url === "string" ? obj.start_url : "",
    motore: typeof obj.motore === "string" ? obj.motore : "",
    extra_urls: extra.filter((u): u is string => typeof u === "string" && isHttpUrl(u)),
    link_patterns: patterns.filter((p): p is string => typeof p === "string" && p.trim().length > 0),
    note: typeof obj.note === "string" ? obj.note : "",
    documenti: docs
      .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
      .map((d) => ({
        url: typeof d.url === "string" ? d.url : "",
        tipo: typeof d.tipo === "string" ? d.tipo : "altro",
        nome: typeof d.nome === "string" ? d.nome : "",
      }))
      .filter((d) => isHttpUrl(d.url)),
  };
}

export function collectHarvestUrls(opts: {
  pdfUrl?: string | null;
  extraUrls?: string[];
  discovered?: string[];
  patterns?: string[];
  limit?: number;
}): string[] {
  const discovered = applyLinkPatterns(opts.discovered || [], opts.patterns || []);
  return uniqueHttpUrls(
    [opts.pdfUrl, ...(opts.extraUrls || []), ...discovered],
    opts.limit ?? HARVEST_URL_LIMIT,
  );
}

export function isMonitorDue(
  lastAt: string | null | undefined,
  now = Date.now(),
  hours = MONITOR_INTERVAL_HOURS,
): boolean {
  if (!lastAt) return true;
  const t = new Date(lastAt).getTime();
  if (Number.isNaN(t)) return true;
  return now - t >= hours * 3600_000;
}

export function isBandoMonitorabile(cantiere: string | null | undefined): boolean {
  return !!cantiere && (CANTIERI_MONITORABILI as readonly string[]).includes(cantiere);
}

export function countScriptLinks(script: BandiMonitorScriptJson | null | undefined): number {
  if (!script) return 0;
  return uniqueHttpUrls([...script.extra_urls, ...script.documenti.map((d) => d.url)], 40).length;
}

export function labelMonitorScript(script: BandoMonitorScriptRow | null | undefined): string {
  if (!script) return "Nessuno script";
  const json = normalizeMonitorScript(script.script_json);
  const n = countScriptLinks(json);
  return `Script v${script.versione}${n ? ` · ${n} link` : ""}`;
}
