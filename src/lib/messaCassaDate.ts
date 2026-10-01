const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Data messa a cassa compilata (campo obbligatorio, default vuoto). */
export function isDataMessaCassaCompilata(value: string | null | undefined): boolean {
  return typeof value === "string" && ISO_DATE.test(value.trim());
}

/** Data effettiva per un titolo: override riga se valido, altrimenti data globale. */
export function dataMessaCassaEffettiva(
  globale: string,
  overrideMc?: string | null,
): string {
  const o = overrideMc?.trim();
  if (o && ISO_DATE.test(o)) return o;
  return (globale || "").trim();
}
