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

    // Fetch titolo with all needed fields
    const { data: titolo, error: tErr } = await supabaseAdmin
      .from("titoli")
      .select("id, stato, provvigioni_quietanza, percentuale_commerciale, commerciale_id, produttore_id, prodotto_id, ufficio_id, premio_lordo, importo_incassato, anagrafica_commerciale_id, produttore_nome")
      .eq("id", titolo_id)
      .single();
    if (tErr || !titolo) throw new Error("Titolo non trovato");
    if (titolo.stato !== "incassato") {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "titolo_non_incassato",
          message: "Le provvigioni vengono calcolate solo dopo l'incasso del titolo.",
          provvigioni: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete old provvigioni for this titolo
    await supabaseAdmin.from("provvigioni_generate").delete().eq("titolo_id", titolo_id);

    // Lookup admin (Consulbrokers SPA) anagrafica id from settings
    let adminAnagraficaId: string | null = null;
    {
      const { data: setting } = await supabaseAdmin
        .from("impostazioni_sistema")
        .select("valore_json")
        .eq("chiave", "admin_anagrafica_id")
        .maybeSingle();
      adminAnagraficaId = (setting?.valore_json as any)?.anagrafica_id ?? null;
    }

    const provvQuietanza = titolo.provvigioni_quietanza;

    // === PRIMARY PATH: use provvigioni_quietanza from titolo ===
    if (provvQuietanza != null && provvQuietanza > 0) {
      const percComm = titolo.percentuale_commerciale ?? 100;
      const hasCommerciale = titolo.anagrafica_commerciale_id != null || titolo.commerciale_id != null;
      const isAdminOnly = !hasCommerciale || percComm >= 100;

      // Special case: commerciale IS the admin (Consulbrokers SPA) → split is statistical only
      const commercialeIsAdmin =
        adminAnagraficaId != null &&
        titolo.anagrafica_commerciale_id != null &&
        titolo.anagrafica_commerciale_id === adminAnagraficaId;

      const commercialeUserId = titolo.commerciale_id;
      const rows: any[] = [];
      const totale = Math.round(provvQuietanza * 100) / 100;

      if (!isAdminOnly && percComm > 0) {
        const importoComm = Math.round((provvQuietanza * percComm) / 100 * 100) / 100;
        const importoAdmin = Math.round((provvQuietanza - importoComm) * 100) / 100;

        // Commerciale row — solo_statistico=true if commerciale == admin (would double-count)
        rows.push({
          titolo_id,
          user_id: commercialeUserId || null,
          percentuale: percComm,
          importo_provvigione: importoComm,
          tipo_destinatario: "commerciale",
          solo_statistico: commercialeIsAdmin,
        });

        // Admin (Consulbrokers SPA) row — gets the residual quota.
        // If commerciale == admin, this row carries the FULL economic value (totale)
        // and the commerciale row above is only statistical.
        if (commercialeIsAdmin) {
          rows.push({
            titolo_id,
            user_id: null,
            percentuale: 100,
            importo_provvigione: totale,
            tipo_destinatario: "admin",
            solo_statistico: false,
          });
        } else if (importoAdmin > 0) {
          rows.push({
            titolo_id,
            user_id: null,
            percentuale: 100 - percComm,
            importo_provvigione: importoAdmin,
            tipo_destinatario: "admin",
            solo_statistico: false,
          });
        }
      } else {
        // No commerciale or 100% to admin — everything goes to admin
        rows.push({
          titolo_id,
          user_id: null,
          percentuale: 100,
          importo_provvigione: totale,
          tipo_destinatario: "admin",
          solo_statistico: false,
        });
      }

      const { data: inserted, error: iErr } = await supabaseAdmin
        .from("provvigioni_generate")
        .insert(rows)
        .select();
      if (iErr) throw iErr;

      return new Response(
        JSON.stringify({ message: `Provvigioni generate: ${inserted.length}`, provvigioni: inserted }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === FALLBACK PATH: use matrice_provvigioni (legacy) ===
    let produttoreRuolo: string | null = null;
    if (titolo.produttore_id) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("ruolo")
        .eq("id", titolo.produttore_id)
        .single();
      produttoreRuolo = prof?.ruolo ?? null;
    }

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

    let bestRule = null;
    if (titolo.produttore_id) {
      bestRule = regole.find((r) => r.user_id === titolo.produttore_id) ?? null;
    }
    if (!bestRule && titolo.ufficio_id) {
      bestRule = regole.find((r) => !r.user_id && r.ufficio_id === titolo.ufficio_id) ?? null;
    }
    if (!bestRule && produttoreRuolo) {
      bestRule = regole.find((r) => !r.user_id && !r.ufficio_id && r.ruolo === produttoreRuolo) ?? null;
    }
    if (!bestRule) {
      bestRule = regole.find((r) => !r.user_id && !r.ufficio_id && !r.ruolo) ?? null;
    }

    if (!bestRule) {
      return new Response(
        JSON.stringify({ message: "Nessuna regola applicabile", provvigioni: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const base = titolo.importo_incassato ?? titolo.premio_lordo ?? 0;
    let importo = 0;
    if (bestRule.tipo_calcolo === "percentuale") {
      importo = (base * bestRule.percentuale_provvigione) / 100;
    } else {
      importo = bestRule.percentuale_provvigione;
    }

    const { data: prov, error: pErr } = await supabaseAdmin
      .from("provvigioni_generate")
      .insert({
        titolo_id,
        user_id: titolo.produttore_id,
        percentuale: bestRule.percentuale_provvigione,
        importo_provvigione: Math.round(importo * 100) / 100,
        tipo_destinatario: titolo.produttore_id ? "commerciale" : "consul",
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
