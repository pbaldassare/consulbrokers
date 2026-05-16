import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pdf_base64, mime_type } = await req.json() as {
      pdf_base64: string;
      mime_type?: string;
    };
    if (!pdf_base64) throw new Error("pdf_base64 obbligatorio");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY non configurata");

    const mt = mime_type || "application/pdf";

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Estrai una tabella di tariffario provvigioni assicurative.
Per ogni voce restituisci: nome del Ramo (es. AUTO, INFORTUNI, RAMI ELEMENTARI), nome del Sottoramo se presente (es. RCA AUTO, ARD, CRISTALLI, ASSISTENZA), percentuale di provvigione.
Se la riga è un "totale ramo" senza sottoramo, lascia sottoramo vuoto.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Estrai tutte le righe del tariffario provvigioni." },
              { type: "image_url", image_url: { url: `data:${mt};base64,${pdf_base64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_tariffario",
              parameters: {
                type: "object",
                properties: {
                  righe: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ramo: { type: "string", description: "Nome del ramo" },
                        sottoramo: { type: "string", description: "Nome del sottoramo (vuoto se non specificato)" },
                        percentuale: { type: "number" },
                      },
                      required: ["ramo", "percentuale"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["righe"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_tariffario" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Troppe richieste, riprova tra qualche secondo." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Nessun risultato strutturato");
    const parsed = JSON.parse(toolCall.function.arguments) as {
      righe: { ramo: string; sottoramo?: string; percentuale: number }[];
    };

    return new Response(JSON.stringify({ righe: parsed.righe || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-tariffario-rami error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
