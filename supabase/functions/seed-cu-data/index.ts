import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Insert the single CU record from the Excel
  const { error } = await supabase.from('certificazioni_cu').insert({
    anno_fiscale: 2025,
    fornitore_id: '5f0f7ced-f0a6-4075-bb26-1a2d71d6f7bc',
    codice_fornitore: '000612',
    nome_fornitore: 'RACIOPPI ANNAMARIA',
    numero_primanota: '7076',
    data_primanota: '2025-11-30',
    numero_protocollo: '481',
    numero_documento: '600',
    tipo_reddito: 'EE',
    totale: 0,
    imponibile: 0,
    aliquota_ritenuta: 20,
    ritenuta: 0,
    non_soggetto: 0,
    altri_importi: 0,
    stato: 'bozza',
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: true, message: '1 CU record inserted' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
