// Edge function: chiedi-mercato-assicurativo
// Chat con ricerca web sul mercato assicurativo italiano (non DB interno).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type StoricoMsg = { role: string; content: string };

type SearchHit = { title: string; url: string; snippet: string };

const PREFERITI_DOMINI = [
  "ivass.it",
  "ania.it",
  "assinforma.it",
  "normattiva.it",
  "gazzettaufficiale.it",
  "assicurazioni.it",
  "insurancenews.it",
  "brokeronline.it",
  "financecommunity.it",
];

const OFF_TOPIC_KEYWORDS = [
  "ricetta",
  "calcio",
  "film",
  "minecraft",
  "programmazione python",
  "meteo",
];

async function callGemini(
  apiKey: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

async function searchTavily(apiKey: string, query: string): Promise<SearchHit[]> {
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 8,
      include_domains: PREFERITI_DOMINI,
      include_answer: false,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Tavily ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  return (json?.results ?? []).map((r: { title?: string; url?: string; content?: string }) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.content ?? "",
  }));
}

async function searchSerper(apiKey: string, query: string): Promise<SearchHit[]> {
  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, gl: "it", hl: "it", num: 8 }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Serper ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  const organic = json?.organic ?? [];
  return organic.map((r: { title?: string; link?: string; snippet?: string }) => ({
    title: r.title ?? "",
    url: r.link ?? "",
    snippet: r.snippet ?? "",
  }));
}

async function webSearch(query: string): Promise<SearchHit[]> {
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  const serperKey = Deno.env.get("SERPER_API_KEY");

  const enrichedQuery = `${query} assicurazioni mercato assicurativo Italia IVASS`;

  if (tavilyKey) {
    try {
      const hits = await searchTavily(tavilyKey, enrichedQuery);
      if (hits.length > 0) return hits;
    } catch (e) {
      console.warn("Tavily fallito, provo Serper", e);
    }
  }

  if (serperKey) {
    return searchSerper(serperKey, enrichedQuery);
  }

  throw new Error(
    "Ricerca web non configurata. Impostare TAVILY_API_KEY o SERPER_API_KEY nei secrets Supabase.",
  );
}

function isLikelyOffTopic(domanda: string): boolean {
  const lower = domanda.toLowerCase();
  return OFF_TOPIC_KEYWORDS.some((k) => lower.includes(k));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const body = await req.json();
    const domanda = String(body?.domanda ?? "").trim();
    const storico: StoricoMsg[] = Array.isArray(body?.storico) ? body.storico.slice(-6) : [];

    if (!domanda) {
      return new Response(JSON.stringify({ error: "domanda richiesta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isLikelyOffTopic(domanda)) {
      return new Response(
        JSON.stringify({
          ok: true,
          risposta:
            "Posso rispondere **solo** su mercato assicurativo, normativa IVASS, prodotti, coperture, provvigioni, sinistri e brokeraggio in Italia/Europa. Riformula la domanda in ambito assicurativo.",
          fonti: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Query di ricerca ottimizzata
    const queryPrompt = [
      {
        role: "system",
        content:
          "Genera UNA sola query di ricerca Google in italiano (max 12 parole) per trovare informazioni aggiornate sul mercato assicurativo italiano. Rispondi SOLO con la query, senza virgolette né spiegazioni.",
      },
      {
        role: "user",
        content: `Domanda utente: ${domanda}\nContesto precedente: ${storico.slice(-2).map((m) => m.content).join(" | ") || "nessuno"}`,
      },
    ];
    let searchQuery = domanda;
    try {
      const q = await callGemini(LOVABLE_API_KEY, queryPrompt);
      if (q.trim().length > 5 && q.trim().length < 120) searchQuery = q.trim();
    } catch (e) {
      console.warn("Query optimizer fallito, uso domanda originale", e);
    }

    const hits = await webSearch(searchQuery);

    const fonti = hits.map((h) => ({
      title: h.title,
      url: h.url,
      snippet: h.snippet.slice(0, 280),
    }));

    const systemPrompt =
      "Sei **Consul Mercato**, assistente di un broker assicurativo italiano. " +
      "Rispondi SOLO usando i risultati web forniti nel JSON e la tua conoscenza generale del settore assicurativo italiano. " +
      "Argomenti ammessi: mercato assicurativo, IVASS, ANIA, normativa (Codice delle Assicurazioni), prodotti, coperture, provvigioni, sinistri, M&A compagnie, trend premi, distribuzione assicurativa, cyber, RC, D&O, brokeraggio. " +
      "Rifiuta domande fuori ambito assicurativo. " +
      "Cita le fonti con link markdown [titolo](url). Preferisci fonti ufficiali (IVASS, ANIA, normattiva). " +
      "Se i risultati web sono insufficienti, dillo chiaramente. " +
      "Disclaimer finale breve: orientamento professionale, non consulenza legale/fiscale vincolante. " +
      "Per condizioni contrattuali di un prodotto specifico, suggerisci la tab **Libreria CGA** nel Documentale.";

    const userContent =
      "RISULTATI RICERCA WEB (JSON):\n" +
      JSON.stringify({ query: searchQuery, risultati: fonti }, null, 2) +
      "\n\nDOMANDA UTENTE: " +
      domanda;

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...storico.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: userContent },
    ];

    let risposta: string;
    try {
      risposta = await callGemini(LOVABLE_API_KEY, messages);
    } catch (e) {
      if (e instanceof Error && e.message.includes("429")) {
        return new Response(JSON.stringify({ error: "Rate limit AI superato." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        risposta,
        fonti,
        query: searchQuery,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("chiedi-mercato-assicurativo error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }),
      { status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
