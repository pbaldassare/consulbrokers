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
    const { gruppi, compagnie } = await req.json();

    // Step 1: Nullify compagnia_id in dependent tables
    const depTables = [
      "anagrafiche_professionali","dettaglio_riparto","document_folders",
      "flussi_compagnia","prodotti","provvigioni_compagnia_ramo",
      "rimessa_premi","sinistri","titoli"
    ];
    for (const t of depTables) {
      await supabase.from(t).update({ compagnia_id: null }).not("compagnia_id", "is", null);
    }

    // Step 2: Delete existing
    await supabase.from("compagnie").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("gruppi_compagnia").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Step 3: Insert gruppi
    const { data: insertedGruppi, error: gErr } = await supabase
      .from("gruppi_compagnia")
      .insert(gruppi.map((g: any) => ({ codice: g.codice, descrizione: g.descrizione, attivo: true })))
      .select("id, descrizione");
    
    if (gErr) throw new Error(`Gruppi insert error: ${gErr.message}`);

    // Build lookup map
    const groupMap: Record<string, string> = {};
    for (const g of insertedGruppi || []) {
      groupMap[g.descrizione] = g.id;
    }

    // Ensure PLURIMANDATARIO fallback exists
    let pluriId: string | null = null;
    const { data: pluriRow } = await supabase
      .from("gruppi_compagnia")
      .select("id")
      .eq("codice", "PLURIMANDATARIO")
      .maybeSingle();
    if (pluriRow) {
      pluriId = pluriRow.id;
    } else {
      const { data: created } = await supabase
        .from("gruppi_compagnia")
        .insert({ codice: "PLURIMANDATARIO", descrizione: "PLURIMANDATARIO", attivo: true })
        .select("id")
        .single();
      pluriId = created?.id || null;
    }

    // Step 4: Insert compagnie in batches of 100
    let inserted = 0;
    let errors = 0;
    const batchSize = 100;
    
    for (let i = 0; i < compagnie.length; i += batchSize) {
      const batch = compagnie.slice(i, i + batchSize).map((c: any) => ({
        ...c,
        gruppo_compagnia_id: c.gruppo_compagnia
          ? (groupMap[c.gruppo_compagnia] || pluriId)
          : pluriId,
      }));

      const { error } = await supabase.from("compagnie").insert(batch);
      if (error) {
        errors += batch.length;
        console.error(`Batch ${i} error:`, error.message);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, gruppi: insertedGruppi?.length || 0, compagnie_inserted: inserted, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
