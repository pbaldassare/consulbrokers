/**
 * Helper per formattazione date in locale italiano.
 * Centralizza i pattern `toLocaleDateString('it-IT', ...)` sparsi nel codice.
 */

const dateFmt = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const monthYearFmt = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
});

type DateInput = Date | string | number | null | undefined;

const toDate = (v: DateInput): Date | null => {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

/** "31/12/2025" */
export const fmtDate = (v: DateInput): string => {
  const d = toDate(v);
  return d ? dateFmt.format(d) : "—";
};

/** "31/12/2025 14:30" */
export const fmtDateTime = (v: DateInput): string => {
  const d = toDate(v);
  return d ? dateTimeFmt.format(d) : "—";
};

/** "dicembre 2025" */
export const fmtMonthYear = (v: DateInput): string => {
  const d = toDate(v);
  return d ? monthYearFmt.format(d) : "—";
};
