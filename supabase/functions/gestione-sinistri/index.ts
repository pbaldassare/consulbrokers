import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const payloadSchema = z.discriminatedUnion("azione", [
  z.object({
    azione: z.literal("crea"),
    numero_sinistro: z.string().min(1),
    titolo_id: z.string().uuid(),
    cliente_id: z.string().uuid().nullable().optional(),
    compagnia_id: z.string().uuid().nullable().optional(),
    responsabile_id: z.string().uuid().nullable().optional(),
    ufficio_id: z.string().uuid().nullable().optional(),
    descrizione: z.string().optional(),
    user_id: z.string().uuid().optional(),
    cliente_anagrafica_id: z.string().uuid().nullable().optional(),
    tipo_sinistro: z.string().optional(),
    luogo_sinistro: z.string().optional(),
    data_evento: z.string().optional(),
  }),
  z.object({
    azione: z.literal("cambia_stato"),
    sinistro_id: z.string().uuid(),
    nuovo_stato: z.enum(['in_valutazione','aperto','in_lavorazione','in_attesa_documenti','in_liquidazione','chiuso','respinto']),
    user_id: z.string().uuid().optional(),
    note: z.string().optional(),
  }),
  z.object({
    azione: z.literal("aggiorna_scaduti"),
  })
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ success: false, error: "Payload non valido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({
        success: false,
        error: "Payload non valido",
        details: parsed.error.flatten(),
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { azione } = parsed.data;

    if (azione === "crea") {
      const {
        numero_sinistro, titolo_id, cliente_id, compagnia_id, responsabile_id, ufficio_id, descrizione, user_id,
        cliente_anagrafica_id, tipo_sinistro, luogo_sinistro, data_evento
      } = parsed.data;

      const { data: sinistro, error } = await supabase.from("sinistri").insert({
        numero_sinistro, titolo_id, cliente_id, compagnia_id, responsabile_id, ufficio_id, descrizione,
        cliente_anagrafica_id: cliente_anagrafica_id || null,
        tipo_sinistro: tipo_sinistro || null,
        luogo_sinistro: luogo_sinistro || null,
        data_evento: data_evento || null,
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
      const { sinistro_id, nuovo_stato, user_id, note } = parsed.data;

      // Stato precedente per log
      const { data: prev } = await supabase
        .from("sinistri")
        .select("stato, ufficio_id")
        .eq("id", sinistro_id)
        .maybeSingle();
      const stato_precedente = prev?.stato ?? null;

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
      else updateData.data_chiusura = null;

      const { error } = await supabase.from("sinistri").update(updateData).eq("id", sinistro_id);
      if (error) throw error;

      // Evento timeline
      await supabase.from("sinistro_eventi").insert({
        sinistro_id,
        tipo_evento: "cambio_stato",
        stato: "completato",
        note: `Stato ${stato_precedente ?? "—"} → ${nuovo_stato}${note ? ` · ${note}` : ""}`,
      });

      // Log attività
      await supabase.from("log_attivita").insert({
        user_id: user_id ?? null,
        azione: nuovo_stato === "chiuso" ? "chiusura_sinistro" : "cambio_stato_sinistro",
        entita_tipo: "sinistro",
        entita_id: sinistro_id,
        ufficio_id: prev?.ufficio_id ?? null,
        dettagli_json: { stato_precedente, nuovo_stato, note: note ?? null },
        severity: "info",
      });

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (azione === "aggiorna_scaduti") {
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
