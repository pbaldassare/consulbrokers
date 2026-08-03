// Edge function: chiedi-mercato-assicurativo (Assistente Web)
// Chat web stile ChatGPT — NON accede a DB/polizze/portafoglio CBnet.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type StoricoMsg = { role: string; content: string };
type SearchHit = { title: string; url: string; snippet: string };

const ALLOWED_EMAIL_DOMAINS = [
  "consulbrokers.it",
  "cbdigital.tech",
  "etisicura.it",
  "mpcunderwriting.it",
  "interfidi.net",
  "gbintermediazioni.it",
  "exebroker.it",
  "igbsrl.it",
  "probroker.it",
  "dibroker.it",
];

function getEmailDomain(email: string): string | null {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at === e.length - 1) return null;
  return e.slice(at + 1);
}

function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = getEmailDomain(email);
  return !!domain && ALLOWED_EMAIL_DOMAINS.includes(domain);
}

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
      max_results: 10,
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
    body: JSON.stringify({ q: query, gl: "it", hl: "it", num: 10 }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Serper ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  return (json?.organic ?? []).map((r: { title?: string; link?: string; snippet?: string }) => ({
    title: r.title ?? "",
    url: r.link ?? "",
    snippet: r.snippet ?? "",
  }));
}

async function webSearch(query: string): Promise<SearchHit[]> {
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  const serperKey = Deno.env.get("SERPER_API_KEY");

  if (tavilyKey) {
    try {
      const hits = await searchTavily(tavilyKey, query);
      if (hits.length > 0) return hits;
    } catch (e) {
      console.warn("Tavily fallito, provo Serper", e);
    }
  }

  if (serperKey) {
    return searchSerper(serperKey, query);
  }

  throw new Error(
    "Ricerca web non configurata. Impostare TAVILY_API_KEY o SERPER_API_KEY nei secrets Supabase.",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const body = await req.json();
    const domanda = String(body?.domanda ?? "").trim();
    const storico: StoricoMsg[] = Array.isArray(body?.storico) ? body.storico.slice(-10) : [];
    const email = body?.email ? String(body.email).trim() : null;

    if (!domanda) {
      return new Response(JSON.stringify({ error: "domanda richiesta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isEmailAllowed(email)) {
      return new Response(
        JSON.stringify({
          error: "Accesso non autorizzato. Usa un'email aziendale del partner abilitato.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Ottimizza query di ricerca (opzionale)
    let searchQuery = domanda;
    try {
      const q = await callGemini(LOVABLE_API_KEY, [
        {
          role: "system",
          content:
            "Genera UNA query Google concisa in italiano (max 15 parole) per trovare informazioni utili alla domanda. Rispondi SOLO con la query, senza virgolette.",
        },
        {
          role: "user",
          content: `Domanda: ${domanda}`,
        },
      ]);
      if (q.trim().length > 3 && q.trim().length < 150) searchQuery = q.trim();
    } catch {
      // usa domanda originale
    }

    const hits = await webSearch(searchQuery);
    const fonti = hits.map((h) => ({
      title: h.title,
      url: h.url,
      snippet: h.snippet.slice(0, 320),
    }));

    const systemPrompt =
      "Sei **Assistente Web**, un assistente conversazionale per professionisti del brokeraggio assicurativo italiano. " +
      "Comportati come ChatGPT con accesso al web: tono naturale, chiaro, professionale ma non rigido. " +
      "REGOLE FERREE:\n" +
      "• NON hai accesso a polizze, clienti, portafoglio, titoli, quietanze o dati interni CBnet/Consulbrokers.\n" +
      "• Se l'utente chiede 'le mie polizze', dati cliente o estrazioni dal gestionale → spiega che Assistente Web non può accedervi; indirizza al gestionale CBnet.\n" +
      "• Se chiede clausole/garanzie di un prodotto assicurativo specifico → suggerisci la tab **Libreria CGA** nel Documentale.\n" +
      "• Usa i risultati web forniti nel JSON; integra con conoscenza generale quando utile.\n" +
      "• Cita le fonti con link markdown [titolo](url) quando possibile.\n" +
      "• Preferisci fonti ufficiali (IVASS, ANIA, normattiva) per normativa e mercato assicurativo.\n" +
      "• Rispondi in italiano. Struttura con elenchi quando aiuta la lettura.\n" +
      "• Breve disclaimer finale: orientamento professionale, non consulenza legale/fiscale vincolante.";

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
      JSON.stringify({ ok: true, risposta, fonti, query: searchQuery }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("chiedi-mercato-assicurativo error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
