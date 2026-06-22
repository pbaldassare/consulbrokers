// Helper PURO per calcolare le quietanze (rate) di una polizza.
// Usato dalla UI di Immissione Polizza per editare le rate prima del salvataggio,
// e dai test di regressione.

import { frazionamentoMesi, type Frazionamento } from "./frazionamento";

export type QuietanzaPlanRow = {
  idx: number; // 1-based: 1 = rata alla firma, 2..N = rate successive
  garanzia_da: string; // ISO yyyy-mm-dd
  garanzia_a: string;
  data_competenza: string | null;
};

export type QuietanzaPlanInput = {
  frazionamento?: string | Frazionamento | null;
  anniDurata?: number | null;
  garanziaDa?: string | Date | null;
  garanziaA?: string | Date | null;
  dataCompetenza?: string | Date | null;
  /** Se true: una sola quietanza sul periodo indicato, senza frazionamento. */
  polizzaTemporanea?: boolean | null;
};

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(d: Date, m: number): Date {
  const out = new Date(d.getTime());
  out.setMonth(out.getMonth() + m);
  return out;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Calcola la lista completa delle quietanze. idx=1 e' la rata 1 (alla firma),
 * idx>=2 sono le rate successive.
 *
 * Poliennale: 1 quietanza annuale per ogni anno della durata (es. 3y -> 3 rate).
 * Altri frazionamenti: (12/mesi_rata) rate per ogni anno della durata.
 *
 * Ritorna [] se mancano dati indispensabili (garanzia_da/a o frazionamento).
 */
export function computeQuietanzePlan(input: QuietanzaPlanInput): QuietanzaPlanRow[] {
  const garDa = toDate(input.garanziaDa);
  const garA = toDate(input.garanziaA);
  if (!garDa || !garA) return [];

  if (input.polizzaTemporanea) {
    const competenza = toDate(input.dataCompetenza);
    return [{
      idx: 1,
      garanzia_da: iso(garDa),
      garanzia_a: iso(garA),
      data_competenza: competenza ? iso(competenza) : iso(garDa),
    }];
  }

  const f = String(input.frazionamento || "").toLowerCase();
  if (!f) return [];

  const anni = Math.max(1, Number(input.anniDurata) || 1);

  let mesiRata: number;
  let nTot: number;
  if (f === "poliennale") {
    mesiRata = 12;
    nTot = anni;
  } else {
    mesiRata = frazionamentoMesi(f.charAt(0).toUpperCase() + f.slice(1), 1);
    if (mesiRata <= 0 || mesiRata > 12) return [];
    nTot = Math.floor(12 / mesiRata) * anni;
  }
  if (nTot < 1) return [];

  const competenza = toDate(input.dataCompetenza);
  const rows: QuietanzaPlanRow[] = [];
  for (let i = 1; i <= nTot; i++) {
    const da = addMonths(garDa, (i - 1) * mesiRata);
    const a = addMonths(da, mesiRata);
    rows.push({
      idx: i,
      garanzia_da: iso(da),
      garanzia_a: iso(a),
      data_competenza: competenza ? iso(addMonths(competenza, (i - 1) * mesiRata)) : null,
    });
  }
  return rows;
}

/** Solo le quietanze successive alla prima (idx >= 2). */
export function computeQuietanzeOnly(input: QuietanzaPlanInput): QuietanzaPlanRow[] {
  return computeQuietanzePlan(input).filter((r) => r.idx >= 2);
}
