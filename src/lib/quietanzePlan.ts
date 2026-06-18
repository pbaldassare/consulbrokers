// Helper PURO per calcolare in anticipo le quietanze che verranno generate
// dal trigger DB `genera_quietanze_su_insert_madre` alla creazione della polizza madre.
// Usato dalla preview UI in ImmissionePolizzaPage e dai test di regressione.

import { frazionamentoMesi, type Frazionamento } from "./frazionamento";

export type QuietanzaPlanRow = {
  idx: number; // 1-based: 1 = madre, 2..N = quietanze pre-generate
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
 * Calcola la lista completa delle rate (madre + quietanze). La riga idx=1 è la
 * madre; le righe idx>=2 sono le quietanze che il trigger DB genererà.
 * Ritorna [] se mancano dati indispensabili o se è poliennale.
 */
export function computeQuietanzePlan(input: QuietanzaPlanInput): QuietanzaPlanRow[] {
  const garDa = toDate(input.garanziaDa);
  const garA = toDate(input.garanziaA);
  if (!garDa || !garA) return [];

  const f = String(input.frazionamento || "").toLowerCase();
  if (!f || f === "poliennale") return [];

  const mesiRata = frazionamentoMesi(f.charAt(0).toUpperCase() + f.slice(1), 1);
  if (mesiRata <= 0 || mesiRata > 12) return [];

  const anni = Math.max(1, Number(input.anniDurata) || 1);
  const nTot = Math.floor(12 / mesiRata) * anni;
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

/** Solo le quietanze pre-generate (idx >= 2). */
export function computeQuietanzeOnly(input: QuietanzaPlanInput): QuietanzaPlanRow[] {
  return computeQuietanzePlan(input).filter((r) => r.idx >= 2);
}
