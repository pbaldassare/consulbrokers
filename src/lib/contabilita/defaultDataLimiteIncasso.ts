import { addMonths, endOfMonth, format } from "date-fns";

/** Fine del mese successivo — default filtro "Data limite incasso" E/C agenzie e produttori. */
export function defaultDataLimiteIncasso(): Date {
  return endOfMonth(addMonths(new Date(), 1));
}

export function defaultDataLimiteIncassoIso(): string {
  return format(defaultDataLimiteIncasso(), "yyyy-MM-dd");
}

export function isDefaultDataLimiteIncasso(d: Date | null | undefined): boolean {
  if (!d) return false;
  return format(d, "yyyy-MM-dd") === defaultDataLimiteIncassoIso();
}

/** Data inizio aperta per E/C produttori (solo limite superiore). */
export const EC_PRODUTTORI_PERIODO_DA = "1970-01-01";
