import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const specialists = [
    {
      nome: "GAETANO",
      cognome: "GUARRACINO",
      email: "guarracino.gaetano@consulbrokers.local",
      ufficio_id: "d2c47452-4bb2-4b3b-8a24-a1606357e909", // SEDE CATANIA
      titoli_match: "GUARRACINO GAETANO",
    },
    {
      nome: "Gestione",
      cognome: "Milano",
      email: "gestione.milano@consulbrokers.local",
      ufficio_id: "193e0821-4105-4ad6-a72e-0ebb6c116797", // SEDE MILANO
      titoli_match: "Gestione Milano",
    },
  ];

  const results: any[] = [];

  for (const s of specialists) {
    // Check existing
    const { data: existing } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", s.email)
      .maybeSingle();

    let userId: string;
    if (existing) {
      userId = existing.id;
      results.push({ email: s.email, status: "already_exists", user_id: userId });
    } else {
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: s.email,
        password: "Leone123!",
        email_confirm: true,
      });
      if (createErr) {
        results.push({ email: s.email, status: "error", error: createErr.message });
        continue;
      }
      userId = newUser.user!.id;

      const { error: profErr } = await adminClient.from("profiles").insert({
        id: userId,
        nome: s.nome,
        cognome: s.cognome,
        email: s.email,
        ruolo: "backoffice",
        ufficio_id: s.ufficio_id,
        attivo: true,
      });
      if (profErr) {
        results.push({ email: s.email, status: "profile_error", error: profErr.message });
        continue;
      }

      await adminClient.from("user_roles").insert({ user_id: userId, role: "backoffice" });
      results.push({ email: s.email, status: "created", user_id: userId });
    }

    // Update titoli specialist text -> uuid for April 2026
    const { data: updated, error: updErr } = await adminClient
      .from("titoli")
      .update({ specialist: userId })
      .gte("data_scadenza", "2026-04-01")
      .lte("data_scadenza", "2026-04-30")
      .eq("specialist", s.titoli_match)
      .select("id");

    results.push({
      email: s.email,
      titoli_updated: updated?.length || 0,
      update_error: updErr?.message,
    });
  }

  return new Response(JSON.stringify({ success: true, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
