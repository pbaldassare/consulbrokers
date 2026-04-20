import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendDomain {
  id: string;
  name: string;
  status: string; // "verified" | "pending" | "not_started" | "failure" | "temporary_failure"
  created_at: string;
  region: string;
  records?: Array<{
    record: string;
    name: string;
    type: string;
    ttl: string | number;
    status: string;
    value: string;
    priority?: number;
  }>;
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

    // 1. List all domains visible to this API key
    const listRes = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });

    const listData = await listRes.json();

    if (!listRes.ok) {
      console.error("Resend /domains error:", listRes.status, listData);
      return new Response(
        JSON.stringify({
          error: "Impossibile leggere domini da Resend",
          status: listRes.status,
          details: listData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const domains: ResendDomain[] = listData?.data || [];

    // 2. For each domain, fetch detailed records
    const detailed = await Promise.all(
      domains.map(async (d) => {
        try {
          const r = await fetch(`https://api.resend.com/domains/${d.id}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
          });
          const dd = await r.json();
          return r.ok ? dd : { ...d, _detail_error: dd };
        } catch (e: any) {
          return { ...d, _detail_error: e?.message };
        }
      }),
    );

    return new Response(
      JSON.stringify({
        success: true,
        count: detailed.length,
        domains: detailed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("check-resend-domain error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Errore interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
