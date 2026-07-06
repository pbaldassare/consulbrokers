/** Importo provvigione da % manuale: niente round2 intermedio (arrotonda il DB a 2 decimali). */
export function provvigioniImportoFromPct(base: number, pctStr: string): number {
  const s = (pctStr ?? "").trim().replace(",", ".");
  if (s === "") return 0;
  const pct = parseFloat(s);
  if (isNaN(pct) || base <= 0) return 0;
  return (base * pct) / 100;
}

/** True se il valore su titoli diverge dal calcolo matrice (qualsiasi centesimo). */
export function isProvvigioniManualStored(stored: number, calculated: number): boolean {
  return stored > 0 && Math.abs(calculated - stored) > 0.0001;
}

/** % derivata da importo/base per display (senza troncamento a 4 decimali). */
export function provvigioniPctFromImporto(importo: number, base: number): string {
  if (base <= 0 || !Number.isFinite(importo)) return "";
  return String((importo / base) * 100);
}
