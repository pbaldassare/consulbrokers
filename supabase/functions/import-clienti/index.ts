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
    const { action, records, gruppi_finanziari, ufficio, clienti, codici_commerciali } = await req.json();

    if (action === "setup") {
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
          if (error) console.error(`GF error for ${nome}:`, error.message);
          else gf_map[nome] = data.id;
        }
      }
      return new Response(JSON.stringify({ success: true, ufficio_id, gf_map }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import") {
      if (!records) throw new Error("Missing records");
      let inserted = 0;
      let errors = 0;
      const batchSize = 50;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await supabase.from("clienti").insert(batch);
        if (error) { errors += batch.length; console.error(`Batch ${i} error:`, error.message); }
        else inserted += batch.length;
      }
      return new Response(JSON.stringify({ success: true, inserted, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "replace_all") {
      if (!clienti) throw new Error("Missing clienti");
      const ufficio_id = "f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a";
      const log: string[] = [];

      // Step 1: Resolve gruppi_finanziari — create missing ones
      const { data: existingGF } = await supabase.from("gruppi_finanziari").select("id, nome");
      const gfMap: Record<string, string> = {};
      for (const gf of (existingGF || [])) {
        gfMap[gf.nome.trim().toUpperCase()] = gf.id;
      }
      // Collect all GF names from clienti
      const neededGF = new Set<string>();
      for (const c of clienti) {
        if (c.gru_fin && c.gru_fin.trim()) neededGF.add(c.gru_fin.trim());
      }
      let gfCreated = 0;
      for (const nome of neededGF) {
        if (!gfMap[nome.toUpperCase()]) {
          const codice = `GF${String(Object.keys(gfMap).length + 1).padStart(3, "0")}`;
          const { data, error } = await supabase
            .from("gruppi_finanziari")
            .insert({ codice, nome, descrizione: nome, attivo: true })
            .select("id")
            .single();
          if (!error && data) { gfMap[nome.toUpperCase()] = data.id; gfCreated++; }
          else console.error(`GF create error for ${nome}:`, error?.message);
        }
      }
      log.push(`Gruppi finanziari creati: ${gfCreated}`);

      // Step 2: Resolve Specialist -> profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, cognome")
        .in("ruolo", ["backoffice", "admin", "operatore"]);
      const profileMap: Record<string, string> = {};
      for (const p of (profiles || [])) {
        const key = `${(p.cognome || "").trim()} ${(p.nome || "").trim()}`.toUpperCase().trim();
        if (key) profileMap[key] = p.id;
      }

      // Step 3: Resolve Prod -> anagrafiche_professionali
      const { data: anagrafiche } = await supabase
        .from("anagrafiche_professionali")
        .select("id, cognome, nome, ragione_sociale, codice");
      const anagMap: Record<string, string> = {};
      for (const a of (anagrafiche || [])) {
        const key1 = `${(a.cognome || "").trim()} ${(a.nome || "").trim()}`.toUpperCase().trim();
        const key2 = (a.ragione_sociale || "").trim().toUpperCase();
        if (key1) anagMap[key1] = a.id;
        if (key2) anagMap[key2] = a.id;
      }

      // Step 4: Delete existing data
      const { error: delCC } = await supabase.from("codici_commerciali_cliente").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delCC) log.push(`Errore delete codici_commerciali: ${delCC.message}`);
      
      const { error: delRel } = await supabase.from("clienti_relazioni").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delRel) log.push(`Errore delete relazioni: ${delRel.message}`);

      const { error: delCli, count: delCount } = await supabase.from("clienti").delete({ count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000");
      if (delCli) log.push(`Errore delete clienti: ${delCli.message}`);
      else log.push(`Clienti eliminati: ${delCount}`);

      // Step 5: Insert clienti in batches
      const batchSize = 50;
      let insertedClienti = 0;
      let errorClienti = 0;
      const insertedIds: { codice: string; id: string }[] = [];

      for (let i = 0; i < clienti.length; i += batchSize) {
        const batch = clienti.slice(i, i + batchSize).map((c: any) => {
          const isAzienda = c.tipo === "G";
          const gfId = c.gru_fin ? gfMap[(c.gru_fin).trim().toUpperCase()] || null : null;

          const record: any = {
            codice_ricerca: c.codice || null,
            tipo_cliente: isAzienda ? "azienda" : "privato",
            ufficio_id: ufficio_id,
            attivo: c.stato !== "non attivo",
            stato_cliente: c.stato || "Attivo",
            telefono: c.tel || null,
            email: c.email || null,
            attenzione_di: c.atten_di || null,
            codice_fiscale: (!isAzienda && c.cf) ? c.cf : null,
            codice_fiscale_azienda: (isAzienda && c.cf) ? c.cf : null,
            partita_iva: c.piva || null,
            gruppo_statistico: c.gru_stat || null,
            gruppo_finanziario_id: gfId,
            indotto: c.indotto || null,
            zona: c.zona || null,
            attivita: c.attivita || null,
            spec_sx_danni: c.specialist_sx || null,
            fatturato: c.fatturato || null,
            fascia_dipendenti: c.dipendenti || null,
          };

          if (isAzienda) {
            record.ragione_sociale = c.nome || null;
            record.indirizzo_sede = c.indirizzo || null;
            record.cap_sede = c.cap || null;
            record.citta_sede = c.comune || null;
            record.provincia_sede = c.prov || null;
          } else {
            // Split "COGNOME NOME" 
            const parts = (c.nome || "").trim().split(/\s+/);
            record.cognome = parts[0] || null;
            record.nome = parts.slice(1).join(" ") || null;
            record.indirizzo_residenza = c.indirizzo || null;
            record.cap_residenza = c.cap || null;
            record.citta_residenza = c.comune || null;
            record.provincia_residenza = c.prov || null;
          }

          return record;
        });

        const { data: inserted, error } = await supabase.from("clienti").insert(batch).select("id, codice_ricerca");
        if (error) {
          errorClienti += batch.length;
          console.error(`Batch ${i} error:`, error.message);
        } else {
          insertedClienti += (inserted || []).length;
          for (const ins of (inserted || [])) {
            insertedIds.push({ codice: ins.codice_ricerca, id: ins.id });
          }
        }
      }
      log.push(`Clienti inseriti: ${insertedClienti}, errori: ${errorClienti}`);

      // Step 6: Create codici_commerciali_cliente
      const idMap: Record<string, string> = {};
      for (const entry of insertedIds) {
        if (entry.codice) idMap[entry.codice] = entry.id;
      }

      let ccInserted = 0;
      let ccErrors = 0;
      const ccBatch: any[] = [];

      for (const c of (codici_commerciali || [])) {
        const clienteId = idMap[c.codice];
        if (!clienteId) continue;

        // Specialist -> profiles
        if (c.specialist) {
          const specKey = c.specialist.trim().toUpperCase();
          const profiloId = profileMap[specKey] || null;
          ccBatch.push({
            cliente_id: clienteId,
            ruolo: "Backoffice",
            profilo_id: profiloId,
            societa_brand: c.brand || "Consulbrokers",
            filiale: c.unit || null,
            data_acquisito: c.acquisito || null,
            scadenza_mandato: c.scad_mandato || null,
            contatto: c.specialist,
          });
        }

        // Prod1 -> anagrafiche
        if (c.prod1) {
          const prodKey = c.prod1.trim().toUpperCase();
          const profiloId = anagMap[prodKey] || null;
          ccBatch.push({
            cliente_id: clienteId,
            ruolo: "corrispondente_1",
            profilo_id: profiloId,
            societa_brand: c.brand || "Consulbrokers",
            contatto: c.prod1,
          });
        }

        if (c.prod2) {
          const prodKey = c.prod2.trim().toUpperCase();
          const profiloId = anagMap[prodKey] || null;
          ccBatch.push({
            cliente_id: clienteId,
            ruolo: "corrispondente_2",
            profilo_id: profiloId,
            societa_brand: c.brand || "Consulbrokers",
            contatto: c.prod2,
          });
        }

        if (c.prod3) {
          const prodKey = c.prod3.trim().toUpperCase();
          const profiloId = anagMap[prodKey] || null;
          ccBatch.push({
            cliente_id: clienteId,
            ruolo: "corrispondente_3",
            profilo_id: profiloId,
            societa_brand: c.brand || "Consulbrokers",
            contatto: c.prod3,
          });
        }
      }

      // Insert codici_commerciali in batches
      for (let i = 0; i < ccBatch.length; i += batchSize) {
        const batch = ccBatch.slice(i, i + batchSize);
        const { error } = await supabase.from("codici_commerciali_cliente").insert(batch);
        if (error) {
          ccErrors += batch.length;
          console.error(`CC Batch ${i} error:`, error.message);
        } else {
          ccInserted += batch.length;
        }
      }
      log.push(`Codici commerciali inseriti: ${ccInserted}, errori: ${ccErrors}`);

      return new Response(
        JSON.stringify({
          success: true,
          clienti_inseriti: insertedClienti,
          clienti_errori: errorClienti,
          cc_inseriti: ccInserted,
          cc_errori: ccErrors,
          gf_creati: gfCreated,
          log,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete_fake") {
      const keepUfficio = "f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a";
      const tables = ["clienti_relazioni", "codici_commerciali_cliente"];
      for (const t of tables) {
        const { error } = await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) console.error(`Delete ${t}:`, error.message);
      }
      const { error: delErr, count } = await supabase
        .from("clienti").delete({ count: "exact" }).neq("ufficio_id", keepUfficio);
      const { error: delErr2 } = await supabase
        .from("clienti").delete().is("ufficio_id", null);
      return new Response(
        JSON.stringify({ success: !delErr, deleted: count, error: delErr?.message }),
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
