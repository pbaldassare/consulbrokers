import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const { pdf_base64, mime_type } = (await req.json()) as {
      pdf_base64: string;
      mime_type?: string;
    };
    const cleanBase64 = (pdf_base64 || "").replace(/\s/g, "");
    if (!cleanBase64) return json({ righe: [], warning: "Allegato vuoto: seleziona un PDF o un'immagine valida." });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY non configurata" }, 500);

    const mt = mime_type || "application/pdf";
    const estimatedBytes = Math.floor((cleanBase64.length * 3) / 4);
    console.log("[parse-tariffario-rami] in", { mime: mt, sizeKB: Math.round(estimatedBytes / 1024) });
    if (estimatedBytes < 100) {
      return json({ righe: [], warning: "Allegato non leggibile o senza pagine. Ricarica il PDF originale o usa un'immagine JPG/PNG della tabella." });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    let aiResponse: Response;
    try {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Estrai una tabella di tariffario provvigioni assicurative da un documento (PDF o immagine).
Per ogni voce restituisci:
- "ramo": nome del Ramo principale (es. AUTO, INFORTUNI, MALATTIA, RAMI ELEMENTARI, RC GENERALE, INCENDIO, FURTO, CAUZIONI, TUTELA LEGALE, ASSISTENZA, VITA).
- "sottoramo": nome del Sottoramo se presente (es. RCA, ARD, CRISTALLI, ASSISTENZA STRADALE). Lascia stringa vuota se la riga è il totale del ramo.
- "percentuale": numero decimale (converti virgole in punti, es "12,5%" -> 12.5).
Estrai TUTTE le righe leggibili, anche se la prima colonna si chiama "Sezione" o "Categoria". Ignora righe di intestazione/totale documento.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Estrai tutte le righe del tariffario provvigioni." },
                { type: "image_url", image_url: { url: `data:${mt};base64,${cleanBase64}` } },
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
                          ramo: { type: "string" },
                          sottoramo: { type: "string" },
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
    } catch (netErr) {
      clearTimeout(timeout);
      console.error("[parse-tariffario-rami] network/timeout", netErr);
      return json({ error: "Timeout o errore di rete contattando il gateway IA. Riprova." }, 504);
    }
    clearTimeout(timeout);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[parse-tariffario-rami] gateway", aiResponse.status, errText);
      if (aiResponse.status === 400 && /no pages|document has no pages|INVALID_ARGUMENT/i.test(errText)) {
        return json({ righe: [], warning: "Il PDF non contiene pagine leggibili per l'IA. Prova a caricare una scansione JPG/PNG della tabella provvigionale." });
      }
      if (aiResponse.status === 429) return json({ error: "Troppe richieste, riprova tra qualche secondo." }, 429);
      if (aiResponse.status === 402) return json({ error: "Crediti AI esauriti." }, 402);
      if (aiResponse.status === 413) return json({ error: "File troppo grande per il modello IA. Carica una porzione o un'immagine più leggera." }, 413);
      return json({ error: `Errore gateway IA (${aiResponse.status})` }, 502);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.warn("[parse-tariffario-rami] nessun tool_call", JSON.stringify(aiData).slice(0, 500));
      return json({ righe: [], warning: "L'IA non ha prodotto righe strutturate. Prova con un'immagine più nitida." });
    }

    let parsed: { righe?: any[] } = {};
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("[parse-tariffario-rami] parse args", e);
      return json({ righe: [], warning: "Risposta IA non interpretabile." });
    }

    const righe = parsed.righe || [];
    console.log("[parse-tariffario-rami] out", { righe: righe.length, ms: Date.now() - t0 });
    return json({ righe });
  } catch (e) {
    console.error("[parse-tariffario-rami] error", e);
    return json({ error: e instanceof Error ? e.message : "Errore" }, 500);
  }
});
