/** Campi periodo allineati quando polizza_rateo è attiva. */
export type SyncPeriodoRateoResult = {
  data_competenza: string;
};

/** Allinea data competenza a garanzia da per polizze rateo (garanzie libere). */
export function syncPeriodoRateo({
  garanziaDa,
}: {
  garanziaDa: string;
}): SyncPeriodoRateoResult {
  return {
    data_competenza: garanziaDa || "",
  };
}
