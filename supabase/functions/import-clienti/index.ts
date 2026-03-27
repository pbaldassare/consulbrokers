import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { action, records, gruppi_finanziari, ufficio } = await req.json();

    if (action === "setup") {
      // Create ufficio
      let ufficio_id = null;
      if (ufficio) {
        const { data: uf, error: ufErr } = await supabase
          .from("uffici")
          .insert({ nome_ufficio: ufficio, attivo: true })
          .select("id")
          .single();
        if (ufErr) throw new Error(`Ufficio error: ${ufErr.message}`);
        ufficio_id = uf.id;
      }

      // Create gruppi_finanziari
      const gf_map: Record<string, string> = {};
      if (gruppi_finanziari) {
        for (let i = 0; i < gruppi_finanziari.length; i++) {
          const nome = gruppi_finanziari[i];
          const codice = `GF${String(i + 1).padStart(2, "0")}`;
          const { data, error } = await supabase
            .from("gruppi_finanziari")
            .insert({ codice, nome, descrizione: nome, attivo: true })
            .select("id")
            .single();
          if (error) {
            console.error(`GF error for ${nome}:`, error.message);
          } else {
            gf_map[nome] = data.id;
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, ufficio_id, gf_map }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "import") {
      if (!records) throw new Error("Missing records");
      let inserted = 0;
      let errors = 0;
      const batchSize = 50;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await supabase.from("clienti").insert(batch);
        if (error) {
          errors += batch.length;
          console.error(`Batch ${i} error:`, error.message);
        } else {
          inserted += batch.length;
        }
      }

      return new Response(
        JSON.stringify({ success: true, inserted, errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Unknown action");
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
