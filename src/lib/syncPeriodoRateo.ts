/** Campi periodo allineati quando polizza_rateo è attiva. */

export type SyncPeriodoRateoResult = {
  data_competenza: string;
  garanzia_da: string;
  durata_a?: string;
};

function addMonthsISO(iso: string, months: number): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

/**
 * Allinea periodo per polizze rateo:
 * - garanzia_da = durata_da (inizio contratto)
 * - garanzia_a resta editabile dall'utente (fine fase rateo)
 * - durata_a = fine contratto reale (anni_durata × 12 mesi da durata_da), indipendente dal frazionamento
 */
export function syncPeriodoRateo({
  garanziaDa,
  durataDa,
  durataATouched,
  anniDurata,
}: {
  garanziaDa: string;
  durataDa: string;
  durataATouched: boolean;
  anniDurata: number;
}): SyncPeriodoRateoResult {
  const garanzia_da = durataDa || garanziaDa || "";
  const result: SyncPeriodoRateoResult = {
    garanzia_da,
    data_competenza: garanziaDa || garanzia_da,
  };
  if (!durataATouched && durataDa && anniDurata >= 1) {
    result.durata_a = addMonthsISO(durataDa, anniDurata * 12);
  }
  return result;
}
