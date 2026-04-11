import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Validate user
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { bando_id, pdf_url } = await req.json()

    if (!bando_id || !pdf_url) {
      return new Response(JSON.stringify({ error: 'bando_id e pdf_url sono obbligatori' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch the bando to get scheda_id
    const { data: bando, error: bandoError } = await supabase
      .from('bandi_pubblici')
      .select('scheda_id')
      .eq('id', bando_id)
      .single()

    if (bandoError || !bando) {
      return new Response(JSON.stringify({ error: 'Bando non trovato' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Download PDF from URL
    console.log(`Downloading PDF from: ${pdf_url}`)
    const pdfRes = await fetch(pdf_url)
    if (!pdfRes.ok) {
      return new Response(JSON.stringify({ error: `Impossibile scaricare il PDF: ${pdfRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const pdfBuffer = await pdfRes.arrayBuffer()
    const fileName = `bandi/${bando.scheda_id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('documenti_generali')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(JSON.stringify({ error: `Errore upload: ${uploadError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update bando record
    const { error: updateError } = await supabase
      .from('bandi_pubblici')
      .update({ pdf_path: fileName, pdf_url })
      .eq('id', bando_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(JSON.stringify({ error: `Errore aggiornamento: ${updateError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, pdf_path: fileName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error in scarica-bando-pdf:', error)
    return new Response(JSON.stringify({ error: error.message || 'Errore interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
