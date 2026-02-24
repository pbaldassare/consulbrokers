import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { titolo_id } = await req.json();
    if (!titolo_id) throw new Error("titolo_id richiesto");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch titolo
    const { data: titolo, error: tErr } = await supabaseAdmin
      .from("titoli")
      .select("*, prodotti(id, nome_prodotto)")
      .eq("id", titolo_id)
      .single();
    if (tErr || !titolo) throw new Error("Titolo non trovato");
    if (titolo.stato !== "incassato") throw new Error("Titolo non incassato");

    // Get produttore profile for ruolo
    let produttoreRuolo: string | null = null;
    if (titolo.produttore_id) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("ruolo")
        .eq("id", titolo.produttore_id)
        .single();
      produttoreRuolo = prof?.ruolo ?? null;
    }

    // Fetch all matching matrice rules for this product
    const { data: regole } = await supabaseAdmin
      .from("matrice_provvigioni")
      .select("*")
      .eq("prodotto_id", titolo.prodotto_id)
      .eq("attiva", true);

    if (!regole || regole.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nessuna regola provvigionale trovata", provvigioni: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Priority: 1) user_id match, 2) ufficio_id match, 3) ruolo match
    let bestRule = null;

    // Priority 1: user-specific
    if (titolo.produttore_id) {
      bestRule = regole.find((r) => r.user_id === titolo.produttore_id) ?? null;
    }

    // Priority 2: ufficio-specific
    if (!bestRule && titolo.ufficio_id) {
      bestRule = regole.find((r) => !r.user_id && r.ufficio_id === titolo.ufficio_id) ?? null;
    }

    // Priority 3: ruolo-based
    if (!bestRule && produttoreRuolo) {
      bestRule = regole.find((r) => !r.user_id && !r.ufficio_id && r.ruolo === produttoreRuolo) ?? null;
    }

    // Fallback: any rule without specifics
    if (!bestRule) {
      bestRule = regole.find((r) => !r.user_id && !r.ufficio_id && !r.ruolo) ?? null;
    }

    if (!bestRule) {
      return new Response(
        JSON.stringify({ message: "Nessuna regola applicabile", provvigioni: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate
    const base = titolo.importo_incassato ?? titolo.premio_lordo ?? 0;
    let importo = 0;
    if (bestRule.tipo_calcolo === "percentuale") {
      importo = (base * bestRule.percentuale_provvigione) / 100;
    } else {
      importo = bestRule.percentuale_provvigione; // fisso
    }

    // Delete old provvigioni for this titolo
    await supabaseAdmin.from("provvigioni_generate").delete().eq("titolo_id", titolo_id);

    // Insert new
    const { data: prov, error: pErr } = await supabaseAdmin
      .from("provvigioni_generate")
      .insert({
        titolo_id,
        user_id: titolo.produttore_id,
        percentuale: bestRule.percentuale_provvigione,
        importo_provvigione: Math.round(importo * 100) / 100,
      })
      .select()
      .single();

    if (pErr) throw pErr;

    return new Response(
      JSON.stringify({ message: "Provvigione calcolata", provvigione: prov }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
