import { endOfMonth, format, subMonths } from "date-fns";

/**
 * Default "Data limite incasso" (E/C agenzie e produttori).
 *
 * Il mese di competenza non gira il 1° ma l'11:
 * - qualsiasi giorno di settembre → 30/09
 * - 1–10 del mese successivo → ancora fine mese precedente (es. 10/10 → 30/09)
 * - dall'11 fino al 10 del mese dopo → fine mese corrente (es. 11/10–10/11 → 31/10)
 */
export function defaultDataLimiteIncasso(now: Date = new Date()): Date {
  const day = now.getDate();
  const month = now.getMonth();

  // Settembre: tutto il mese solare resta sul 30/09 (anche l'1–10).
  if (month === 8) {
    return endOfMonth(now);
  }

  if (day <= 10) {
    return endOfMonth(subMonths(now, 1));
  }
  return endOfMonth(now);
}

export function defaultDataLimiteIncassoIso(now: Date = new Date()): string {
  return format(defaultDataLimiteIncasso(now), "yyyy-MM-dd");
}

export function isDefaultDataLimiteIncasso(d: Date | null | undefined, now: Date = new Date()): boolean {
  if (!d) return false;
  return format(d, "yyyy-MM-dd") === defaultDataLimiteIncassoIso(now);
}

/** Data inizio aperta per E/C produttori (solo limite superiore). */
export const EC_PRODUTTORI_PERIODO_DA = "1970-01-01";

/** Pregresso E/C produttori chiuso a storico: trattenute fino a questa data non si mostrano più. */
export const EC_PRODUTTORI_STORICO_AL = "2026-08-31";

/**
 * Go-live CBnet: E/C agenzie (lista + PDF) include solo incassi
 * con data messa a cassa da questa data in poi.
 */
export const EC_AGENZIE_DAL = "2026-09-01";

export function defaultPeriodoDalAgenzia(): Date {
  return new Date(2026, 8, 1);
}

/** Periodo dal E/C agenzie: mai prima del 1 settembre 2026. */
export function resolvePeriodoDalAgenzia(d: Date | null | undefined): Date {
  const floor = defaultPeriodoDalAgenzia();
  if (!d) return floor;
  return format(d, "yyyy-MM-dd") < EC_AGENZIE_DAL ? floor : d;
}

export function resolvePeriodoDalAgenziaIso(iso: string | null | undefined): string {
  const day = (iso || "").slice(0, 10);
  if (!day || day < EC_AGENZIE_DAL) return EC_AGENZIE_DAL;
  return day;
}

export function isDefaultPeriodoDalAgenzia(d: Date | null | undefined): boolean {
  if (!d) return true;
  return format(d, "yyyy-MM-dd") === EC_AGENZIE_DAL;
}

/** Incasso ammissibile in E/C agenzia / PDF (data messa a cassa). */
export function isIncassoNelPeriodoEcAgenzia(
  dataMessaCassa: string | null | undefined,
  dalIso: string = EC_AGENZIE_DAL,
): boolean {
  if (!dataMessaCassa) return false;
  return dataMessaCassa.slice(0, 10) >= dalIso;
}
