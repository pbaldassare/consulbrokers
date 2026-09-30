/**
 * Polizza = prima rata: la garanzia della polizza parte da «Durata Da».
 * Temporanee e rateo hanno un periodo di garanzia proprio.
 */
export type PeriodoPolizza = {
  durataDa?: string | null;
  garanziaDa?: string | null;
  temporanea?: boolean | null;
  rateo?: boolean | null;
};

export function erroreGaranziaPrimaRata(p: PeriodoPolizza): string | null {
  if (p.temporanea || p.rateo) return null;
  const durataDa = (p.durataDa || "").slice(0, 10);
  const garanziaDa = (p.garanziaDa || "").slice(0, 10);
  if (!durataDa || !garanziaDa || durataDa === garanziaDa) return null;
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("it-IT");
  return `La polizza è la prima rata: Garanzia Da (${fmt(garanziaDa)}) deve coincidere con Durata Da (${fmt(durataDa)}).`;
}
