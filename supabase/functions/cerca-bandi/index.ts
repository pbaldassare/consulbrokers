// Cerca / analizza bandi con Moonshot (Kimi): web-search + fetch schede.
// Browser Use non è più usato.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MOONSHOT_BASE = "https://api.moonshot.ai/v1";
const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";
const SEARCH_FORMULA = "moonshot/web-search:latest";
const FETCH_FORMULA = "moonshot/fetch:latest";
const MAX_TOOL_ROUNDS = 8;
const TOOLS_BUDGET_MS = 50_000;

function moonshotKey(): string | undefined {
  return Deno.env.get("MOONSHOT_API_KEY") || Deno.env.get("MOONSHINE_API_KEY") || undefined;
}

function moonshotBase(): string {
  return (Deno.env.get("MOONSHOT_BASE_URL") || MOONSHOT_BASE).replace(/\/$/, "");
}

function requireAi() {
  if (!moonshotKey() && !Deno.env.get("LOVABLE_API_KEY")) {
    throw new Error("API IA non configurata: imposta MOONSHOT_API_KEY (Kimi) nei secret Supabase.");
  }
}

async function aiChatCompletions(body: Record<string, unknown>): Promise<Response> {
  const moon = moonshotKey();
  const baseUrl = moon ? moonshotBase() : LOVABLE_BASE;
  const apiKey = moon || Deno.env.get("LOVABLE_API_KEY")!;
  const model = moon
    ? (Deno.env.get("MOONSHOT_MODEL") || "kimi-k2.6")
    : "google/gemini-2.5-flash";
  const extra: Record<string, unknown> = {};
  if (moon) {
    extra.temperature = 0.6;
    if (!String(model).startsWith("kimi-k3")) {
      extra.thinking = { type: "disabled" };
    }
  }
  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      model,
      ...extra,
    }),
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
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
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
    const m = u.pathname.match(/scheda\/(\d+)/);
    if (m) return m[1];
    return (u.hostname + u.pathname).replace(/\/+$/, "").slice(0, 180);
  } catch {
    return url.slice(0, 180);
  }
}

function formulaUriForTool(name: string): string {
  const n = String(name || "").replace(/^\$/, "").toLowerCase().replace(/_/g, "-");
  if (n === "fetch" || n === "web-fetch") return FETCH_FORMULA;
  return SEARCH_FORMULA;
}

async function loadFormulaTools(): Promise<{ tools: unknown[]; ok: boolean }> {
  const key = moonshotKey();
  if (!key) return { tools: [], ok: false };
  const base = moonshotBase();
  try {
    const [search, fetchTool] = await Promise.all([
      fetch(`${base}/formulas/${SEARCH_FORMULA}/tools`, {
        headers: { Authorization: `Bearer ${key}` },
      }),
      fetch(`${base}/formulas/${FETCH_FORMULA}/tools`, {
        headers: { Authorization: `Bearer ${key}` },
      }),
    ]);
    const tools: unknown[] = [];
    if (search.ok) {
      const j = await search.json();
      if (Array.isArray(j.tools)) tools.push(...j.tools);
    } else {
      console.warn("formula web-search tools", search.status, await search.text());
    }
    if (fetchTool.ok) {
      const j = await fetchTool.json();
      if (Array.isArray(j.tools)) tools.push(...j.tools);
    } else {
      console.warn("formula fetch tools", fetchTool.status, await fetchTool.text());
    }
    return { tools, ok: tools.length > 0 };
  } catch (e) {
    console.warn("loadFormulaTools", e);
    return { tools: [], ok: false };
  }
}

