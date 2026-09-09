// Cerca / analizza bandi con Moonshot (Kimi) + ricerca web.
// Non usa Browser Use (crediti esauriti).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MOONSHOT_BASE = "https://api.moonshot.ai/v1";
const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";

function moonshotKey(): string | undefined {
  return Deno.env.get("MOONSHOT_API_KEY") || Deno.env.get("MOONSHINE_API_KEY") || undefined;
}

function requireAi() {
  if (!moonshotKey() && !Deno.env.get("LOVABLE_API_KEY")) {
    throw new Error("API IA non configurata: imposta MOONSHOT_API_KEY (Kimi) nei secret Supabase.");
  }
}

async function aiChatCompletions(body: Record<string, unknown>): Promise<Response> {
  const moon = moonshotKey();
  const baseUrl = moon
    ? (Deno.env.get("MOONSHOT_BASE_URL") || MOONSHOT_BASE).replace(/\/$/, "")
    : LOVABLE_BASE;
  const apiKey = moon || Deno.env.get("LOVABLE_API_KEY")!;
  const model = moon
    ? (Deno.env.get("MOONSHOT_MODEL") || "kimi-k2.6")
    : "google/gemini-2.5-flash";
  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, model }),
  });
}

const REGION_MAP: Record<string, string> = {
  "Emilia-Romagna": "Emilia Romagna",
  "Friuli Venezia Giulia": "Friuli Venezia Giulia",
  "Trentino-Alto Adige": "Trentino Alto Adige",
  "Valle d'Aosta": "Valle d'Aosta",
};

function normalizeRegione(uiName: string): string {
  return REGION_MAP[uiName] || uiName;
}

function parseImportoItaliano(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const s = String(val).replace(/[€\s]/g, "").trim();
  if (!s || s === "N/A" || s === "-") return null;
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseOutput(output: string | null): unknown[] {
  if (!output) return [];
  let cleaned = output.trim();
  const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) cleaned = mdMatch[1].trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.bandi && Array.isArray(parsed.bandi)) return parsed.bandi;
    if (parsed?.results && Array.isArray(parsed.results)) return parsed.results;
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

function mapBando(b: Record<string, unknown>, i: number) {
  return {
    id: String(b.scheda_id || b.id || `bando-${Date.now()}-${i}`),
    titolo: String(b.oggetto || b.titolo || b.tipologia || "Titolo non disponibile"),
    ente: String(b.stazione_appaltante || b.ente || "Ente non specificato"),
    ente_tipo: (b.ente_tipo as string) || null,
    importo: parseImportoItaliano(b.importo),
    scadenza: (b.scadenza as string) || null,
    stato: (b.stato as string) || "aperto",
    dataPublicazione: String(b.dataPublicazione || b.dataPubblicazione || ""),
    link: (b.link as string) || null,
    categoria: (b.tipologia as string) || (b.categoria as string) || null,
    scheda_id: (b.scheda_id as string) || null,
    cig: (b.cig as string) || null,
    localita: (b.localita as string) || null,
    regione: (b.regione as string) || null,
    pdf_url: (b.pdf_url as string) || null,
  };
}

function schedaIdFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).replace(/\/+$/, "").slice(0, 180) || url.slice(0, 180);
  } catch {
    return url.slice(0, 180);
  }
}

type WebHit = { title: string; url: string; snippet: string };

async function searchTavily(query: string): Promise<WebHit[]> {
  const key = Deno.env.get("TAVILY_API_KEY");
  if (!key) return [];
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "advanced",
      max_results: 12,
      include_answer: false,
      include_domains: ["mondoappalti.it", "ted.europa.eu", "serviziocontrattipubblici.it"],
    }),
  });
  if (!resp.ok) {
    console.warn("Tavily", resp.status, await resp.text());
    return [];
  }
  const json = await resp.json();
  return (json?.results ?? []).map((r: { title?: string; url?: string; content?: string }) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.content ?? "",
  }));
}

