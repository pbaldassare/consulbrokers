import { supabase } from "@/integrations/supabase/client";
import { PENDENTI_OR_GARANTITO_APERTO_FILTER } from "@/lib/garantitoTitolo";

/** Polizza + quietanze + appendici restano tutte in lista (la polizza è la prima rata incassabile). */
export const applyExcludeMadreConRate = (q: any) => q;

/** Su tabella titoli: nessun filtro extra — polizza, quietanza e appendice sono incassabili. */
export const applyExcludeMadreConRateTitoli = (q: any) => q;

export type TitoloDaIncassareRow = {
  id: string;
  numero_titolo: string | null;
  premio_lordo: number | null;
  stato: string | null;
  data_messa_cassa: string | null;
  data_scadenza: string | null;
  sostituisce_polizza: string | null;
  ramo?: { descrizione?: string | null } | null;
  compagnia?: { nome?: string | null } | null;
};

/** Identità: polizza e quietanze dello stesso numero sono periodi distinti, si tengono tutte. */
export function dedupeTitoliMadreQuietanza<T extends { id: string; numero_titolo?: string | null; sostituisce_polizza?: string | null }>(
  rows: T[],
): T[] {
  return rows;
}

/** Titoli eleggibili per collegamento bonifico / messa a cassa (allineato a Incassi). */
export async function fetchTitoliClienteDaIncassare(
  clienteAnagraficaId: string,
  limit = 50,
): Promise<TitoloDaIncassareRow[]> {
  let q = supabase
    .from("titoli")
    .select(
      "id, numero_titolo, premio_lordo, stato, data_messa_cassa, data_scadenza, sostituisce_polizza, conferimento_gestito, fondi_ricevuti, tipo_pagamento, data_copertura, ramo:rami(descrizione), compagnia:compagnie(nome)" as any,
    )
    .eq("cliente_anagrafica_id", clienteAnagraficaId)
    .neq("stato", "annullato")
    .or(PENDENTI_OR_GARANTITO_APERTO_FILTER);
  q = applyExcludeMadreConRateTitoli(q);
  const { data, error } = await q
    .order("data_scadenza", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return dedupeTitoliMadreQuietanza(((data as unknown) as TitoloDaIncassareRow[]) ?? []);
}
