import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const payloadSchema = z.discriminatedUnion("azione", [
  z.object({
    azione: z.literal("crea"),
    numero_sinistro: z.string().min(1).optional(),
    titolo_id: z.string().uuid().nullable().optional(),
    cliente_id: z.string().uuid().nullable().optional(),
    compagnia_id: z.string().uuid().nullable().optional(),
    responsabile_id: z.string().uuid().nullable().optional(),
    liquidatore_id: z.string().uuid().nullable().optional(),
    ufficio_id: z.string().uuid().nullable().optional(),
    descrizione: z.string().optional(),
    user_id: z.string().uuid().optional(),
    cliente_anagrafica_id: z.string().uuid().nullable().optional(),
    tipo_sinistro: z.string().optional().nullable(),
    tipo_sinistro_personalizzato: z.string().max(500).optional().nullable(),
    luogo_sinistro: z.string().optional(),
    data_evento: z.string().optional(),
    data_denuncia: z.string().optional(),
    data_apertura: z.string().optional(),
    numero_sinistro_compagnia: z.string().optional(),
    importo_riserva: z.number().nullable().optional(),
    controparte: z.string().optional().nullable(),
    targa_veicolo: z.string().optional().nullable(),
    dinamica: z.string().optional().nullable(),
    indirizzo_sinistro: z.string().optional().nullable(),
    citta_sinistro: z.string().optional().nullable(),
    cap_sinistro: z.string().optional().nullable(),
    provincia_sinistro: z.string().optional().nullable(),
    costo_preventivato: z.number().nullable().optional(),
    costo_effettivo: z.number().nullable().optional(),
    franchigia: z.number().nullable().optional(),
    importo_liquidato: z.number().nullable().optional(),
    stato_iniziale: z.enum(['in_valutazione','aperto']).optional(),
    priorita: z.string().optional(),
    note_interne: z.string().optional().nullable(),
  }),
  z.object({
    azione: z.literal("aggiorna"),
    sinistro_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    data_evento: z.string().optional().nullable(),
    data_denuncia: z.string().optional().nullable(),
    tipo_sinistro: z.string().optional().nullable(),
    tipo_sinistro_personalizzato: z.string().max(500).optional().nullable(),
    numero_sinistro_compagnia: z.string().optional().nullable(),
    descrizione: z.string().optional().nullable(),
    dinamica: z.string().optional().nullable(),
    luogo_sinistro: z.string().optional().nullable(),
    indirizzo_sinistro: z.string().optional().nullable(),
    citta_sinistro: z.string().optional().nullable(),
    cap_sinistro: z.string().optional().nullable(),
    provincia_sinistro: z.string().optional().nullable(),
    controparte: z.string().optional().nullable(),
    targa_veicolo: z.string().optional().nullable(),
    importo_riserva: z.number().nullable().optional(),
    costo_preventivato: z.number().nullable().optional(),
    costo_effettivo: z.number().nullable().optional(),
    franchigia: z.number().nullable().optional(),
    importo_liquidato: z.number().nullable().optional(),
    responsabile_id: z.string().uuid().nullable().optional(),
    liquidatore_id: z.string().uuid().nullable().optional(),
    note_interne: z.string().optional().nullable(),
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
        numero_sinistro, titolo_id, cliente_id, compagnia_id, responsabile_id, liquidatore_id,
        ufficio_id, descrizione, user_id,
        cliente_anagrafica_id, tipo_sinistro, tipo_sinistro_personalizzato, luogo_sinistro, data_evento,
        data_denuncia, data_apertura, numero_sinistro_compagnia, importo_riserva,
        controparte, targa_veicolo, dinamica, indirizzo_sinistro, citta_sinistro, cap_sinistro, provincia_sinistro,
        costo_preventivato, costo_effettivo, franchigia, importo_liquidato,
        stato_iniziale, priorita, note_interne,
      } = parsed.data;

      const numero = numero_sinistro
        ?? `SIN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const stato = stato_iniziale ?? "aperto";
      const oggi = new Date().toISOString().split("T")[0];
      const descrizioneTesto = descrizione ?? dinamica ?? null;

      const { data: sinistro, error } = await supabase.from("sinistri").insert({
        numero_sinistro: numero,
        titolo_id: titolo_id ?? null,
        cliente_id: cliente_id ?? null,
        compagnia_id: compagnia_id ?? null,
        responsabile_id: responsabile_id ?? null,
        liquidatore_id: liquidatore_id ?? null,
        ufficio_id: ufficio_id ?? null,
        descrizione: descrizioneTesto,
        dinamica: dinamica ?? descrizioneTesto,
        cliente_anagrafica_id: cliente_anagrafica_id ?? null,
        tipo_sinistro: tipo_sinistro ?? null,
        tipo_sinistro_personalizzato: tipo_sinistro_personalizzato?.trim() || null,
        luogo_sinistro: luogo_sinistro ?? null,
        indirizzo_sinistro: indirizzo_sinistro ?? null,
        citta_sinistro: citta_sinistro ?? null,
        cap_sinistro: cap_sinistro ?? null,
        provincia_sinistro: provincia_sinistro ?? null,
        controparte: controparte?.trim() || null,
        targa_veicolo: targa_veicolo?.trim() || null,
        data_evento: data_evento ?? null,
        data_denuncia: data_denuncia ?? oggi,
        data_apertura: data_apertura ?? oggi,
        numero_sinistro_compagnia: numero_sinistro_compagnia ?? null,
        importo_riserva: importo_riserva ?? null,
        costo_preventivato: costo_preventivato ?? null,
        costo_effettivo: costo_effettivo ?? null,
        franchigia: franchigia ?? null,
        importo_liquidato: importo_liquidato ?? null,
        note_interne: note_interne?.trim() || null,
        stato,
        aperto_da_cliente: stato === "in_valutazione",
      }).select().single();

      if (error) throw error;

      // Evento timeline apertura
      await supabase.from("sinistro_eventi").insert({
        sinistro_id: sinistro.id,
        tipo_evento: "apertura",
        data_scadenza: oggi,
        stato: "completato",
        note: `Apertura sinistro ${numero}${priorita ? ` · Priorità: ${priorita}` : ""}${note_interne ? ` · ${note_interne}` : ""}`,
      });

      // Log
      if (user_id) {
        await supabase.from("log_attivita").insert({
          user_id, azione: "creazione_sinistro", entita_tipo: "sinistro", entita_id: sinistro.id,
          ufficio_id: sinistro.ufficio_id ?? null,
          dettagli_json: { numero, tipo_sinistro, stato },
          severity: "info",
        });
      }

      return new Response(JSON.stringify({ success: true, sinistro }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (azione === "aggiorna") {
      const {
        sinistro_id, user_id, data_evento, data_denuncia, tipo_sinistro, tipo_sinistro_personalizzato,
        numero_sinistro_compagnia, descrizione, dinamica, luogo_sinistro, indirizzo_sinistro,
        citta_sinistro, cap_sinistro, provincia_sinistro, controparte, targa_veicolo,
        importo_riserva, costo_preventivato, costo_effettivo, franchigia, importo_liquidato,
        responsabile_id, liquidatore_id, note_interne,
      } = parsed.data;

      const { data: prev, error: prevErr } = await supabase
        .from("sinistri")
        .select("stato, ufficio_id, numero_sinistro")
        .eq("id", sinistro_id)
        .maybeSingle();
      if (prevErr) throw prevErr;
      if (!prev) {
        return new Response(JSON.stringify({ success: false, error: "Sinistro non trovato" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const descrizioneTesto = descrizione ?? dinamica ?? null;
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (data_evento !== undefined) updateData.data_evento = data_evento;
      if (data_denuncia !== undefined) updateData.data_denuncia = data_denuncia;
      if (tipo_sinistro !== undefined) updateData.tipo_sinistro = tipo_sinistro;
      if (tipo_sinistro_personalizzato !== undefined) {
        updateData.tipo_sinistro_personalizzato = tipo_sinistro_personalizzato?.trim() || null;
      }
      if (numero_sinistro_compagnia !== undefined) updateData.numero_sinistro_compagnia = numero_sinistro_compagnia;
      if (descrizione !== undefined || dinamica !== undefined) {
        updateData.descrizione = descrizioneTesto;
        updateData.dinamica = dinamica ?? descrizioneTesto;
      }
      if (luogo_sinistro !== undefined) updateData.luogo_sinistro = luogo_sinistro;
      if (indirizzo_sinistro !== undefined) updateData.indirizzo_sinistro = indirizzo_sinistro;
      if (citta_sinistro !== undefined) updateData.citta_sinistro = citta_sinistro;
      if (cap_sinistro !== undefined) updateData.cap_sinistro = cap_sinistro;
      if (provincia_sinistro !== undefined) updateData.provincia_sinistro = provincia_sinistro;
      if (controparte !== undefined) updateData.controparte = controparte?.trim() || null;
      if (targa_veicolo !== undefined) updateData.targa_veicolo = targa_veicolo?.trim() || null;
      if (importo_riserva !== undefined) updateData.importo_riserva = importo_riserva;
      if (costo_preventivato !== undefined) updateData.costo_preventivato = costo_preventivato;
      if (costo_effettivo !== undefined) updateData.costo_effettivo = costo_effettivo;
      if (franchigia !== undefined) updateData.franchigia = franchigia;
      if (importo_liquidato !== undefined) updateData.importo_liquidato = importo_liquidato;
      if (responsabile_id !== undefined) updateData.responsabile_id = responsabile_id;
      if (liquidatore_id !== undefined) updateData.liquidatore_id = liquidatore_id;
      if (note_interne !== undefined) updateData.note_interne = note_interne?.trim() || null;

      const { data: sinistro, error } = await supabase
        .from("sinistri")
        .update(updateData)
        .eq("id", sinistro_id)
        .select()
        .single();
      if (error) throw error;

      await supabase.from("sinistro_eventi").insert({
        sinistro_id,
        tipo_evento: "modifica_dati",
        stato: "completato",
        note: `Aggiornamento dati pratica${prev.numero_sinistro ? ` — ${prev.numero_sinistro}` : ""}`,
      });

      if (user_id) {
        await supabase.from("log_attivita").insert({
          user_id,
          azione: "modifica_sinistro",
          entita_tipo: "sinistro",
          entita_id: sinistro_id,
          ufficio_id: prev.ufficio_id ?? null,
          dettagli_json: { campi_aggiornati: Object.keys(updateData).filter((k) => k !== "updated_at") },
          severity: "info",
        });
      }

      return new Response(JSON.stringify({ success: true, sinistro }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
