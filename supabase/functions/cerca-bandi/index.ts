const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const BROWSER_USE_API_KEY = Deno.env.get('BROWSER_USE_API_KEY')!;
const MONDOAPPALTI_USER = Deno.env.get('MONDOAPPALTI_USER')!;
const MONDOAPPALTI_PASSWORD = Deno.env.get('MONDOAPPALTI_PASSWORD')!;
const API_BASE = 'https://api.browser-use.com/api/v3';
const START_RETRY_AFTER_SECONDS = 15;

const REGION_MAP: Record<string, string> = {
  "Emilia-Romagna": "Emilia Romagna",
  "Friuli Venezia Giulia": "Friuli Venezia Giulia",
  "Trentino-Alto Adige": "Trentino Alto Adige",
  "Valle d'Aosta": "Valle d'Aosta",
};

function normalizeRegione(uiName: string): string {
  return REGION_MAP[uiName] || uiName;
}

interface StartRequest {
  action: 'start';
  regioni?: string[];
  importoMin?: string;
  importoMax?: string;
  dataDa?: string;
  dataA?: string;
}

interface StatusRequest {
  action: 'status';
  sessionIds: string[];
}

interface CreateSessionResult {
  sessionId?: string;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
  error?: string;
}

function buildTaskPrompt(regioni: string[], filters: { importoMin?: string; importoMax?: string; dataDa?: string; dataA?: string }): string {
  const parts: string[] = [];

  parts.push(`Vai sul sito https://www.mondoappalti.it e effettua il login con username "${MONDOAPPALTI_USER}" e password "${MONDOAPPALTI_PASSWORD}".`);
  parts.push(`Dopo il login, vai nella sezione di ricerca gare/bandi.`);
  parts.push(`Cerca con la parola chiave "brokeraggio assicurativo".`);

  if (regioni.length > 0) {
    parts.push(`Filtra per le seguenti regioni: ${regioni.join(', ')}.`);
  }

  if (filters.dataDa) {
    parts.push(`Filtra i bandi pubblicati dal ${filters.dataDa}.`);
  }
  if (filters.dataA) {
    parts.push(`Filtra i bandi pubblicati fino al ${filters.dataA}.`);
  }
  if (filters.importoMin) {
    parts.push(`Con importo minimo di €${filters.importoMin}.`);
  }
  if (filters.importoMax) {
    parts.push(`Con importo massimo di €${filters.importoMax}.`);
  }

  parts.push(`Se non trovi risultati con "brokeraggio assicurativo", prova anche con "broker assicurativo" o "servizi di intermediazione assicurativa".`);

  parts.push(`Scorri tutti i risultati visibili (massimo 20). Per ogni bando/gara trovata, estrai i dati e restituiscili in formato JSON come array di oggetti con ESATTAMENTE questi campi:
- "scheda_id": codice o numero della scheda/gara (stringa)
- "tipologia": tipologia della gara (es. "Servizi", "Forniture")
- "oggetto": oggetto o titolo del bando (stringa)
- "stazione_appaltante": nome dell'ente/stazione appaltante
- "localita": luogo (città o provincia)
- "regione": regione
- "importo": importo in euro come numero (senza simboli, senza punti delle migliaia; usa il punto come separatore decimale). Se il valore è "150.739,73 €" scrivi 150739.73. Se non disponibile scrivi null.
- "scadenza": data di scadenza nel formato "dd/MM/yyyy" (null se non disponibile)
- "cig": codice CIG se presente (null se non disponibile)
- "link": URL diretto alla pagina del bando

Rispondi SOLO con il JSON array, senza testo prima o dopo. Se non trovi risultati rispondi con [].`);

  return parts.join(' ');
}

async function createSession(task: string): Promise<CreateSessionResult> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'X-Browser-Use-API-Key': BROWSER_USE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task,
      model: 'gemini-3-flash',
    }),
  });

  if (res.status === 429) {
    const err = await res.text();
    const retryAfterHeader = Number(res.headers.get('retry-after') ?? '');
    return {
      rateLimited: true,
      retryAfterSeconds: Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader
        : START_RETRY_AFTER_SECONDS,
      error: err,
    };
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create session: ${res.status} ${err}`);
  }

  const data = await res.json();
  return { sessionId: data.id };
}

async function checkSession(sessionId: string): Promise<{ status: string; output: string | null }> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    headers: { 'X-Browser-Use-API-Key': BROWSER_USE_API_KEY },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to check session: ${res.status} ${err}`);
  }

  const session = await res.json();
  // Browser Use API may return the result in different fields depending on version
  const output = session.output || session.result || session.final_result || null;
  console.log(`Session ${sessionId} status=${session.status}, output length=${output ? String(output).length : 0}, raw keys=${Object.keys(session).join(',')}`);
  if (output) {
    console.log(`Session ${sessionId} raw output (first 500 chars):`, String(output).substring(0, 500));
  }
  return { status: session.status, output: typeof output === 'string' ? output : output ? JSON.stringify(output) : null };
}

