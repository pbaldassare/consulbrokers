// "Visualizza come": solo admin@consul.it ottiene un accesso temporaneo come un altro utente,
// per vedere CBnet esattamente come lo vede lui (RLS compresa). Ogni accesso è registrato in log_attivita.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ROOT_ADMIN_EMAIL = "admin@consul.it";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Non autenticato" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Chi chiama: verificato dal token, non da quello che dice la pagina
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller) return json({ error: "Non autenticato" }, 401);
    if ((caller.email || "").trim().toLowerCase() !== ROOT_ADMIN_EMAIL) {
      return json({ error: "Solo admin@consul.it può usare Visualizza come" }, 403);
    }

    const { user_id } = await req.json().catch(() => ({}));
    if (!user_id || typeof user_id !== "string") return json({ error: "Utente non indicato" }, 400);
    if (user_id === caller.id) return json({ error: "È già il tuo account" }, 400);

    const { data: target, error: tErr } = await admin.auth.admin.getUserById(user_id);
    if (tErr || !target?.user?.email) return json({ error: "Utente non trovato o senza email" }, 404);

    // Link di accesso monouso: il browser lo scambia subito con una sessione (nessuna email inviata)
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: target.user.email });
    if (lErr || !link?.properties?.hashed_token) return json({ error: lErr?.message || "Accesso non generato" }, 500);

    await admin.from("log_attivita").insert({
      user_id: caller.id,
      azione: "visualizza_come",
      entita_tipo: "utente",
      entita_id: user_id,
      dettagli_json: { email: target.user.email },
      severity: "warning",
    });

    return json({ token_hash: link.properties.hashed_token, email: target.user.email });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Errore" }, 500);
  }
});
