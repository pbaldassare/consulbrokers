import { supabase } from "@/integrations/supabase/client";
import {
  BONIFICO_MATCH_MIN_SCORE,
  normalizeNomeMatch,
  scoreOrdinanteVsNomi,
} from "@/lib/bonificoMatch";

/** Soglia per auto-assegnare cliente/sede in import (più alta del semplice suggerimento UI). */
export const CLIENTE_MATCH_AUTO_MIN = 80;

export type ClienteOrdinanteMatch = {
  cliente_id: string;
  ufficio_id: string | null;
  score: number;
  label: string;
};

function clienteLabel(c: {
  ragione_sociale?: string | null;
  nome?: string | null;
  cognome?: string | null;
}): string {
  return (
    (c.ragione_sociale || "").trim() ||
    [c.nome, c.cognome].filter(Boolean).join(" ").trim()
  );
}

/** Token utili per ricerca (skip parole troppo generiche). */
export function tokensRicercaOrdinante(ordinante: string): string[] {
  const stop = new Set([
    "COMUNE",
    "DELL",
    "DELLA",
    "DELLE",
    "DEGLI",
    "SOCIETA",
    "SRL",
    "SPA",
    "SAS",
    "SNC",
    "DI",
    "DA",
    "DE",
    "E",
    "THE",
    "AND",
  ]);
  return normalizeNomeMatch(ordinante)
    .split(" ")
    .filter((t) => t.length >= 4 && !stop.has(t))
    .slice(0, 4);
}

type ClienteCandidato = {
  id: string;
  ragione_sociale?: string | null;
  nome?: string | null;
  cognome?: string | null;
  ufficio_id?: string | null;
};

/** Token di ricerca per un ordinante (vuoto = non cercabile). */
export function searchBitsOrdinante(ordinante: string | null | undefined): string[] {
  const ord = String(ordinante || "").trim();
  if (ord.length < 3) return [];
  const tokens = tokensRicercaOrdinante(ord);
  return tokens.length > 0 ? tokens : [normalizeNomeMatch(ord).slice(0, 24)].filter((t) => t.length >= 3);
}

/** Miglior candidato per score nominativo; null se sotto soglia o ambiguo. */
export function pickBestClienteOrdinante(
  ordinante: string,
  descrizione: string | null | undefined,
  candidati: ClienteCandidato[],
  minScore: number = CLIENTE_MATCH_AUTO_MIN,
): ClienteOrdinanteMatch | null {
  let best: ClienteOrdinanteMatch | null = null;
  let second = 0;
  for (const c of candidati) {
    const label = clienteLabel(c);
    if (!label) continue;
    const score = scoreOrdinanteVsNomi(ordinante, descrizione, [label]);
    if (!best || score > best.score) {
      second = best?.score ?? 0;
      best = {
        cliente_id: c.id,
        ufficio_id: c.ufficio_id ?? null,
        score,
        label,
      };
    } else if (score > second) {
      second = score;
    }
  }

  if (!best || best.score < minScore) return null;
  // Evita ambiguità: secondo vicino entro 10 punti
  if (second > 0 && best.score - second < 10 && best.score < 100) return null;
  return best;
}

const TOKEN_CHUNK = 200;

type CandidatiRpc = (
  fn: "clienti_candidati_ordinanti",
  args: { p_tokens: string[] },
) => PromiseLike<{ data: Array<ClienteCandidato & { token: string }> | null; error: unknown }>;

/** Candidati per token in una sola RPC a blocco (indice trigram, visibilità del chiamante). */
async function fetchCandidatiPerToken(tokens: string[]): Promise<Map<string, ClienteCandidato[]>> {
  const out = new Map<string, ClienteCandidato[]>();
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += TOKEN_CHUNK) chunks.push(tokens.slice(i, i + TOKEN_CHUNK));
  const rpc = supabase.rpc.bind(supabase) as unknown as CandidatiRpc;
  const results = await Promise.all(
    chunks.map((chunk) => rpc("clienti_candidati_ordinanti", { p_tokens: chunk })),
  );
  for (const { data, error } of results) {
    if (error) throw error;
    for (const r of data || []) {
      const arr = out.get(r.token) || [];
      arr.push(r);
      out.set(r.token, arr);
    }
  }
  return out;
}

function candidatiPerOrdinante(bits: string[], perToken: Map<string, ClienteCandidato[]>): ClienteCandidato[] {
  const seen = new Map<string, ClienteCandidato>();
  for (const b of bits) for (const c of perToken.get(b) || []) seen.set(c.id, c);
  return [...seen.values()];
}

/**
 * Trova il miglior cliente per un ordinante (e opz. descrizione).
 * Cerca per token su ragione_sociale/nome/cognome, poi score nominativo.
 */
export async function matchClienteDaOrdinante(
  ordinante: string | null | undefined,
  descrizione?: string | null,
  opts?: { minScore?: number },
): Promise<ClienteOrdinanteMatch | null> {
  const bits = searchBitsOrdinante(ordinante);
  if (bits.length === 0) return null;
  const perToken = await fetchCandidatiPerToken(bits);
  return pickBestClienteOrdinante(String(ordinante).trim(), descrizione, candidatiPerOrdinante(bits, perToken), opts?.minScore);
}

/**
 * Match in batch (import Excel/CSV): una ricerca per tutti i token distinti del file,
 * poi score in memoria per ordinante normalizzato.
 */
export async function matchClientiDaOrdinantiBatch(
  rows: Array<{ ordinante: string | null; descrizione: string | null }>,
  opts?: { minScore?: number },
): Promise<Map<string, ClienteOrdinanteMatch>> {
  const out = new Map<string, ClienteOrdinanteMatch>();
  const perKey = new Map<string, { ordinante: string; descrizione: string | null; bits: string[] }>();
  for (const r of rows) {
    const key = normalizeNomeMatch(r.ordinante || "");
    if (!key || perKey.has(key)) continue;
    const bits = searchBitsOrdinante(r.ordinante);
    if (bits.length === 0) continue;
    perKey.set(key, { ordinante: String(r.ordinante).trim(), descrizione: r.descrizione, bits });
  }
  if (perKey.size === 0) return out;

  const tokens = [...new Set([...perKey.values()].flatMap((v) => v.bits))];
  const perToken = await fetchCandidatiPerToken(tokens);
  for (const [key, v] of perKey) {
    const m = pickBestClienteOrdinante(v.ordinante, v.descrizione, candidatiPerOrdinante(v.bits, perToken), opts?.minScore);
    if (m) out.set(key, m);
  }
  return out;
}

export { BONIFICO_MATCH_MIN_SCORE, normalizeNomeMatch };
