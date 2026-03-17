import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const USERS = [
  { nome: "Admin", cognome: "Consul", email: "admin@consul.ite", ruolo: "admin" },
  { nome: "Ufficio", cognome: "Consul", email: "ufficio@consul.ite", ruolo: "ufficio" },
  { nome: "Produttore", cognome: "Consul", email: "produttore@consul.ite", ruolo: "produttore" },
  { nome: "Contabilita", cognome: "Consul", email: "contabilita@consul.ite", ruolo: "contabilita" },
  { nome: "CFO", cognome: "Consul", email: "cfo@consul.ite", ruolo: "cfo" },
  { nome: "Cliente", cognome: "Consul", email: "cliente@consul.ite", ruolo: "cliente" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const password = "Leone123!";
    const results: any[] = [];

    for (const u of USERS) {
      // Check if user already exists
      const { data: existingProfiles } = await adminClient
        .from("profiles")
        .select("id")
        .eq("email", u.email)
        .limit(1);

      if (existingProfiles && existingProfiles.length > 0) {
        results.push({ email: u.email, status: "already_exists" });
        continue;
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: u.email,
        password,
        email_confirm: true,
      });

      if (createError) {
        results.push({ email: u.email, status: "error", message: createError.message });
        continue;
      }

      const userId = newUser.user.id;

      const { error: profileError } = await adminClient.from("profiles").insert({
        id: userId,
        nome: u.nome,
        cognome: u.cognome,
        email: u.email,
        ruolo: u.ruolo,
        attivo: true,
      });

      if (profileError) {
        await adminClient.auth.admin.deleteUser(userId);
        results.push({ email: u.email, status: "error", message: profileError.message });
        continue;
      }

      const { error: roleError } = await adminClient.from("user_roles").insert({
        user_id: userId,
        role: u.ruolo,
      });

      if (roleError) {
        console.error(`Role error for ${u.email}:`, roleError.message);
      }

      results.push({ email: u.email, status: "created", user_id: userId });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
