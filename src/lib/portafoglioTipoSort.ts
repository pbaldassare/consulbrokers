/** Ordinamento per tipo titolo sulle viste portafoglio (v_portafoglio_quietanze). */

export const TIPO_SORT_FIELD = "tipo";

export type PortafoglioTipoRow = {
  is_appendice_modifica?: boolean | null;
  is_proroga?: boolean | null;
  is_regolazione?: boolean | null;
  sostituisce_polizza?: string | null;
};

/**
 * Rango stabile per raggruppare i tipi (asc):
 * polizza → quietanza → regolazione → proroga → appendice.
 * Allineato a `applyPortafoglioTipoOrder` (boolean + sostituisce_polizza).
 */
export function portafoglioTipoRank(row: PortafoglioTipoRow): number {
  if (row.is_appendice_modifica) return 4;
  if (row.is_proroga) return 3;
  if (row.is_regolazione) return 2;
  if (row.sostituisce_polizza) return 1;
  return 0;
}

export function comparePortafoglioTipo(a: PortafoglioTipoRow, b: PortafoglioTipoRow): number {
  return portafoglioTipoRank(a) - portafoglioTipoRank(b);
}

export function isTipoSortField(field: string): boolean {
  return field === TIPO_SORT_FIELD;
}

/**
 * ORDER BY sui flag già presenti in v_portafoglio_quietanze
 * (la vista non espone titoli.tipo).
 */
export function applyPortafoglioTipoOrder<T>(q: T, ascending: boolean): T {
  type Orderable = {
    order: (col: string, opts: { ascending: boolean; nullsFirst: boolean }) => Orderable;
  };
  const next = q as unknown as Orderable;
  return next
    .order("is_appendice_modifica", { ascending, nullsFirst: true })
    .order("is_proroga", { ascending, nullsFirst: true })
    .order("is_regolazione", { ascending, nullsFirst: true })
    .order("sostituisce_polizza", { ascending, nullsFirst: true }) as unknown as T;
}
