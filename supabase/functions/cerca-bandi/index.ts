import { corsHeaders } from '@supabase/supabase-js/cors'

const BROWSER_USE_API_KEY = Deno.env.get('BROWSER_USE_API_KEY')!;
const API_BASE = 'https://api.browser-use.com/api/v3';

interface SearchFilters {
  keyword?: string;
  regione?: string;
  importoMin?: string;
  importoMax?: string;
  statoBando?: string;
  dataDa?: string;
  dataA?: string;
}

function buildTaskPrompt(filters: SearchFilters): string {
  const parts: string[] = [];
  
  parts.push("Vai sul sito https://www.serviziocontrattipubblici.it e cerca bandi pubblici");
  
  if (filters.keyword) {
    parts.push(`con parola chiave "${filters.keyword}"`);
  }
  if (filters.regione && filters.regione !== 'tutte') {
    parts.push(`nella regione "${filters.regione}"`);
  }
  if (filters.importoMin) {
    parts.push(`con importo minimo di €${filters.importoMin}`);
  }
  if (filters.importoMax) {
    parts.push(`con importo massimo di €${filters.importoMax}`);
  }
  if (filters.statoBando && filters.statoBando !== 'tutti') {
    const statoMap: Record<string, string> = {
      'aperto': 'aperti',
      'scaduto': 'scaduti',
      'in_valutazione': 'in valutazione',
    };
    parts.push(`con stato "${statoMap[filters.statoBando] || filters.statoBando}"`);
  }

  parts.push(`. Per ogni bando trovato (massimo 20 risultati), restituisci i dati in formato JSON come array di oggetti con questi campi:
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
      model: 'gemini-3-flash',
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
  
  // Try to extract JSON array from the output
  try {
    // Direct parse
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.bandi && Array.isArray(parsed.bandi)) return parsed.bandi;
    if (parsed.results && Array.isArray(parsed.results)) return parsed.results;
    return [];
  } catch {
    // Try to find JSON array in the text
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

    // Add IDs if missing
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
