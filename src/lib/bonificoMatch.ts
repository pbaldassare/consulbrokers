/**
 * Matching bonifico ↔ quietanza/cliente.
 * Regole prodotto:
 * - match SOLO su ordinante / descrizione vs nome cliente (niente importo)
 * - ambito: sede (ufficio) e/o conti abilitati
 */

export function normalizeNomeMatch(s: string): string {
  return String(s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Score 0–100: ordinante/descrizione vs uno o più nomi cliente. */
export function scoreOrdinanteVsNomi(
  ordinante: string | null | undefined,
  descrizione: string | null | undefined,
  nomi: string[],
): number {
  const hay = normalizeNomeMatch(`${ordinante || ""} ${descrizione || ""}`);
  if (!hay) return 0;
  let best = 0;
  for (const nome of nomi) {
    const n = normalizeNomeMatch(nome);
    if (!n || n.length < 3) continue;
    if (hay.includes(n) || n.includes(hay)) {
      best = Math.max(best, 100);
      continue;
    }
    const tokens = n.split(" ").filter((t) => t.length >= 3);
    if (tokens.length === 0) continue;
    const hit = tokens.filter((t) => hay.includes(t)).length;
    if (hit > 0) best = Math.max(best, Math.round((hit / tokens.length) * 80));
  }
  return best;
}

/** Soglia minima per considerare un suggerimento “utile”. */
export const BONIFICO_MATCH_MIN_SCORE = 50;

export type BonificoAperto = {
  id: string;
  data_movimento: string;
  importo: number;
  ordinante: string | null;
  descrizione: string | null;
  stato: string;
  cliente_id: string | null;
  ufficio_id: string | null;
  conto_bancario_id: string | null;
  conto_etichetta?: string | null;
};

export type BonificoSuggerito = BonificoAperto & {
  score: number;
  matchReason: "cliente" | "ordinante";
};

/**
 * Tra i bonifici aperti, quelli suggeribili per un cliente (solo nome / cliente_id).
 * Importo ignorato deliberatamente.
 */
export function suggestBonificiPerCliente(
  bonifici: BonificoAperto[],
  opts: { clienteId?: string | null; clienteNome?: string | null },
): BonificoSuggerito[] {
  const nome = (opts.clienteNome || "").trim();
  const nomi = nome ? [nome] : [];
  const out: BonificoSuggerito[] = [];

  for (const b of bonifici) {
    if (opts.clienteId && b.cliente_id === opts.clienteId) {
      out.push({ ...b, score: 200, matchReason: "cliente" });
      continue;
    }
    const score = scoreOrdinanteVsNomi(b.ordinante, b.descrizione, nomi);
    if (score >= BONIFICO_MATCH_MIN_SCORE) {
      out.push({ ...b, score, matchReason: "ordinante" });
    }
  }

  out.sort((a, b) => b.score - a.score || b.data_movimento.localeCompare(a.data_movimento));
  return out;
}