async function runFiber(name: string, args: string): Promise<string> {
  const key = moonshotKey()!;
  const uri = formulaUriForTool(name);
  const resp = await fetch(`${moonshotBase()}/formulas/${uri}/fibers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, arguments: args }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.status && json.status !== "succeeded") {
    console.warn("fiber", name, resp.status, JSON.stringify(json).slice(0, 400));
    return JSON.stringify({ error: json?.error || `fiber ${resp.status}` });
  }
  const ctx = json?.context ?? {};
  const out = ctx.output || ctx.encrypted_output || "";
  return typeof out === "string" ? out : JSON.stringify(out);
}

type Filtri = {
  regioni: string[];
  importoMin?: string;
  importoMax?: string;
  dataDa?: string;
  dataA?: string;
};

function buildUserTask(filtri: Filtri): string {
  const parti = [
    'Cerca gare/bandi pubblici italiani di "brokeraggio assicurativo" (anche "broker assicurativo", "intermediazione assicurativa").',
    "Usa web_search sui portali: mondoappalti.it, ted.europa.eu, serviziocontrattipubblici.it.",
    "Poi usa fetch sulle schede più pertinenti (max 8) per leggere ente, CIG, importo, scadenza, località, PDF.",
    "NON inventare dati. Se un campo non c'è, null. Escludi gare già scadute da oltre un anno.",
    "Restituisci SOLO un JSON array (max 20) con: scheda_id, tipologia, oggetto, stazione_appaltante, ente_tipo, localita, regione, importo (numero), scadenza (dd/MM/yyyy), cig, link, pdf_url.",
  ];
  if (filtri.regioni.length) parti.push(`Filtra regioni: ${filtri.regioni.join(", ")}.`);
  if (filtri.importoMin) parti.push(`Importo minimo circa €${filtri.importoMin}.`);
  if (filtri.importoMax) parti.push(`Importo massimo circa €${filtri.importoMax}.`);
  if (filtri.dataDa) parti.push(`Pubblicati dal ${filtri.dataDa}.`);
  if (filtri.dataA) parti.push(`Pubblicati fino al ${filtri.dataA}.`);
  return parti.join(" ");
}

async function analizzaConKimiTools(filtri: Filtri): Promise<ReturnType<typeof mapBando>[] | null> {
  const { tools, ok } = await loadFormulaTools();
  if (!ok) return null;

  const messages: Record<string, unknown>[] = [
    {
      role: "system",
      content:
        "Sei un analista di gare d'appalto per un broker italiano. " +
        "Cerca e apri le schede come farebbe un operatore su MondoAppalti. " +
        "Quando hai abbastanza dati, rispondi SOLO con il JSON array dei bandi, senza testo intorno.",
    },
    { role: "user", content: buildUserTask(filtri) },
  ];

  const started = Date.now();
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (Date.now() - started > TOOLS_BUDGET_MS) {
      console.warn("kimi tools budget esaurito al round", round);
      break;
    }
    const resp = await aiChatCompletions({
      messages,
      tools,
      tool_choice: "auto",
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.warn("kimi tools chat", resp.status, t.slice(0, 300));
      return null;
    }
    const json = await resp.json();
    const message = json?.choices?.[0]?.message ?? {};
    const toolCalls = message.tool_calls ?? [];
    if (!toolCalls.length) {
      const raw = parseOutput(String(message.content ?? ""));
      if (raw.length) {
        return raw.map((b, i) => finalizeBando(mapBando((b || {}) as Record<string, unknown>, i)));
      }
      break;
    }

    messages.push({
      role: "assistant",
      content: message.content ?? null,
      tool_calls: toolCalls,
      ...(message.reasoning_content ? { reasoning_content: message.reasoning_content } : {}),
    });

    for (const tc of toolCalls) {
      const fn = tc.function ?? {};
      const name = String(fn.name ?? "web_search");
      const args = typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {});
      const result = await runFiber(name, args);
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result || "(vuoto)",
      });
    }
  }
  if (messages.length > 2) {
    messages.push({
      role: "user",
      content:
        "Non chiamare altri tool. Restituisci ORA SOLO il JSON array dei bandi già trovati (max 20). " +
        "Campi: scheda_id, tipologia, oggetto, stazione_appaltante, ente_tipo, localita, regione, importo, scadenza, cig, link, pdf_url. " +
        "Preferisci schede mondoappalti.it. Non inventare CIG/enti.",
    });
    const last = await aiChatCompletions({ messages });
    if (last.ok) {
      const json = await last.json();
      const raw = parseOutput(String(json?.choices?.[0]?.message?.content ?? ""));
      if (raw.length) {
        return raw.map((b, i) => finalizeBando(mapBando((b || {}) as Record<string, unknown>, i)));
      }
    } else {
      console.warn("kimi tools finalize", last.status, (await last.text()).slice(0, 200));
    }
  }
  return [];
}

type WebHit = { title: string; url: string; snippet: string };

async function searchTavily(query: string, domains?: string[]): Promise<WebHit[]> {
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
      ...(domains?.length ? { include_domains: domains } : {}),
    }),
  });
  if (!resp.ok) return [];
  const json = await resp.json();
  return (json?.results ?? []).map((r: { title?: string; url?: string; content?: string }) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.content ?? "",
  }));
}

async function extractTavily(urls: string[]): Promise<string> {
  const key = Deno.env.get("TAVILY_API_KEY");
  if (!key || urls.length === 0) return "";
  const resp = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, urls: urls.slice(0, 8) }),
  });
  if (!resp.ok) return "";
  const json = await resp.json();
  const pages = (json?.results ?? []) as { url?: string; raw_content?: string }[];
  return pages
    .map((p) => `URL: ${p.url}\n${String(p.raw_content ?? "").slice(0, 4000)}`)
    .join("\n\n---\n\n");
}

async function searchSerper(query: string): Promise<WebHit[]> {
  const key = Deno.env.get("SERPER_API_KEY");
  if (!key) return [];
  const q = query.includes("site:") ? query : `${query} (site:mondoappalti.it OR site:ted.europa.eu)`;
  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q, gl: "it", hl: "it", num: 20 }),
  });
  if (!resp.ok) return [];
  const json = await resp.json();
  return (json?.organic ?? []).map((r: { title?: string; link?: string; snippet?: string }) => ({
    title: r.title ?? "",
    url: r.link ?? "",
    snippet: r.snippet ?? "",
  }));
}

async function analizzaConKimiHits(hits: WebHit[], filtri: Filtri, pages: string): Promise<ReturnType<typeof mapBando>[]> {
  const system =
    "Sei un analista di gare d'appalto italiane per un broker. " +
    "Estrai SOLO bandi reali. Non inventare CIG, importi, enti. " +
    "Rispondi SOLO con un JSON array: scheda_id, tipologia, oggetto, stazione_appaltante, ente_tipo, localita, regione, importo, scadenza (dd/MM/yyyy), cig, link, pdf_url.";

  const user =
    buildUserTask(filtri) +
    "\n\nRISULTATI SEARCH:\n" +
    JSON.stringify(hits.slice(0, 20), null, 2) +
    (pages ? `\n\nTESTO SCHEDE:\n${pages.slice(0, 24000)}` : "");

  const resp = await aiChatCompletions({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  const raw = parseOutput(json?.choices?.[0]?.message?.content ?? "");
  return raw.map((b, i) => {
    const mapped = mapBando((b || {}) as Record<string, unknown>, i);
    const hit = hits.find((h) => h.url === mapped.link) || hits[i];
    if (!mapped.link && hit?.url) mapped.link = hit.url;
    if (!mapped.titolo && hit?.title) mapped.titolo = hit.title;
    return finalizeBando(mapped);
  });
}

function finalizeBando(b: ReturnType<typeof mapBando>) {
  if (b.link && (!b.scheda_id || b.scheda_id.includes("/"))) {
    const fromUrl = schedaIdFromUrl(b.link);
    if (/^\d+$/.test(fromUrl)) b.scheda_id = fromUrl;
    else if (!b.scheda_id) b.scheda_id = fromUrl;
  }
  if (b.ente === "Stazione Appaltante") b.ente = "Ente non specificato";
  return b;
}

function dedupBandi(bandi: ReturnType<typeof mapBando>[]) {
  const seen = new Set<string>();
  return bandi.filter((b) => {
    const key = b.scheda_id || b.link || b.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return Boolean(b.link || b.titolo);
  }).slice(0, 20);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    requireAi();
    const body = await req.json();
    if ((body.action || "start") === "status") {
      return new Response(
        JSON.stringify({ done: true, sessions: [], bandi: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const filtri: Filtri = {
      regioni: ((body.regioni as string[]) || []).map(normalizeRegione),
      importoMin: body.importoMin,
      importoMax: body.importoMax,
      dataDa: body.dataDa,
      dataA: body.dataA,
    };

    console.log("cerca-bandi kimi", filtri);

    let via = "search-extract";
    let bandi: ReturnType<typeof mapBando>[] = [];
    try {
      const dove = filtri.regioni.length ? filtri.regioni.join(" ") : "Italia";
      const queries = [
        "site:mondoappalti.it/bancadati/scheda brokeraggio assicurativo",
        "site:mondoappalti.it brokeraggio assicurativo gara d'appalto",
        `bandi gare brokeraggio assicurativo ${dove} mondoappalti`,
        `intermediazione assicurativa gara d'appalto ${dove}`,
      ];
      const gathered = await Promise.all(queries.flatMap((q) => [
        searchTavily(q, ["mondoappalti.it"]),
        searchSerper(q),
      ]));
      const seen = new Set<string>();
      const hits: WebHit[] = [];
      for (const batch of gathered) {
        for (const h of batch) {
          if (!h.url || seen.has(h.url)) continue;
          seen.add(h.url);
          hits.push(h);
        }
      }
      hits.sort((a, b) => {
        const score = (u: string) =>
          /mondoappalti\.it.*scheda/i.test(u) ? 0 : /mondoappalti\.it/i.test(u) ? 1 : 2;
        return score(a.url) - score(b.url);
      });
      const extractUrls = hits
        .filter((h) => /mondoappalti\.it.*scheda/i.test(h.url))
        .concat(hits.filter((h) => !/mondoappalti\.it.*scheda/i.test(h.url)))
        .map((h) => h.url)
        .filter(Boolean);
      const pages = await extractTavily(extractUrls);
      if (hits.length > 0) {
        bandi = await analizzaConKimiHits(hits, filtri, pages);
      }
    } catch (e) {
      console.warn("cerca-bandi search-extract", e);
    }

    const qualityOk = bandi.filter((b) =>
      b.ente && b.ente !== "Ente non specificato" && (b.cig || b.link),
    ).length;

    if (qualityOk < 3) {
      via = "kimi-tools";
      const fromTools = await analizzaConKimiTools(filtri);
      if (fromTools && fromTools.length > bandi.length) {
        bandi = fromTools;
      } else if (fromTools && fromTools.length) {
        bandi = dedupBandi([...bandi, ...fromTools]);
        via = "search-extract+kimi-tools";
      } else if (bandi.length) {
        via = "search-extract";
      }
    }

    const dedup = dedupBandi(bandi);
    console.log("cerca-bandi kimi done", { via, count: dedup.length });

    return new Response(
      JSON.stringify({
        status: "completed",
        engine: "kimi",
        via,
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
