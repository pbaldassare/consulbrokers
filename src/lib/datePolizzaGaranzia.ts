export type DateRangeLike = {
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  durata_da?: string | null;
  durata_a?: string | null;
};

export type DatePolizzaGaranzia = {
  inizioPolizza: string | null;
  finePolizza: string | null;
  inizioGaranzia: string | null;
  fineGaranzia: string | null;
};

export function extremaDate(
  dates: (string | null | undefined)[],
  mode: "min" | "max",
): string | null {
  const vals = dates.filter((d): d is string => !!d && String(d).trim() !== "");
  if (vals.length === 0) return null;
  vals.sort();
  return mode === "min" ? vals[0]! : vals[vals.length - 1]!;
}

/**
 * Durata contratto (min/max su durata + tutte le garanzie) vs periodo di garanzia più recente.
 */
export function datePeriodoPolizzaGaranzia(
  head: DateRangeLike | null | undefined,
  rate: DateRangeLike[] = [],
): DatePolizzaGaranzia {
  const h = head || {};
  const all = [h, ...rate];
  const inizioPolizza = extremaDate(
    [h.durata_da, ...all.map((r) => r.garanzia_da)],
    "min",
  );
  const finePolizza = extremaDate(
    [h.durata_a, ...all.map((r) => r.garanzia_a)],
    "max",
  );
  const conFine = rate.filter((r) => r.garanzia_a);
  const ultima =
    conFine.length > 0
      ? [...conFine].sort((a, b) => String(b.garanzia_a).localeCompare(String(a.garanzia_a)))[0]
      : null;
  return {
    inizioPolizza,
    finePolizza,
    inizioGaranzia: ultima?.garanzia_da || h.garanzia_da || null,
    fineGaranzia: ultima?.garanzia_a || h.garanzia_a || null,
  };
}

export function compareDateStr(a: string | null | undefined, b: string | null | undefined, dir: "asc" | "desc"): number {
  const av = a || "";
  const bv = b || "";
  const cmp = av.localeCompare(bv);
  return dir === "asc" ? cmp : -cmp;
}

export function compareText(a: string | null | undefined, b: string | null | undefined, dir: "asc" | "desc"): number {
  const cmp = String(a || "").localeCompare(String(b || ""), "it", { sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}
