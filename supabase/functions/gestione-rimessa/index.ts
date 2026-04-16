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
    const { action, rimessa_id, compagnia_id, ufficio_id, created_by, data_da, data_a, titoli_ids, iban_utilizzato, importo_pagato, note } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "crea") {
      if (!compagnia_id) throw new Error("compagnia_id richiesto");

      let available: { id: string; importo_incassato: number }[] = [];

      if (titoli_ids && Array.isArray(titoli_ids) && titoli_ids.length > 0) {
        const { data: titoli, error: tErr } = await supabaseAdmin
          .from("titoli")
          .select("id, importo_incassato")
          .eq("stato", "incassato")
          .eq("compagnia_id", compagnia_id)
          .in("id", titoli_ids);
        if (tErr) throw tErr;

        const { data: usedTitoli } = await supabaseAdmin
          .from("rimessa_dettaglio")
          .select("titolo_id");
        const usedIds = new Set((usedTitoli || []).map((r: any) => r.titolo_id));
        available = (titoli || []).filter((t: any) => !usedIds.has(t.id));
      } else {
        let q = supabaseAdmin
          .from("titoli")
          .select("id, importo_incassato")
          .eq("stato", "incassato")
          .eq("compagnia_id", compagnia_id);

        if (data_da) q = q.gte("data_messa_cassa", data_da);
        if (data_a) q = q.lte("data_messa_cassa", data_a);

        const { data: titoli, error: tErr } = await q;
        if (tErr) throw tErr;

        const { data: usedTitoli } = await supabaseAdmin
          .from("rimessa_dettaglio")
          .select("titolo_id");
        const usedIds = new Set((usedTitoli || []).map((r: any) => r.titolo_id));
        available = (titoli || []).filter((t: any) => !usedIds.has(t.id));
      }

      if (available.length === 0) {
        return new Response(
          JSON.stringify({ error: "Nessun titolo incassato disponibile per questa compagnia nel periodo selezionato" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const totale = available.reduce((sum: number, t: any) => sum + (t.importo_incassato || 0), 0);
      const totalePagato = importo_pagato != null ? Number(importo_pagato) : totale;
      const now = new Date().toISOString().split("T")[0];

      const { data: rimessa, error: rErr } = await supabaseAdmin
        .from("rimessa_premi")
        .insert({
          compagnia_id,
          ufficio_id: ufficio_id || null,
          created_by: created_by || null,
          totale_importi: Math.round(totale * 100) / 100,
          importo_pagato: Math.round(totalePagato * 100) / 100,
          stato: "pagata",
          iban_utilizzato: iban_utilizzato || null,
          data_pagamento_rimessa: now,
          note: note || null,
        })
        .select()
        .single();
      if (rErr) throw rErr;

      const dettagli = available.map((t: any) => ({
        rimessa_id: rimessa.id,
        titolo_id: t.id,
        importo: t.importo_incassato || 0,
      }));
      const { error: dErr } = await supabaseAdmin.from("rimessa_dettaglio").insert(dettagli);
      if (dErr) throw dErr;

      if (created_by) {
        await supabaseAdmin.from("log_attivita").insert({
          user_id: created_by,
          azione: "pagamento_rimessa",
          entita_tipo: "rimessa_premi",
          entita_id: rimessa.id,
          dettagli_json: { compagnia_id, titoli_count: available.length, totale, importo_pagato: totalePagato, iban_utilizzato, data_da, data_a, titoli_ids: titoli_ids || null },
        });
      }

      return new Response(
        JSON.stringify({ rimessa, titoli_count: available.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "genera_xml") {
      if (!rimessa_id) throw new Error("rimessa_id richiesto");

      const { data: rimessa, error: rErr } = await supabaseAdmin
        .from("rimessa_premi")
        .select("*, compagnie(nome, codice)")
        .eq("id", rimessa_id)
        .single();
      if (rErr || !rimessa) throw new Error("Rimessa non trovata");

      const { data: dettagli } = await supabaseAdmin
        .from("rimessa_dettaglio")
        .select("*, titoli(numero_titolo, premio_lordo, importo_incassato, data_incasso, prodotti(nome_prodotto, codice_prodotto))")
        .eq("rimessa_id", rimessa_id);

      const now = new Date().toISOString();
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<RimessaPremi>\n`;
      xml += `  <Intestazione>\n`;
      xml += `    <IdRimessa>${rimessa.id}</IdRimessa>\n`;
      xml += `    <DataGenerazione>${now}</DataGenerazione>\n`;
      xml += `    <Compagnia>\n`;
      xml += `      <Nome>${rimessa.compagnie?.nome || ""}</Nome>\n`;
      xml += `      <Codice>${rimessa.compagnie?.codice || ""}</Codice>\n`;
      xml += `    </Compagnia>\n`;
      xml += `    <TotaleImporti>${rimessa.totale_importi}</TotaleImporti>\n`;
      xml += `  </Intestazione>\n`;
      xml += `  <Titoli>\n`;

      for (const d of (dettagli || [])) {
        const t = (d as any).titoli;
        xml += `    <Titolo>\n`;
        xml += `      <NumeroTitolo>${t?.numero_titolo || ""}</NumeroTitolo>\n`;
        xml += `      <Prodotto>${t?.prodotti?.nome_prodotto || ""}</Prodotto>\n`;
        xml += `      <CodiceProdotto>${t?.prodotti?.codice_prodotto || ""}</CodiceProdotto>\n`;
        xml += `      <PremioLordo>${t?.premio_lordo || 0}</PremioLordo>\n`;
        xml += `      <ImportoIncassato>${t?.importo_incassato || 0}</ImportoIncassato>\n`;
        xml += `      <DataIncasso>${t?.data_incasso || ""}</DataIncasso>\n`;
        xml += `      <ImportoRimessa>${d.importo || 0}</ImportoRimessa>\n`;
        xml += `    </Titolo>\n`;
      }

      xml += `  </Titoli>\n`;
      xml += `</RimessaPremi>`;

      await supabaseAdmin
        .from("rimessa_premi")
        .update({ xml_output: xml, stato: "pronta", updated_at: now })
        .eq("id", rimessa_id);

      if (created_by) {
        await supabaseAdmin.from("log_attivita").insert({
          user_id: created_by,
          azione: "generazione_xml",
          entita_tipo: "rimessa_premi",
          entita_id: rimessa_id,
        });
      }

      return new Response(
        JSON.stringify({ xml, stato: "pronta" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Azione non valida. Usa 'crea' o 'genera_xml'");
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
