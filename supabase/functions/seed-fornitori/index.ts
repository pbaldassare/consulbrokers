import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: fornitori } = await req.json();

  let inserted = 0;
  const batchSize = 100;
  const errors: string[] = [];

  for (let i = 0; i < fornitori.length; i += batchSize) {
    const batch = fornitori.slice(i, i + batchSize);
    const { error } = await supabase.from("fornitori").upsert(batch, { onConflict: "codice" });
    if (error) {
      errors.push(`Batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  return new Response(JSON.stringify({ inserted, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
