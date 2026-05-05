const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  name: "extract_polizza_rca",
  description:
    "Estrae dati di una polizza assicurativa Auto/RCA italiana, in particolare le voci di premio per garanzia.",
  parameters: {
    type: "object",
    properties: {
      numero_polizza: { type: "string" },
      compagnia: { type: "string" },
      contraente: { type: "string" },
      targa: { type: "string" },
      decorrenza: { type: "string", description: "YYYY-MM-DD" },
      scadenza: { type: "string", description: "YYYY-MM-DD" },
      voci_garanzia: {
        type: "array",
        description:
          "Una riga per ciascuna garanzia/voce premio presente sulla polizza (es. RCA, Cristalli, Furto, Incendio, Casko, Assistenza, Tutela, Infortuni, Eventi atmosferici, Atti vandalici, ecc.).",
        items: {
          type: "object",
          properties: {
            descrizione: {
              type: "string",
              description: "Testo originale della garanzia esattamente come appare sulla polizza",
            },
            codice_polizza: {
              type: "string",
              description: "Eventuale codice/sigla della garanzia se presente sul documento",
            },
            premio_netto: { type: "number" },
            aliquota_tasse_pct: { type: "number" },
            premio_lordo: { type: "number" },
          },
          required: ["descrizione", "premio_netto"],
          additionalProperties: false,
        },
      },
    },
    required: ["voci_garanzia"],
    additionalProperties: false,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const { fileBase64, mimeType } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "fileBase64 e mimeType richiesti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;

    const messages = [
      {
        role: "system",
        content:
          "Sei un esperto di polizze assicurative italiane Auto/RCA. Estrai TUTTE le voci di premio per garanzia con descrizione testuale originale e premio netto. Se sul documento è presente un codice/sigla per la garanzia includilo. Importi numerici (es. 1234.56). Date in formato YYYY-MM-DD.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analizza questa polizza ed estrai i dati richiesti." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [{ type: "function", function: TOOL }],
        tool_choice: { type: "function", function: { name: TOOL.name } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit AI superato. Riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (resp.status === 402)
        return new Response(
          JSON.stringify({ error: "Crediti AI esauriti. Aggiungi credito al workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      return new Response(JSON.stringify({ error: "Errore AI gateway" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: any = {};
    try {
      parsed = typeof args === "string" ? JSON.parse(args) : args ?? {};
    } catch (e) {
      console.error("parse args fail", e, args);
    }

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-polizza-rca error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