function parseImportoItaliano(val: any): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[€\s]/g, '').trim();
  if (!s || s === 'N/A' || s === '-') return null;
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseOutput(output: string | null): any[] {
  if (!output) return [];

  // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  let cleaned = output.trim();
  const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) {
    cleaned = mdMatch[1].trim();
  }

  // Try direct parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.bandi && Array.isArray(parsed.bandi)) return parsed.bandi;
    if (parsed.results && Array.isArray(parsed.results)) return parsed.results;
    return [];
  } catch {
    // Fallback: find the first JSON array in the text
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        console.warn('parseOutput: found array pattern but failed to parse');
        return [];
      }
    }
    console.warn('parseOutput: no JSON array found in output');
    return [];
  }
}

function mapBando(b: any, i: number) {
  return {
    id: b.scheda_id || b.id || `bando-${Date.now()}-${i}`,
    titolo: b.oggetto || b.titolo || b.tipologia || 'Titolo non disponibile',
    ente: b.stazione_appaltante || b.ente || 'Ente non specificato',
    importo: parseImportoItaliano(b.importo),
    scadenza: b.scadenza || null,
    stato: b.stato || 'aperto',
    dataPublicazione: b.dataPublicazione || b.dataPubblicazione || '',
    link: b.link || null,
    categoria: b.tipologia || b.categoria || null,
    scheda_id: b.scheda_id || null,
    cig: b.cig || null,
    localita: b.localita || null,
    regione: b.regione || null,
  };
}

function batchRegioni(regioni: string[]): string[][] {
  return [regioni];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!BROWSER_USE_API_KEY) {
      throw new Error('BROWSER_USE_API_KEY not configured');
    }

    const body = await req.json();
    const action = body.action || 'start';

    if (action === 'status') {
      const { sessionIds } = body as StatusRequest;
      if (!sessionIds || !Array.isArray(sessionIds)) {
        return new Response(JSON.stringify({ error: 'sessionIds required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results: { sessionId: string; status: string; bandi: any[] }[] = [];

      for (const sid of sessionIds) {
        try {
          const { status, output } = await checkSession(sid);

          let bandi: any[] = [];
          if (status === 'idle' || status === 'stopped') {
            const raw = parseOutput(output);
            bandi = raw.map(mapBando);
          }

          results.push({ sessionId: sid, status, bandi });
        } catch {
          results.push({ sessionId: sid, status: 'error', bandi: [] });
        }
      }

      const allDone = results.every((r) => ['idle', 'stopped', 'error', 'timed_out'].includes(r.status));
      const allBandi = results.flatMap((r) => r.bandi);
      const seen = new Set<string>();
      const dedupBandi = allBandi.filter((b) => {
        const key = b.scheda_id || b.link || b.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return new Response(JSON.stringify({
        done: allDone,
        sessions: results.map((r) => ({ sessionId: r.sessionId, status: r.status, count: r.bandi.length })),
        bandi: dedupBandi,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { regioni = [], importoMin, importoMax, dataDa, dataA } = body as StartRequest;
    const normalizedRegioni = (regioni || []).map(normalizeRegione);
    const batches = batchRegioni(normalizedRegioni);

    console.log(`Starting ${batches.length} session(s) for ${normalizedRegioni.length} regions`);

    const sessionIds: string[] = [];
    const filters = { importoMin, importoMax, dataDa, dataA };

    for (const batch of batches) {
      const task = buildTaskPrompt(batch, filters);
      console.log('Creating session for regions:', batch.join(', ') || 'tutte');
      const result = await createSession(task);

      if (result.rateLimited) {
        console.warn('Browser Use rate limited while creating session:', result.error || 'unknown error');
        return new Response(JSON.stringify({
          status: 'rate_limited',
          retryable: true,
          retryAfterSeconds: result.retryAfterSeconds ?? START_RETRY_AFTER_SECONDS,
          sessionIds,
          totalBatches: batches.length,
          message: 'Browser Use è temporaneamente occupato. Nuovo tentativo necessario.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!result.sessionId) {
        throw new Error('Browser Use session id missing');
      }

      sessionIds.push(result.sessionId);
      console.log('Session created:', result.sessionId);
    }

    return new Response(JSON.stringify({
      status: 'started',
      retryable: false,
      sessionIds,
      totalBatches: batches.length,
      message: `Avviate ${batches.length} sessione/i di ricerca`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in cerca-bandi:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Errore durante la ricerca' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
