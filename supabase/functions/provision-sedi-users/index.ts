import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEDI: Array<{ email: string; ufficio_id: string; nome: string; cognome: string }> = [
  { email: "catania@consulbrokers.it",       ufficio_id: "d2c47452-4bb2-4b3b-8a24-a1606357e909", nome: "Sede", cognome: "Catania" },
  { email: "milano@consulbrokers.it",        ufficio_id: "193e0821-4105-4ad6-a72e-0ebb6c116797", nome: "Sede", cognome: "Milano" },
  { email: "sandona@consulbrokers.it",       ufficio_id: "327e92f7-64f0-48b9-9e48-73611d8cb406", nome: "Sede", cognome: "San Donà di Piave" },
  { email: "campobasso@consulbrokers.it",    ufficio_id: "ebd881c6-cc52-4fbe-a423-2bf1f8498e5c", nome: "Sede", cognome: "Campobasso" },
  { email: "lurbani@consulbrokers.it",       ufficio_id: "d2d73996-a161-4a04-be84-260f6c514c23", nome: "Sede", cognome: "Bergamo" },
  { email: "segreteria@consulbrokers.it",    ufficio_id: "f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a", nome: "Sede", cognome: "Napoli" },
];

const PASSWORD = "Leone123!";

const PERMESSI = {
  titoli: true, sinistri: true, trattative: true, calendario: true,
  contabilita: true, rimesse: true, ec_clienti: true,
  report: true, estrazioni: true,
  documentale: true, template: true,
  provvigioni: true, anagrafiche: true,
} as Record<string, boolean>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.secret !== "provision-sedi-2026") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, srk, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const byEmail = new Map<string, string>();
    for (const u of existingList?.users ?? []) {
      if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
    }

    const results: any[] = [];

    for (const s of SEDI) {
      const emailLower = s.email.toLowerCase();
      let userId = byEmail.get(emailLower);
      let action: "created" | "updated" = "updated";

      if (!userId) {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: s.email, password: PASSWORD, email_confirm: true,
        });
        if (cErr || !created?.user) {
          results.push({ email: s.email, ok: false, error: cErr?.message }); continue;
        }
        userId = created.user.id;
        action = "created";
      } else {
        await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
      }

      const { error: pErr } = await admin.from("profiles").upsert({
        id: userId,
        nome: s.nome,
        cognome: s.cognome,
        email: s.email,
        ruolo: "ufficio",
        ufficio_id: s.ufficio_id,
        attivo: true,
        permessi_json: PERMESSI,
      }, { onConflict: "id" });

      if (pErr) { results.push({ email: s.email, ok: false, error: "profile: " + pErr.message }); continue; }

      // user_roles: cancella eventuali ruoli precedenti, poi inserisce 'ufficio'
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: "ufficio" });

      results.push({ email: s.email, ok: true, action, user_id: userId, ufficio_id: s.ufficio_id });
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
