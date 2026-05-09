const eurFmt = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numFmt = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const fmtEuro = (v: number | null | undefined): string =>
  v == null || isNaN(v as number) ? "—" : eurFmt.format(v as number);

export const fmtNum = (v: number | null | undefined): string =>
  v == null || isNaN(v as number) ? "—" : numFmt.format(v as number);

export const fmtPct = (v: number | null | undefined, digits = 1): string =>
  v == null || isNaN(v as number) ? "—" : `${(v as number).toFixed(digits)}%`;
