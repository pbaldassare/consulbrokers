import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const OK_BODY = {
  ok: true,
  message: "Se l'indirizzo è registrato in CBnet, riceverai a breve un'email con il link per reimpostare la password.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const redirectTo = String(body?.redirect_to || "https://cbnet.it/reset-password").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: "Indirizzo email non valido" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.warn("[request-password-reset] generateLink:", linkErr?.message || "no action_link");
      return json(OK_BODY);
    }

    const actionLink = linkData.properties.action_link;
    const html = `
<p>Hai richiesto il recupero password per CBnet.</p>
<p>Clicca il pulsante qui sotto per scegliere una nuova password. Il link scade dopo un breve periodo.</p>
<p style="margin:24px 0">
  <a href="${actionLink}" style="display:inline-block;padding:12px 20px;background:#0e7490;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
    Reimposta password
  </a>
</p>
<p style="font-size:12px;color:#666">Se il pulsante non funziona, copia e incolla questo link nel browser:<br/>
<a href="${actionLink}">${actionLink}</a></p>
<p style="font-size:12px;color:#666">Se non hai richiesto tu il reset, ignora questa email.</p>`;

    const { data: sendRes, error: sendErr } = await admin.functions.invoke("send-email", {
      body: {
        to: email,
        subject: "Recupero password CBnet",
        html,
        apply_branding: true,
      },
    });

    const sendPayload = sendRes as { error?: string; id?: string } | null;
    if (sendErr || sendPayload?.error) {
      console.error("[request-password-reset] send-email:", sendErr?.message || sendPayload?.error);
      return json({ ok: false, error: "Invio email non riuscito. Riprova tra qualche minuto o contatta la sede." }, 502);
    }

    try {
      await admin.from("log_attivita").insert({
        azione: "richiesta_reset_password",
        entita_tipo: "auth",
        dettagli_json: { email, resend_id: sendPayload?.id ?? null },
        severity: "info",
      });
    } catch (e) {
      console.warn("[request-password-reset] log:", e);
    }

    return json(OK_BODY);
  } catch (e) {
    console.error("[request-password-reset]", e);
    return json({ ok: false, error: e instanceof Error ? e.message : "Errore interno" }, 500);
  }
});
