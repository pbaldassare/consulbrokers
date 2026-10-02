/**
 * Seleziona la quietanza “ultima” rilevante di una catena polizza
 * (per premio/provvigioni/data incasso sulla riga madre).
 *
 * Preferenza:
 * 1. tra le rate con data_incasso / data_pagamento / data_messa_cassa,
 *    quella con data più recente;
 * 2. altrimenti l’ultima rata per garanzia_a / created_at / ordine catena.
 *
 * Se non ci sono rate, usa le appendici come fallback (stessa logica).
 */

export type QuietanzaCatenaLike = {
  id?: string;
  data_incasso?: string | null;
  data_pagamento?: string | null;
  data_messa_cassa?: string | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  created_at?: string | null;
  premio_lordo?: number | null;
  provvigioni_firma?: number | null;
  provvigioni_quietanza?: number | null;
  sostituisce_polizza?: string | null;
  tipo_pagamento?: string | null;
  is_appendice_modifica?: boolean | null;
  is_proroga?: boolean | null;
  is_regolazione?: boolean | null;
};

export function dataIncassoQuietanza(r: QuietanzaCatenaLike | null | undefined): string | null {
  if (!r) return null;
  return r.data_incasso || r.data_pagamento || r.data_messa_cassa || null;
}

function sortKeyOrdineCatena(r: QuietanzaCatenaLike): string {
  return r.garanzia_a || r.created_at || "";
}

/**
 * Quietanza ordinaria da cui leggere premio/provvigioni sulla riga polizza:
 * stessa decorrenza della madre, altrimenti unica rata, altrimenti ultima in catena.
 * Appendici, proroghe e regolazioni hanno importi propri e non devono mai
 * modificare il premio/provvigione mostrato sulla polizza madre.
 */
export function quietanzaRiferimentoPremio<T extends QuietanzaCatenaLike>(
  head: { garanzia_da?: string | null } | null | undefined,
  rate: T[],
): T | null {
  const quietanzeOrdinarie = rate.filter(
    (r) => !r.is_appendice_modifica && !r.is_proroga && !r.is_regolazione,
  );
  const da = head?.garanzia_da;
  if (da) {
    const stessoPeriodo = quietanzeOrdinarie.find((r) => r.garanzia_da === da);
    if (stessoPeriodo) return stessoPeriodo;
  }
  if (quietanzeOrdinarie.length === 1) return quietanzeOrdinarie[0];
  return ultimaQuietanzaCatena(quietanzeOrdinarie);
}

export function ultimaQuietanzaCatena<T extends QuietanzaCatenaLike>(
  rate: T[],
  appendici: T[] = [],
): T | null {
  const pool = rate.length > 0 ? rate : appendici;
  if (pool.length === 0) return null;

  const conIncasso = pool.filter((r) => !!dataIncassoQuietanza(r));
  if (conIncasso.length > 0) {
    return [...conIncasso].sort((a, b) =>
      dataIncassoQuietanza(b)!.localeCompare(dataIncassoQuietanza(a)!),
    )[0];
  }

  return [...pool].sort((a, b) => sortKeyOrdineCatena(a).localeCompare(sortKeyOrdineCatena(b))).at(-1) ?? null;
}
