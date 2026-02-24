import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { azione, ...params } = await req.json();

    if (azione === "crea") {
      const { numero_sinistro, titolo_id, cliente_id, compagnia_id, responsabile_id, ufficio_id, descrizione, user_id } = params;

      const { data: sinistro, error } = await supabase.from("sinistri").insert({
        numero_sinistro, titolo_id, cliente_id, compagnia_id, responsabile_id, ufficio_id, descrizione,
      }).select().single();

      if (error) throw error;

      // Default checklist
      const defaultChecklist = [
        { sinistro_id: sinistro.id, descrizione: "Denuncia sinistro compilata", obbligatorio: true },
        { sinistro_id: sinistro.id, descrizione: "Documentazione fotografica", obbligatorio: true },
        { sinistro_id: sinistro.id, descrizione: "Copia polizza allegata", obbligatorio: true },
        { sinistro_id: sinistro.id, descrizione: "Modulo CID/CAI compilato", obbligatorio: false },
      ];
      await supabase.from("sinistro_checklist").insert(defaultChecklist);

      // Log
      if (user_id) {
        await supabase.from("log_attivita").insert({
          user_id, azione: "creazione_sinistro", entita_tipo: "sinistro", entita_id: sinistro.id,
        });
      }

      return new Response(JSON.stringify({ success: true, sinistro }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (azione === "cambia_stato") {
      const { sinistro_id, nuovo_stato, user_id } = params;

      // If closing, validate checklist + eventi
      if (nuovo_stato === "chiuso") {
        const { data: checklistPending } = await supabase
          .from("sinistro_checklist")
          .select("id")
          .eq("sinistro_id", sinistro_id)
          .eq("obbligatorio", true)
          .eq("completato", false);

        if (checklistPending && checklistPending.length > 0) {
          return new Response(JSON.stringify({
            success: false,
            error: `Impossibile chiudere: ${checklistPending.length} checklist obbligatorie non completate`,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { data: eventiAttivi } = await supabase
          .from("sinistro_eventi")
          .select("id")
          .eq("sinistro_id", sinistro_id)
          .eq("stato", "attivo");

        if (eventiAttivi && eventiAttivi.length > 0) {
          return new Response(JSON.stringify({
            success: false,
            error: `Impossibile chiudere: ${eventiAttivi.length} eventi ancora attivi`,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const updateData: Record<string, unknown> = { stato: nuovo_stato, updated_at: new Date().toISOString() };
      if (nuovo_stato === "chiuso") updateData.data_chiusura = new Date().toISOString().split("T")[0];

      const { error } = await supabase.from("sinistri").update(updateData).eq("id", sinistro_id);
      if (error) throw error;

      if (user_id) {
        await supabase.from("log_attivita").insert({
          user_id,
          azione: nuovo_stato === "chiuso" ? "chiusura_sinistro" : "cambio_stato_sinistro",
          entita_tipo: "sinistro",
          entita_id: sinistro_id,
          dettagli_json: { nuovo_stato },
        });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (azione === "aggiorna_scaduti") {
      // Mark overdue events as scaduto
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("sinistro_eventi")
        .update({ stato: "scaduto" })
        .eq("stato", "attivo")
        .lt("data_scadenza", today)
        .select();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, aggiornati: data?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Azione non valida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
