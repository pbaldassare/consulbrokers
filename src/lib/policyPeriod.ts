/**
 * Helpers per il calcolo del periodo di copertura della prossima quietanza
 * e per la determinazione dell'immutabilità dei premi su titoli storici.
 *
 * Convenzione (allineata alla vista DB v_portafoglio_titoli):
 * - prossima_garanzia_da = garanzia_a + 1 giorno
 * - prossima_garanzia_a  = prossima_garanzia_da + intervallo(rate) - 1 giorno
 *   rate=1  → +12 mesi
 *   rate=2  → +6  mesi
 *   rate=3  → +4  mesi (quadrimestrale)
 *   rate=4  → +3  mesi (trimestrale)
 *   rate=12 → +1  mese  (mensile)
 *   default → +12 mesi
 */

export type RateFraz = number | null | undefined;

export function mesiPerRate(rate: RateFraz): number {
  switch (Number(rate)) {
    case 1:  return 12;
    case 2:  return 6;
    case 3:  return 4;
    case 4:  return 3;
    case 12: return 1;
    default: return 12;
  }
}

export function descrizioneFrequenza(rate: RateFraz): string {
  switch (Number(rate)) {
    case 1:  return "Annuale";
    case 2:  return "Semestrale";
    case 3:  return "Quadrimestrale";
    case 4:  return "Trimestrale";
    case 12: return "Mensile";
    default: return "Annuale";
  }
}

function addMonthsKeepEom(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  // restore day, clamping to last day of month if needed
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Calcola il periodo coperto dalla prossima quietanza/rinnovo.
 * @param garanziaA  data di fine copertura corrente (string ISO o Date)
 * @param rate       frazionamento (1=annuale, 2=sem, 3=quadr, 4=trim, 12=mens)
 * @returns { da, a } come stringhe ISO yyyy-mm-dd, oppure null se garanziaA mancante
 */
export function calcolaProssimoPeriodo(
  garanziaA: string | Date | null | undefined,
  rate: RateFraz
): { da: string; a: string } | null {
  if (!garanziaA) return null;
  const base = typeof garanziaA === "string" ? new Date(garanziaA) : new Date(garanziaA.getTime());
  if (isNaN(base.getTime())) return null;

  const da = new Date(base.getTime());
  da.setDate(da.getDate() + 1);

  const aTmp = addMonthsKeepEom(da, mesiPerRate(rate));
  const a = new Date(aTmp.getTime());
  a.setDate(a.getDate() - 1);

  return { da: toIsoDate(da), a: toIsoDate(a) };
}

/**
 * Determina se i premi del titolo sono ancora modificabili.
 * Stessa logica della colonna calcolata `premi_modificabili` nella vista.
 */
export function premiModificabili(titolo: {
  garanzia_a?: string | null;
  stato?: string | null;
  premi_modificabili?: boolean | null;
}): boolean {
  // Se la vista fornisce direttamente il flag, usalo
  if (typeof titolo.premi_modificabili === "boolean") return titolo.premi_modificabili;

  if (!titolo.garanzia_a) return true;
  if (titolo.stato !== "incassato") return true;

  const garA = new Date(titolo.garanzia_a);
  if (isNaN(garA.getTime())) return true;

  const limit = new Date();
  limit.setDate(limit.getDate() - 7);
  limit.setHours(0, 0, 0, 0);

  // modificabile se garanzia_a >= (oggi - 7gg)
  return garA >= limit;
}

export function fmtDateIt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}
