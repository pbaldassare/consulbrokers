import { supabase } from "@/integrations/supabase/client";
import { fetchAllQueryPages } from "@/lib/movimentiBancari";

/** PostgREST restituisce al massimo 1000 righe: scarica tutte le pagine di `compagnie`. */
export async function fetchAllCompagnie<T>(
  select: string,
  opts?: {
    attiva?: boolean;
    orderBy?: "nome" | "codice";
    ascending?: boolean;
    /** Filtri aggiuntivi prima del `.range` (es. `.eq("tipo", "agenzia")`). */
    apply?: (q: any) => any;
  },
): Promise<T[]> {
  const orderBy = opts?.orderBy ?? "nome";
  const ascending = opts?.ascending ?? true;
  return fetchAllQueryPages<T>((from, to) => {
    let q = supabase.from("compagnie").select(select).order(orderBy, { ascending });
    if (opts?.attiva === true) q = q.eq("attiva", true);
    if (opts?.attiva === false) q = q.eq("attiva", false);
    if (opts?.apply) q = opts.apply(q) as typeof q;
    return q.range(from, to);
  });
}
