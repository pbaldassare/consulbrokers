/**
 * Ruoli di una scheda `anagrafiche_professionali`.
 * `tipo` è il ruolo principale, `ruoli` li contiene tutti (tipo compreso):
 * la stessa persona può essere produttore, AE e responsabile di sede.
 * Le query filtrano su `ruoli` (`.contains` / `.overlaps`), non su `tipo`.
 */

export const RUOLI_COMMERCIALI = [
  { value: "corrispondente", label: "Produttore" },
  { value: "account_executive", label: "Account Executive" },
  { value: "responsabile_sede", label: "Resp. Sede" },
] as const;

export type RuoloCommerciale = (typeof RUOLI_COMMERCIALI)[number]["value"];

const LABEL: Record<string, string> = {
  corrispondente: "Produttore",
  account_executive: "AE",
  responsabile_sede: "Resp. Sede",
  produttore_sede: "Produttore sede",
  executive: "Executive",
  liquidatore: "Liquidatore",
  perito: "Perito",
  legale: "Legale",
};

export type ConRuoli = { tipo?: string | null; ruoli?: string[] | null };

export function ruoliDi(a: ConRuoli | null | undefined): string[] {
  if (!a) return [];
  if (a.ruoli && a.ruoli.length > 0) return a.ruoli;
  return a.tipo ? [a.tipo] : [];
}

export function haRuolo(a: ConRuoli | null | undefined, ruolo: string): boolean {
  return ruoliDi(a).includes(ruolo);
}

export function labelRuolo(ruolo: string): string {
  return LABEL[ruolo] ?? ruolo;
}

export function labelRuoli(a: ConRuoli | null | undefined): string {
  return ruoliDi(a).map(labelRuolo).join(" · ");
}

/**
 * Regola provvigioni: se l'AE della polizza è anche uno dei produttori
 * vince il produttore e la quota AE non viene generata.
 */
export function aeCoincideConProduttore(
  aeId: string | null | undefined,
  produttoreIds: ReadonlyArray<string | null | undefined>,
): boolean {
  if (!aeId) return false;
  return produttoreIds.some((id) => !!id && id === aeId);
}
