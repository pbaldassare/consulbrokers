/**
 * Converte una durata tra date ISO in anni interi di contratto.
 *
 * L'arrotondamento usa gli anniversari di calendario (inclusi gli anni
 * bisestili), non una durata convenzionale di 365 giorni.
 */

function parseIsoDate(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Aggiunge anni di calendario mantenendo la logica Date.UTC già usata dal form. */
export function addCalendarYearsISO(value: string, years: number): string {
  const date = parseIsoDate(value);
  if (!date || !Number.isInteger(years) || years < 0) return "";
  const result = new Date(Date.UTC(
    date.getUTCFullYear() + years,
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
  return result.toISOString().slice(0, 10);
}

export function calcolaAnniDurata(
  durataDa?: string | null,
  durataA?: string | null,
): number | null {
  const from = parseIsoDate(durataDa);
  const to = parseIsoDate(durataA);
  if (!from || !to || to <= from) return null;

  let anniCompleti = to.getUTCFullYear() - from.getUTCFullYear();
  while (anniCompleti > 0 && addCalendarYearsISO(durataDa!, anniCompleti) > durataA!) {
    anniCompleti -= 1;
  }
  while (addCalendarYearsISO(durataDa!, anniCompleti + 1) <= durataA!) {
    anniCompleti += 1;
  }

  const anniversario = parseIsoDate(addCalendarYearsISO(durataDa!, anniCompleti))!;
  const anniversarioSuccessivo = parseIsoDate(addCalendarYearsISO(durataDa!, anniCompleti + 1))!;
  const quotaAnno =
    (to.getTime() - anniversario.getTime()) /
    (anniversarioSuccessivo.getTime() - anniversario.getTime());

  return Math.max(1, Math.round(anniCompleti + quotaAnno));
}
