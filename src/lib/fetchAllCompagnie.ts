import { supabase } from "@/integrations/supabase/client";
import { fetchAllQueryPages } from "@/lib/movimentiBancari";

/** PostgREST restituisce al massimo 1000 righe: scarica tutte le pagine di `compagnie`. */
export async function fetchAllCompagnie<T = any>(
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
  return fetchAllQueryPages<T>(async (from, to) => {
    let q = supabase.from("compagnie").select(select).order(orderBy, { ascending });
    if (opts?.attiva === true) q = q.eq("attiva", true);
    if (opts?.attiva === false) q = q.eq("attiva", false);
    if (opts?.apply) q = opts.apply(q) as typeof q;
    return (q.range(from, to) as unknown) as { data: T[] | null; error: { message?: string } | null };
  });
}

export type RapportoGruppoRow = {
  compagnia_id: string | null;
  gruppo_compagnia_id: string | null;
};

/** Broker/plurimandataria → compagnie (gruppi) dei rapporti attivi. Una riga può coprire più gruppi. */
export function mappaGruppiDaRapporti(rows: RapportoGruppoRow[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const r of rows) {
    if (!r.compagnia_id || !r.gruppo_compagnia_id) continue;
    const arr = map[r.compagnia_id] || [];
    if (!arr.includes(r.gruppo_compagnia_id)) arr.push(r.gruppo_compagnia_id);
    map[r.compagnia_id] = arr;
  }
  return map;
}

/** Tutti i rapporti attivi, non solo i primi 1000 di PostgREST. */
export async function fetchMappaGruppiRapporti(): Promise<Record<string, string[]>> {
  const rows = await fetchAllQueryPages<RapportoGruppoRow>(async (from, to) => {
    const q = supabase
      .from("compagnia_rapporti")
      .select("compagnia_id, gruppo_compagnia_id")
      .eq("attivo", true)
      .order("id", { ascending: true })
      .range(from, to);
    return q as unknown as { data: RapportoGruppoRow[] | null; error: { message?: string } | null };
  });
  return mappaGruppiDaRapporti(rows);
}
