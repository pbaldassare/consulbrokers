import { endOfMonth, format, startOfMonth, subDays } from "date-fns";

export function isoLocal(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function dashboardDateBounds(now = new Date()) {
  return {
    startOfMonth: isoLocal(startOfMonth(now)),
    endOfMonth: isoLocal(endOfMonth(now)),
    yesterday: isoLocal(subDays(now, 1)),
    today: isoLocal(now),
  };
}

/** Rinnovi / scadenze del mese → pagina rinnovi con Dal/Al già impostati. */
export function hrefRinnoviMese(now = new Date()): string {
  const { startOfMonth: dal, endOfMonth: al } = dashboardDateBounds(now);
  return `/portafoglio/rinnovi?dal=${dal}&al=${al}`;
}

/** Coda operativa da mettere a cassa (mese corrente + arretrati). */
export function hrefDaMettereACassa(): string {
  return "/portafoglio/incassi?vista=pendenti&periodo=mese_corrente";
}

/** Titoli messi a cassa ieri. */
export function hrefIncassiIeri(now = new Date()): string {
  const { yesterday } = dashboardDateBounds(now);
  return `/contabilita?dal=${yesterday}&al=${yesterday}`;
}

/** Titoli messi a cassa nel mese corrente. */
export function hrefIncassiMese(): string {
  return "/contabilita?periodo=mese_corrente";
}

/** Scadenze del mese (stesso filtro operativo del carico). */
export function hrefScadenzeMese(): string {
  return "/portafoglio/incassi?vista=pendenti&periodo=mese_corrente";
}

/** Scadute nel mese, ancora da cassa → coda pendenti mese. */
export function hrefFuoriCopertura(): string {
  return "/portafoglio/incassi?vista=pendenti&periodo=mese_corrente";
}

export function hrefRimesseDaInviare(): string {
  return "/contabilita/storico-rimesse";
}
