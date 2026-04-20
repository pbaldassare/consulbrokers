import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  reply_to?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

function validate(payload: any): { ok: true; data: EmailPayload } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid body" };
  const { to, subject, html, from, reply_to, cc, bcc } = payload;

  const isStr = (v: unknown) => typeof v === "string" && v.length > 0;
  const isStrOrArr = (v: unknown) =>
    isStr(v) || (Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0));

  if (!isStrOrArr(to)) return { ok: false, error: "`to` must be string or string[]" };
  if (!isStr(subject)) return { ok: false, error: "`subject` is required" };
  if (!isStr(html)) return { ok: false, error: "`html` is required" };
  if (from !== undefined && !isStr(from)) return { ok: false, error: "`from` must be string" };
  if (reply_to !== undefined && !isStr(reply_to)) return { ok: false, error: "`reply_to` must be string" };
  if (cc !== undefined && !isStrOrArr(cc)) return { ok: false, error: "`cc` must be string or string[]" };
  if (bcc !== undefined && !isStrOrArr(bcc)) return { ok: false, error: "`bcc` must be string or string[]" };

  return { ok: true, data: { to, subject, html, from, reply_to, cc, bcc } };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY non configurata" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = validate(body);
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, html, from, reply_to, cc, bcc } = parsed.data;

    const payload: Record<string, unknown> = {
      from: from || "ConsulNet <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };
    if (reply_to) payload.reply_to = reply_to;
    if (cc) payload.cc = Array.isArray(cc) ? cc : [cc];
    if (bcc) payload.bcc = Array.isArray(bcc) ? bcc : [bcc];

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", res.status, data);
      return new Response(
        JSON.stringify({ error: "Invio email fallito", details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, id: data.id, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Errore interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
