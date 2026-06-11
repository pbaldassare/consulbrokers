// Edge function: chiedi-polizza-cga
// Risponde a domande sulla polizza CGA usando SOLO i dati strutturati già
// estratti nel DB. Nessuna rilettura del PDF originale.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const { polizza_cga_id, domanda } = await req.json();
    if (!polizza_cga_id || !domanda) {
      return new Response(JSON.stringify({ error: "polizza_cga_id e domanda richiesti" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: polizza, error: errP } = await supabase
      .from("polizza_cga")
      .select("id, sommario_personalizzato, prodotto_id, prodotti_cga:prodotto_id(nome_prodotto, compagnia, ramo, edizione, sommario_ai)")
      .eq("id", polizza_cga_id)
      .maybeSingle();
    if (errP || !polizza) {
      return new Response(JSON.stringify({ error: "Polizza non trovata o non accessibile" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: garPers }, { data: garProd }, { data: cond }] = await Promise.all([
      supabase.from("polizza_garanzie_personali").select("*").eq("polizza_cga_id", polizza_cga_id),
      supabase.from("prodotti_garanzie").select("*").eq("prodotto_id", polizza.prodotto_id),
      supabase.from("prodotti_condizioni").select("*").eq("prodotto_id", polizza.prodotto_id),
    ]);

    const contesto = {
      prodotto: polizza.prodotti_cga,
      sommario_personalizzato_cliente: polizza.sommario_personalizzato,
      garanzie_standard_prodotto: garProd ?? [],
      garanzie_personalizzate_cliente: garPers ?? [],
      condizioni_prodotto: cond ?? [],
    };

    const messages = [
      {
        role: "system",
        content:
          "Sei un assistente esperto di polizze assicurative italiane. Rispondi SOLO usando il contesto JSON fornito (dati già estratti dalla CGA). Non inventare nulla. " +
          "Quando una garanzia ha override personalizzato, dai priorità a quello e indica esplicitamente la fonte: '(dato personalizzato)' o '(dato di prodotto)'. " +
          "Se l'informazione non è nel contesto, rispondi che non è presente nei dati estratti.",
      },
      {
        role: "user",
        content:
          "CONTESTO POLIZZA (JSON):\n" + JSON.stringify(contesto, null, 2) +
          "\n\nDOMANDA: " + domanda,
      },
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit AI superato." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Errore AI gateway" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const risposta = json?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ ok: true, risposta }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chiedi-polizza-cga error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
