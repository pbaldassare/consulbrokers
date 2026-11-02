import { supabase } from "@/integrations/supabase/client";

/**
 * Filtro PostgREST: clienti della sede, più le eccezioni in `clienti_sede_extra`.
 * Senza eccezioni resta il solo `ufficio_id`, come prima.
 */
export function filtroUfficioOClientiExtra(ufficioId: string, extraIds: string[]): string {
  const ids = extraIds.filter(Boolean);
  if (ids.length === 0) return `ufficio_id.eq.${ufficioId}`;
  return `ufficio_id.eq.${ufficioId},id.in.(${ids.join(",")})`;
}

type QueryConSede = {
  eq: (column: string, value: string) => QueryConSede;
  or: (filters: string) => QueryConSede;
};

/** Applica il perimetro sede ai picker che non passano da search_clienti_ranked. */
export async function limitaClientiAllaSede<T extends QueryConSede>(
  query: T,
  scopeUfficioId: string | null,
): Promise<T> {
  if (!scopeUfficioId) return query;
  const { data, error } = await (supabase as any)
    .from("clienti_sede_extra")
    .select("cliente_id")
    .eq("ufficio_id", scopeUfficioId);
  if (error || !data?.length) return query.eq("ufficio_id", scopeUfficioId) as T;
  const ids = (data as { cliente_id: string }[]).map((row) => row.cliente_id).filter(Boolean);
  return query.or(filtroUfficioOClientiExtra(scopeUfficioId, ids)) as T;
}
