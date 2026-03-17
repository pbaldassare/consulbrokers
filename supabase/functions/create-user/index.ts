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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey);
    const {
      data: { user: caller },
      error: authError,
    } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Accesso non autorizzato" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { nome, cognome, email, ruolo, ufficio_id, permessi_json, password } = await req.json();

    if (!email || !nome || !cognome || !ruolo) {
      return new Response(
        JSON.stringify({ error: "Campi obbligatori mancanti: nome, cognome, email, ruolo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPassword = password || "Temp123!";

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
    });

    if (createError) {
      return new Response(JSON.stringify({ error: `Errore creazione utente: ${createError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = newUser.user.id;

    const { error: profileError } = await adminClient.from("profiles").insert({
      id: newUserId,
      nome,
      cognome,
      email,
      ruolo,
      ufficio_id: ufficio_id || null,
      permessi_json: permessi_json || null,
      attivo: true,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: `Errore creazione profilo: ${profileError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: newUserId,
      role: ruolo,
    });

    if (roleError) {
      console.error("Error assigning role:", roleError.message);
    }

    const { error: logError } = await adminClient.from("log_attivita").insert({
      user_id: caller.id,
      azione: "creazione_utente",
      entita_tipo: "profile",
      entita_id: newUserId,
      dettagli_json: { nome, cognome, email, ruolo, ufficio_id },
    });

    if (logError) {
      console.error("Error logging activity:", logError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUserId,
        message: "Utente creato con successo.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: `Errore interno: ${err.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
