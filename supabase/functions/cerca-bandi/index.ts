// Cerca bandi su fonti ufficiali (TED API). Nessuna IA.

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
  ["ITH3", "Trentino-Alto Adige"],
  ["ITH4", "Veneto"],
  ["ITH5", "Friuli Venezia Giulia"],
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
    const hit = NUTS_REGION.find(([prefix]) => code.startsWith(prefix));
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
    const message = error instanceof Error ? error.message : "Errore durante la ricerca";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
