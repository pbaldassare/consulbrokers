// Cerca bandi: TED API (ufficiale) o Mondo Appalti (ricerca sul sito).
// I nomi dei motori IA non vanno esposti al client.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TED_SEARCH = "https://api.ted.europa.eu/v3/notices/search";
const CPV_BROKER = "66518100";
const BROKER_RE = /brokeraggio|broker assicur|intermediazione assicur/i;

const NUTS_REGION: [string, string][] = [
  ["ITC1", "Piemonte"],
  ["ITC2", "Valle d'Aosta"],
  ["ITC3", "Liguria"],
  ["ITC4", "Lombardia"],
  ["ITH1", "Trentino-Alto Adige"],
  ["ITH2", "Trentino-Alto Adige"],
  ["ITH3", "Veneto"],
  ["ITH4", "Friuli Venezia Giulia"],
  ["ITH5", "Emilia-Romagna"],
  ["ITI1", "Toscana"],
  ["ITI2", "Umbria"],
  ["ITI3", "Marche"],
  ["ITI4", "Lazio"],
  ["ITF1", "Abruzzo"],
  ["ITF2", "Molise"],
  ["ITF3", "Campania"],
  ["ITF4", "Puglia"],
  ["ITF5", "Basilicata"],
  ["ITF6", "Calabria"],
  ["ITG1", "Sicilia"],
  ["ITG2", "Sardegna"],
];

type Filtri = {
  regioni: string[];
  importoMin?: string;
  importoMax?: string;
  dataDa?: string;
  dataA?: string;
  statoBando?: string;
};

type Bando = {
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
};

function pickLang(value: unknown, langs = ["ita", "eng"]): string | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === "string" && v.trim());
    return first ? String(first).trim() : null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const lang of langs) {
      const hit = pickLang(obj[lang], langs);
      if (hit) return hit;
    }
    for (const v of Object.values(obj)) {
      const hit = pickLang(v, langs);
      if (hit) return hit;
    }
  }
  return null;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const v of value) {
      const s = firstString(v);
      if (s) return s;
    }
  }
  return null;
}

function toIsoDate(raw: string | null): string {
  if (!raw) return "";
  return raw.slice(0, 10);
}

function toItDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function parseNumber(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const n = parseFloat(String(val).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function uniqueCpvs(cpv: unknown): string[] {
  const raw = Array.isArray(cpv) ? cpv : [];
  return [...new Set(raw.map((c) => String(c)))];
}

function regioneFromNuts(nuts: unknown): { regione: string | null; localita: string | null } {
  const codes = (Array.isArray(nuts) ? nuts : []).map(String).filter((c) => c && c !== "ITA" && c !== "00");
  for (const code of codes) {
    const hit = NUTS_REGION
      .filter(([prefix]) => code.startsWith(prefix))
      .sort((a, b) => b[0].length - a[0].length)[0];
    if (hit) return { regione: hit[1], localita: code };
  }
  return { regione: null, localita: codes[0] || null };
}

function cleanTitle(title: string): string {
  return title
    .replace(/^Italia\s+[–-]\s+[^–-]+[–-]\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isBrokeraggio(title: string, cpvs: string[]): boolean {
  if (BROKER_RE.test(title)) return true;
  return cpvs.includes(CPV_BROKER) && cpvs.length <= 6;
}

function tedDate(iso?: string): string {
  if (!iso) return "20250101";
  return iso.replace(/-/g, "").slice(0, 8);
}

async function tedSearch(query: string): Promise<Record<string, unknown>[]> {
  const resp = await fetch(TED_SEARCH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query,
      fields: [
        "publication-number",
        "notice-title",
        "buyer-name",
        "total-value",
        "publication-date",
        "classification-cpv",
        "place-of-performance",
        "deadline-date-lot",
        "deadline",
        "links",
      ],
      limit: 50,
      scope: "ALL",
      paginationMode: "PAGE_NUMBER",
      page: 1,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`TED ${resp.status}: ${t.slice(0, 180)}`);
  }
  const json = await resp.json();
  return Array.isArray(json?.notices) ? json.notices : [];
}

function mapNotice(n: Record<string, unknown>): Bando | null {
  const pub = String(n["publication-number"] || "").trim();
  if (!pub) return null;
  const titleRaw = pickLang(n["notice-title"]) || "Titolo non disponibile";
  const titolo = cleanTitle(titleRaw);
  const cpvs = uniqueCpvs(n["classification-cpv"]);
  if (!isBrokeraggio(`${titolo} ${titleRaw}`, cpvs)) return null;

  const ente = pickLang(n["buyer-name"]) || "Ente non specificato";
  const pubIso = toIsoDate(firstString(n["publication-date"]));
  const deadlineIso = toIsoDate(firstString(n["deadline-date-lot"]) || firstString(n["deadline"]));
  const { regione, localita } = regioneFromNuts(n["place-of-performance"]);
  const links = (n.links || {}) as Record<string, Record<string, string>>;
  const html = links.html?.ITA || links.html?.ENG || `https://ted.europa.eu/it/notice/-/detail/${pub}`;
  const pdf = links.pdf?.ITA || links.pdf?.ENG || null;
  const oggi = new Date().toISOString().slice(0, 10);
  const stato = deadlineIso && deadlineIso < oggi ? "scaduto" : "aperto";

  return {
    id: pub,
    titolo,
    ente,
    ente_tipo: null,
    importo: parseNumber(n["total-value"]),
    scadenza: toItDate(deadlineIso),
    stato,
    dataPublicazione: pubIso,
    link: html,
    categoria: cpvs.includes(CPV_BROKER) ? "Brokeraggio assicurativo" : "Servizi assicurativi",
    scheda_id: pub,
    cig: null,
    localita,
    regione,
    pdf_url: pdf,
  };
}

type WebHit = { title: string; url: string; snippet: string };

function isMondoUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "mondoappalti.it" || host.endsWith(".mondoappalti.it");
  } catch {
    return false;
  }
}

function schedaIdFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const digits = u.pathname.match(/(\d{5,})/);
    if (digits) return digits[1];
    return `${u.hostname}${u.pathname}`.replace(/\/+$/, "").slice(0, 180);
  } catch {
    return url.slice(0, 180);
  }
}

function filterMondoHits(hits: WebHit[]): WebHit[] {
  const skip = /\/(login|account|register|privacy|cookie|servizi|cart|checkout)(\/|$)/i;
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (!h.url || !isMondoUrl(h.url)) return false;
    try {
      if (skip.test(new URL(h.url).pathname)) return false;
    } catch {
      return false;
    }
    const key = schedaIdFromUrl(h.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function regioneFromText(text: string, regioni: string[]): string | null {
  const hay = text.toLowerCase();
  for (const r of regioni) {
    if (hay.includes(r.toLowerCase())) return r;
  }
  return null;
}

function hitToBando(hit: WebHit, i: number, regioni: string[]): Bando {
  const id = schedaIdFromUrl(hit.url) || `mondo-${i}`;
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
    regione: regioneFromText(`${hit.title} ${hit.snippet}`, regioni),
    pdf_url: null,
  };
}

async function searchTavilyMondo(query: string): Promise<WebHit[]> {
  const key = Deno.env.get("TAVILY_API_KEY");
  if (!key) return [];
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "advanced",
      max_results: 20,
      include_answer: false,
      include_domains: ["mondoappalti.it"],
    }),
  });
  if (!resp.ok) {
    console.warn("tavily mondo", resp.status, await resp.text());
    return [];
  }
  const json = await resp.json();
  return (json?.results ?? []).map((r: { title?: string; url?: string; content?: string }) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.content ?? "",
  }));
}

