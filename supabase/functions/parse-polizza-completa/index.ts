// Edge function: parse-polizza-completa
// Estrae dati completi di una scheda di polizza italiana (qualsiasi ramo) via Gemini.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  name: "extract_polizza_completa",
  description:
    "Estrae i dati completi di una scheda di polizza assicurativa italiana: contraente, compagnia, dati polizza, premi, ramo, garanzie.",
  parameters: {
    type: "object",
    properties: {
      // Compagnia / intermediario
      compagnia: { type: "string", description: "Denominazione completa della compagnia assicuratrice (es. 'AmTrust Assicurazioni S.p.A.')" },
      intermediario: { type: "string", description: "Nome del broker/intermediario se indicato (es. 'CONSULBROKERS S.P.A.')" },
      codice_nodo: { type: "string", description: "Codice nodo dell'intermediario" },

      // Contraente
      contraente_nome: { type: "string", description: "Nome e cognome OPPURE ragione sociale del contraente" },
      contraente_codice_fiscale: { type: "string", description: "Codice fiscale del contraente (16 caratteri o 11 per persona giuridica)" },
      contraente_partita_iva: { type: "string" },
      contraente_indirizzo: { type: "string", description: "Indirizzo (via e numero civico)" },
      contraente_comune: { type: "string" },
      contraente_provincia: { type: "string", description: "Sigla provincia (2 lettere)" },
      contraente_cap: { type: "string" },
      contraente_nazione: { type: "string", description: "Codice ISO nazione (es. IT)" },
      contraente_email: { type: "string" },
      contraente_telefono: { type: "string" },

      // Polizza
      numero_polizza: { type: "string" },
      polizza_sostituita: { type: "string", description: "Numero della polizza sostituita se presente" },
      prodotto: { type: "string", description: "Nome/descrizione del prodotto assicurativo (es. 'AmTrust Colpagrave Extra Ed.02/2023')" },
      ramo_descrizione: { type: "string", description: "Descrizione del ramo assicurativo dedotto dal documento (es. 'RC Professionale Medico', 'RCA Auto', 'Incendio Fabbricato')" },

      // Periodo
      decorrenza: { type: "string", description: "Data inizio copertura YYYY-MM-DD" },
      scadenza: { type: "string", description: "Data fine copertura YYYY-MM-DD" },
      prossima_quietanza: { type: "string", description: "Data prossima quietanza YYYY-MM-DD" },
      frazionamento: { type: "string", description: "Annuale | Semestrale | Quadrimestrale | Trimestrale | Mensile" },
      tacito_rinnovo: { type: "boolean" },

      // Premi alla firma
      premio_firma_netto: { type: "number" },
      premio_firma_accessori: { type: "number" },
      premio_firma_imposte: { type: "number" },
      premio_firma_lordo: { type: "number" },

      // Premi rate future / quietanza
      premio_quietanza_netto: { type: "number" },
      premio_quietanza_accessori: { type: "number" },
      premio_quietanza_imposte: { type: "number" },
      premio_quietanza_lordo: { type: "number" },

      // RCA-specifici (opzionali)
      targa: { type: "string" },

      // Garanzie operanti
      garanzie: {
        type: "array",
        description: "Elenco garanzie OPERANTI (con flag = SI). Ignora garanzie non attive.",
        items: {
          type: "object",
          properties: {
            descrizione: { type: "string", description: "Descrizione della garanzia esattamente come sul documento" },
            massimale: { type: "number", description: "Massimale per sinistro in euro, se indicato" },
            premio_netto: { type: "number" },
          },
          required: ["descrizione"],
          additionalProperties: false,
        },
      },
    },
    required: ["numero_polizza"],
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
          "Sei un esperto di polizze assicurative italiane. Estrai TUTTI i dati strutturati dalla scheda di polizza fornita. " +
          "Date in formato YYYY-MM-DD. Importi numerici (es. 1234.56 — usa il punto come separatore decimale). " +
          "Per le garanzie, includi SOLO quelle effettivamente operanti (flag SI/Operante). " +
          "Codice fiscale e partita IVA in maiuscolo. Provincia in 2 lettere maiuscole. " +
          "Se un campo non è chiaramente presente sul documento, ometterlo (non inventare).",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analizza questa scheda di polizza ed estrai i dati richiesti." },
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
    console.error("parse-polizza-completa error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
