const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BROWSER_USE_API_KEY = Deno.env.get('BROWSER_USE_API_KEY')!;
const MONDOAPPALTI_USER = Deno.env.get('MONDOAPPALTI_USER')!;
const MONDOAPPALTI_PASSWORD = Deno.env.get('MONDOAPPALTI_PASSWORD')!;
const API_BASE = 'https://api.browser-use.com/api/v3';

interface SearchFilters {
  keyword?: string;
  regione?: string;
  importoMin?: string;
  importoMax?: string;
  statoBando?: string;
  dataDa?: string;
  dataA?: string;
  fonte?: string;
}

function buildTaskPrompt(filters: SearchFilters): string {
  const parts: string[] = [];

  parts.push(`Vai sul sito https://www.mondoappalti.it e effettua il login con username "${MONDOAPPALTI_USER}" e password "${MONDOAPPALTI_PASSWORD}".`);
  parts.push(`Dopo il login, cerca gare d'appalto relative al settore assicurativo e brokeraggio.`);

  if (filters.keyword) {
    parts.push(`Usa come parola chiave di ricerca: "${filters.keyword}".`);
  } else {
    parts.push(`Cerca con parole chiave come "servizi assicurativi" o "brokeraggio" o "polizza" o "intermediazione assicurativa".`);
  }

  if (filters.regione && filters.regione !== 'tutte') {
    parts.push(`Filtra per la regione "${filters.regione}".`);
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

  parts.push(`Per ogni bando trovato (massimo 20 risultati), restituisci i dati in formato JSON come array di oggetti con questi campi:
- "titolo": titolo del bando
- "ente": ente committente/stazione appaltante
- "importo": importo in euro come numero (null se non disponibile)
- "scadenza": data di scadenza nel formato "dd/MM/yyyy" (null se non disponibile)
- "stato": uno tra "aperto", "scaduto", "in_valutazione"
- "dataPublicazione": data di pubblicazione nel formato "dd/MM/yyyy"
- "link": URL diretto al bando
- "categoria": categoria o tipologia del bando (null se non disponibile)

Rispondi SOLO con il JSON array, senza testo aggiuntivo. Se non trovi risultati rispondi con un array vuoto [].`);

  return parts.join(' ');
}

async function createSession(task: string): Promise<string> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'X-Browser-Use-API-Key': BROWSER_USE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task,
      model: 'gemini-2.0-flash',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create session: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.id;
}

async function pollSession(sessionId: string, maxWaitMs = 180000): Promise<string | null> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
      headers: {
        'X-Browser-Use-API-Key': BROWSER_USE_API_KEY,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to poll session: ${res.status} ${err}`);
    }

    const session = await res.json();
    const status = session.status;

    if (status === 'idle' || status === 'stopped') {
      return session.output || null;
    }
    if (status === 'error' || status === 'timed_out') {
      throw new Error(`Session ${status}: ${session.output || 'unknown error'}`);
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  throw new Error('Session timed out after 3 minutes');
}

function parseOutput(output: string | null): any[] {
  if (!output) return [];

  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.bandi && Array.isArray(parsed.bandi)) return parsed.bandi;
    if (parsed.results && Array.isArray(parsed.results)) return parsed.results;
    return [];
  } catch {
    const match = output.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return [];
      }
    }
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!BROWSER_USE_API_KEY) {
      throw new Error('BROWSER_USE_API_KEY not configured');
    }

    const filters: SearchFilters = await req.json();
    const task = buildTaskPrompt(filters);

    console.log('Creating Browser Use session with task:', task.substring(0, 200));

    const sessionId = await createSession(task);
    console.log('Session created:', sessionId);

    const output = await pollSession(sessionId);
    console.log('Session completed, output length:', output?.length || 0);

    const bandi = parseOutput(output);

    const risultati = bandi.map((b: any, i: number) => ({
      id: b.id || `bando-${Date.now()}-${i}`,
      titolo: b.titolo || 'Titolo non disponibile',
      ente: b.ente || 'Ente non specificato',
      importo: b.importo != null ? Number(b.importo) : null,
      scadenza: b.scadenza || null,
      stato: b.stato || 'aperto',
      dataPublicazione: b.dataPublicazione || b.dataPubblicazione || '',
      link: b.link || null,
      categoria: b.categoria || null,
    }));

    return new Response(JSON.stringify({ bandi: risultati }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in cerca-bandi:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Errore durante la ricerca' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