async function searchSerper(query: string): Promise<WebHit[]> {
  const key = Deno.env.get("SERPER_API_KEY");
  if (!key) return [];
  const q = `${query} (site:mondoappalti.it OR site:ted.europa.eu)`;
  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q, gl: "it", hl: "it", num: 12 }),
  });
  if (!resp.ok) {
    console.warn("Serper", resp.status, await resp.text());
    return [];
  }
  const json = await resp.json();
  return (json?.organic ?? []).map((r: { title?: string; link?: string; snippet?: string }) => ({
    title: r.title ?? "",
    url: r.link ?? "",
    snippet: r.snippet ?? "",
  }));
}

async function webSearch(query: string): Promise<WebHit[]> {
  let hits = await searchTavily(query);
  if (hits.length === 0) hits = await searchSerper(query);
  return hits.filter((h) => !!h.url);
}

async function analizzaConKimi(
  hits: WebHit[],
  filtri: { regioni: string[]; importoMin?: string; importoMax?: string; dataDa?: string; dataA?: string },
): Promise<ReturnType<typeof mapBando>[]> {
  const system =
    "Sei un analista di gare d'appalto italiane per un broker assicurativo. " +
    "Estrai SOLO bandi/gare reali dai risultati web forniti. Non inventare schede, CIG, importi o enti. " +
    "Rispondi SOLO con un JSON array. Ogni oggetto ha: scheda_id, tipologia, oggetto, stazione_appaltante, ente_tipo, localita, regione, importo (numero o null), scadenza (dd/MM/yyyy o null), cig, link, pdf_url. " +
    "Se un campo non è nel testo, usa null. Se i risultati non sono bandi, restituisci [].";

  const user =
    `Filtri richiesti: keyword "brokeraggio assicurativo"` +
    (filtri.regioni.length ? `; regioni: ${filtri.regioni.join(", ")}` : "") +
    (filtri.importoMin ? `; importo min €${filtri.importoMin}` : "") +
    (filtri.importoMax ? `; importo max €${filtri.importoMax}` : "") +
    (filtri.dataDa ? `; dal ${filtri.dataDa}` : "") +
    (filtri.dataA ? `; fino al ${filtri.dataA}` : "") +
    `.\n\nRISULTATI WEB:\n${JSON.stringify(hits, null, 2)}`;

  const resp = await aiChatCompletions({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.1,
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  const raw = parseOutput(text);
  const mapped = raw.map((b, i) => mapBando((b || {}) as Record<string, unknown>, i));

  return mapped.map((b, i) => {
    const hit = hits.find((h) => h.url === b.link) || hits[i];
    if (!b.link && hit?.url) b.link = hit.url;
    if (!b.scheda_id && b.link) b.scheda_id = schedaIdFromUrl(b.link);
    if (!b.titolo && hit?.title) b.titolo = hit.title;
    return b;
  }).filter((b) => b.link || b.titolo);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    requireAi();
    const body = await req.json();
    const action = body.action || "start";

    if (action === "status") {
      return new Response(
        JSON.stringify({ done: true, sessions: [], bandi: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const regioni = ((body.regioni as string[]) || []).map(normalizeRegione);
    const dove = regioni.length > 0 ? regioni.join(" ") : "Italia";
    const query = [
      "bandi gare appalto brokeraggio assicurativo",
      dove,
      body.dataDa ? `dal ${body.dataDa}` : "",
      body.dataA ? `fino ${body.dataA}` : "",
    ].filter(Boolean).join(" ");

    console.log("cerca-bandi kimi", query);

    const hits = await webSearch(query);
    if (hits.length === 0) {
      return new Response(
        JSON.stringify({
          status: "completed",
          engine: "kimi",
          done: true,
          sessionIds: [],
          totalBatches: 0,
          bandi: [],
          message: "Nessun risultato web sui portali gare.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const bandi = await analizzaConKimi(hits, {
      regioni,
      importoMin: body.importoMin,
      importoMax: body.importoMax,
      dataDa: body.dataDa,
      dataA: body.dataA,
    });

    const seen = new Set<string>();
    const dedup = bandi.filter((b) => {
      const key = b.scheda_id || b.link || b.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return new Response(
      JSON.stringify({
        status: "completed",
        engine: "kimi",
        done: true,
        sessionIds: [],
        totalBatches: 0,
        bandi: dedup,
        message: `Analizzati ${dedup.length} bando/i con Kimi`,
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
