import type { SupabaseClient } from "@supabase/supabase-js";
import {
  verificaSequenzaIncasso,
  type BloccoSequenza,
  type TitoloSequenza,
} from "@/lib/messaCassaSequenza";

export const TITOLO_SEQUENZA_SELECT =
  "id, numero_titolo, sostituisce_polizza, compagnia_id, riga, garanzia_da, stato, data_messa_cassa, conferimento_gestito, tipo_pagamento, data_copertura, is_appendice_modifica, is_proroga, is_regolazione";

function numeriCatena(rows: TitoloSequenza[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const n = (r.sostituisce_polizza || r.numero_titolo || "").trim();
    if (n) set.add(n);
  }
  return [...set];
}

/** Tutti i titoli (polizza + quietanze + appendici) delle catene con questi numeri. */
export async function fetchCateneIncasso(
  supabase: SupabaseClient,
  numeri: string[],
): Promise<TitoloSequenza[]> {
  if (numeri.length === 0) return [];
  const [byNumero, byPadre] = await Promise.all([
    (supabase.from("titoli") as any).select(TITOLO_SEQUENZA_SELECT).in("numero_titolo", numeri).limit(2000),
    (supabase.from("titoli") as any).select(TITOLO_SEQUENZA_SELECT).in("sostituisce_polizza", numeri).limit(2000),
  ]);
  if (byNumero.error) throw byNumero.error;
  if (byPadre.error) throw byPadre.error;
  const merged = new Map<string, TitoloSequenza>();
  for (const r of [...(byNumero.data || []), ...(byPadre.data || [])] as TitoloSequenza[]) {
    merged.set(r.id, r);
  }
  return [...merged.values()];
}

export async function fetchCateneDaTitoli(
  supabase: SupabaseClient,
  rows: TitoloSequenza[],
): Promise<TitoloSequenza[]> {
  return fetchCateneIncasso(supabase, numeriCatena(rows));
}

/** Titoli in distinta che saltano la sequenza (letti freschi dal DB). */
export async function verificaSequenzaDistinta(
  supabase: SupabaseClient,
  titoloIds: string[],
): Promise<BloccoSequenza[]> {
  if (titoloIds.length === 0) return [];
  const { data, error } = await (supabase.from("titoli") as any)
    .select(TITOLO_SEQUENZA_SELECT)
    .in("id", titoloIds);
  if (error) throw error;
  const catene = await fetchCateneDaTitoli(supabase, (data || []) as TitoloSequenza[]);
  return verificaSequenzaIncasso(titoloIds, catene);
}