async function searchSerperMondo(query: string): Promise<WebHit[]> {
  const key = Deno.env.get("SERPER_API_KEY");
  if (!key) return [];
  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      q: `${query} site:mondoappalti.it`,
      gl: "it",
      hl: "it",
      num: 20,
    }),
  });
  if (!resp.ok) {
    console.warn("serper mondo", resp.status, await resp.text());
    return [];
  }
  const json = await resp.json();
  return (json?.organic ?? []).map((r: { title?: string; link?: string; snippet?: string }) => ({
    title: r.title ?? "",
    url: r.link ?? "",
    snippet: r.snippet ?? "",
  }));
}

function parseBandiJson(output: string | null): Record<string, unknown>[] {
  if (!output) return [];
  let cleaned = output.trim();
  const md = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (md) cleaned = md[1].trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.bandi)) return parsed.bandi;
    return [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      return JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
}

async function extractMondoBandi(hits: WebHit[], filtri: Filtri): Promise<Bando[] | null> {
  const { hasAiCredentials, aiChatCompletions } = await import("../_shared/aiProvider.ts");
  if (!hasAiCredentials()) return null;
  const system =
    "Sei un analista di gare d'appalto italiane per un broker. " +
    "Estrai SOLO bandi reali da Mondo Appalti. Non inventare CIG, importi, enti. " +
    "Rispondi SOLO con un JSON array: scheda_id, oggetto, stazione_appaltante, localita, regione, importo, scadenza (dd/MM/yyyy), cig, link, pdf_url.";
  const user =
    `Keyword: brokeraggio assicurativo` +
    (filtri.regioni.length ? `; regioni: ${filtri.regioni.join(", ")}` : "") +
    `.\n\nRISULTATI:\n${JSON.stringify(hits.slice(0, 20), null, 2)}`;
  const resp = await aiChatCompletions({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  const raw = parseBandiJson(json?.choices?.[0]?.message?.content ?? "");
  if (raw.length === 0) return null;
  return raw.map((b, i) => {
    const link = String(b.link || hits[i]?.url || "");
    const id = String(b.scheda_id || schedaIdFromUrl(link) || `mondo-${i}`);
    return {
      id,
      titolo: String(b.oggetto || b.titolo || hits[i]?.title || "Titolo non disponibile").slice(0, 300),
      ente: String(b.stazione_appaltante || b.ente || "Scheda Mondo Appalti"),
      ente_tipo: null,
      importo: parseNumber(b.importo),
      scadenza: typeof b.scadenza === "string" ? b.scadenza : null,
      stato: "aperto",
      dataPublicazione: "",
      link: link || null,
      categoria: "Brokeraggio assicurativo",
      scheda_id: id,
      cig: typeof b.cig === "string" ? b.cig : null,
      localita: typeof b.localita === "string" ? b.localita : null,
      regione: typeof b.regione === "string" ? b.regione : regioneFromText(`${b.oggetto ?? ""} ${b.stazione_appaltante ?? ""}`, filtri.regioni.length ? filtri.regioni : []),
      pdf_url: typeof b.pdf_url === "string" ? b.pdf_url : null,
    } satisfies Bando;
  });
}

async function searchMondoAppalti(filtri: Filtri): Promise<Bando[]> {
  if (!Deno.env.get("TAVILY_API_KEY") && !Deno.env.get("SERPER_API_KEY")) {
    console.error("mondoappalti: manca TAVILY_API_KEY / SERPER_API_KEY");
    throw new Error("Ricerca su Mondo Appalti non disponibile. Riprova più tardi.");
  }
  const q = [
    "brokeraggio assicurativo bando gara",
    filtri.regioni.length ? filtri.regioni.join(" ") : "Italia",
  ].join(" ");
  let hits = filterMondoHits(await searchTavilyMondo(q));
  if (hits.length === 0) hits = filterMondoHits(await searchSerperMondo(q));
  if (hits.length === 0) return [];

  const extracted = await extractMondoBandi(hits, filtri).catch((e) => {
    console.warn("mondo extract", e);
    return null;
  });
  const mapped = extracted && extracted.length > 0
    ? extracted
    : hits.map((h, i) => hitToBando(h, i, filtri.regioni));
  return applyFiltri(mapped, filtri).slice(0, 30);
}

function applyFiltri(bandi: Bando[], filtri: Filtri): Bando[] {
  const min = filtri.importoMin ? parseFloat(filtri.importoMin) : null;
  const max = filtri.importoMax ? parseFloat(filtri.importoMax) : null;
  const stato = filtri.statoBando && filtri.statoBando !== "tutti" ? filtri.statoBando : "";
  return bandi.filter((b) => {
    if (stato && b.stato !== stato) return false;
    if (min != null && Number.isFinite(min) && (b.importo == null || b.importo < min)) return false;
    if (max != null && Number.isFinite(max) && (b.importo == null || b.importo > max)) return false;
    if (filtri.regioni.length) {
      if (b.regione && !filtri.regioni.includes(b.regione)) return false;
    }
    if (filtri.dataDa && b.dataPublicazione && b.dataPublicazione < filtri.dataDa) return false;
    if (filtri.dataA && b.dataPublicazione && b.dataPublicazione > filtri.dataA) return false;
    return true;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    if ((body.action || "start") === "status") {
      return new Response(JSON.stringify({ done: true, sessions: [], bandi: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filtri: Filtri = {
      regioni: Array.isArray(body.regioni) ? body.regioni : [],
      importoMin: body.importoMin,
      importoMax: body.importoMax,
      dataDa: body.dataDa,
      dataA: body.dataA,
      statoBando: body.statoBando,
    };
    const fonte = body.fonte === "mondoappalti" ? "mondoappalti" : "ted";

    if (fonte === "mondoappalti") {
      console.log("cerca-bandi mondoappalti", filtri);
      const bandi = await searchMondoAppalti(filtri);
      return new Response(
        JSON.stringify({
          status: "completed",
          engine: "mondoappalti",
          via: "mondoappalti",
          done: true,
          sessionIds: [],
          totalBatches: 0,
          bandi,
          message: `Trovati ${bandi.length} bando/i su Mondo Appalti`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const da = tedDate(filtri.dataDa || "2025-01-01");
    const aClause = filtri.dataA ? ` AND publication-date<=${tedDate(filtri.dataA)}` : "";
    const queries = [
      `(FT~"brokeraggio assicurativo" OR FT~"broker assicurativo" OR FT~"intermediazione assicurativa") AND buyer-country=ITA AND publication-date>=${da}${aClause} SORT BY publication-date DESC`,
      `classification-cpv=${CPV_BROKER} AND buyer-country=ITA AND publication-date>=${da}${aClause} SORT BY publication-date DESC`,
    ];

    console.log("cerca-bandi ted", filtri);

    const batches = await Promise.all(queries.map((q) => tedSearch(q)));
    const seen = new Set<string>();
    const mapped: Bando[] = [];
    for (const batch of batches) {
      for (const notice of batch) {
        const bando = mapNotice(notice);
        if (!bando || seen.has(bando.id)) continue;
        seen.add(bando.id);
        mapped.push(bando);
      }
    }

    const bandi = applyFiltri(mapped, filtri).slice(0, 30);
    console.log("cerca-bandi ted done", { raw: mapped.length, count: bandi.length });

    return new Response(
      JSON.stringify({
        status: "completed",
        engine: "ted",
        via: "ted-api",
        done: true,
        sessionIds: [],
        totalBatches: 0,
        bandi,
        message: `Trovati ${bandi.length} bando/i su TED`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("cerca-bandi", error);
    const raw = error instanceof Error ? error.message : "Errore durante la ricerca";
    const message = /kimi|gemini|moonshot|moonshine|lovable|openai|tavily|serper/i.test(raw)
      ? "Ricerca non disponibile. Riprova tra poco."
      : raw;
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
