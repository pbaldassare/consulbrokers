import type { GaranziaRow } from "@/components/polizze/PremiGaranziaCardShell";
import { parseDecimalItOr } from "@/lib/number";

export type MatriceProvvAccessori = {
  pctByRamoId: Map<string, number>;
  pctAccessoriByRamoId: Map<string, number>;
  pctDefault: number | null;
  pctAccessoriDefault: number | null;
  pctPrevalente: number;
  isUniform: boolean;
};

export function resolveRowPctNetto(
  row: GaranziaRow,
  matrice: MatriceProvvAccessori | null,
): { pct: number; matched: boolean } {
  if (!matrice) return { pct: 0, matched: false };
  if (row.sottoramoId && matrice.pctByRamoId.has(row.sottoramoId)) {
    return { pct: matrice.pctByRamoId.get(row.sottoramoId)!, matched: true };
  }
  if (matrice.pctDefault != null) return { pct: matrice.pctDefault, matched: true };
  return { pct: matrice.pctPrevalente, matched: matrice.isUniform };
}

export function resolveRowPctAccessori(
  row: GaranziaRow,
  matrice: MatriceProvvAccessori | null,
): { pct: number; matched: boolean } {
  if (row.provvAccessoriPct != null && !Number.isNaN(row.provvAccessoriPct)) {
    return { pct: row.provvAccessoriPct, matched: true };
  }
  if (!matrice) return { pct: 0, matched: false };
  if (row.sottoramoId && matrice.pctAccessoriByRamoId.has(row.sottoramoId)) {
    return { pct: matrice.pctAccessoriByRamoId.get(row.sottoramoId)!, matched: true };
  }
  if (!row.sottoramoId && matrice.pctAccessoriDefault != null) {
    return { pct: matrice.pctAccessoriDefault, matched: true };
  }
  return resolveRowPctNetto(row, matrice);
}

/** provv = Σ(netto × pct_netto/100) + Σ(accessori × pct_accessori/100) */
export function calcProvvigioniGaranzia(
  rows: GaranziaRow[],
  matrice: MatriceProvvAccessori | null,
): number {
  return rows.reduce((s, r) => {
    if (r.escludiProvvigioni) return s;
    const netto = parseDecimalItOr(r.netto);
    const accessori = parseDecimalItOr(r.accessori);
    const pctNetto = resolveRowPctNetto(r, matrice).pct;
    const pctAcc = resolveRowPctAccessori(r, matrice).pct;
    return s + (netto * pctNetto) / 100 + (accessori * pctAcc) / 100;
  }, 0);
}

/** Media ponderata % netto e % accessori per display footer. */
export function provvPctBreakdown(
  rows: GaranziaRow[],
  matrice: MatriceProvvAccessori | null,
): { pctNetto: number; pctAccessori: number } | null {
  let totNetto = 0;
  let totAcc = 0;
  let wNetto = 0;
  let wAcc = 0;
  for (const r of rows) {
    if (r.escludiProvvigioni) continue;
    const netto = parseDecimalItOr(r.netto);
    const accessori = parseDecimalItOr(r.accessori);
    const pn = resolveRowPctNetto(r, matrice).pct;
    const pa = resolveRowPctAccessori(r, matrice).pct;
    if (netto > 0) {
      totNetto += netto;
      wNetto += netto * pn;
    }
    if (accessori > 0) {
      totAcc += accessori;
      wAcc += accessori * pa;
    }
  }
  if (totNetto <= 0 && totAcc <= 0) return null;
  return {
    pctNetto: totNetto > 0 ? wNetto / totNetto : resolveRowPctNetto(rows[0] || ({} as GaranziaRow), matrice).pct,
    pctAccessori: totAcc > 0 ? wAcc / totAcc : resolveRowPctAccessori(rows[0] || ({} as GaranziaRow), matrice).pct,
  };
}

/** Imponibile = netto + accessori; tasse = imponibile × aliq/100 */
export function calcTasseRiga(netto: number, accessori: number, aliquotaTasse: number): number {
  if (aliquotaTasse <= 0) return 0;
  return +(((netto + accessori) * aliquotaTasse) / 100).toFixed(2);
}

export function calcLordoRiga(netto: number, accessori: number, tasse: number, ssn: number): number {
  return netto + accessori + tasse + ssn;
}
