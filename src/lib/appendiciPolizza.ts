import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTitoloMadreId } from "@/lib/sospensioneQuietanze";

export type AppendicePolizzaRow = {
  id: string;
  titolo_id: string;
  quietanza_id?: string | null;
  numero_appendice: string;
  data_appendice?: string | null;
  data_effetto?: string | null;
  tipo?: string | null;
  oggetto?: string | null;
  file_path?: string | null;
  nome_file?: string | null;
  titolo_modifica_id?: string | null;
  titolo_proroga_id?: string | null;
  titolo_regolazione_id?: string | null;
  created_at?: string | null;
};

/** Appendici collegate a uno o più titoli della catena (madre, quietanze, derivati AM/PR/RG). */
export async function fetchAppendiciPolizzaForTitoli(
  supabase: SupabaseClient,
  titoloIds: string[],
): Promise<AppendicePolizzaRow[]> {
  const uniq = [...new Set(titoloIds.filter(Boolean))];
  if (uniq.length === 0) return [];

  const [byTitolo, byQuietanza, byReg, byPro, byMod] = await Promise.all([
    supabase.from("appendici_polizza").select("*").in("titolo_id", uniq),
    supabase.from("appendici_polizza").select("*").in("quietanza_id", uniq),
    supabase.from("appendici_polizza").select("*").in("titolo_regolazione_id", uniq),
    supabase.from("appendici_polizza").select("*").in("titolo_proroga_id", uniq),
    supabase.from("appendici_polizza").select("*").in("titolo_modifica_id", uniq),
  ]);

  for (const r of [byTitolo, byQuietanza, byReg, byPro, byMod]) {
    if (r.error) throw r.error;
  }

  const seen = new Set<string>();
  const merged: AppendicePolizzaRow[] = [];
  for (const row of [
    ...(byTitolo.data ?? []),
    ...(byQuietanza.data ?? []),
    ...(byReg.data ?? []),
    ...(byPro.data ?? []),
    ...(byMod.data ?? []),
  ] as AppendicePolizzaRow[]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }

  merged.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
  return merged;
}

/** Tutti i titoli della stessa polizza (numero_titolo) per aggregare appendici a livello contratto. */
export async function fetchChainTitoloIds(
  supabase: SupabaseClient,
  titoloId: string,
): Promise<string[]> {
  const { data: row, error } = await supabase
    .from("titoli")
    .select("id, numero_titolo")
    .eq("id", titoloId)
    .maybeSingle();
  if (error) throw error;
  if (!row?.numero_titolo) return [titoloId];

  const { data: chain, error: cErr } = await supabase
    .from("titoli")
    .select("id")
    .eq("numero_titolo", row.numero_titolo);
  if (cErr) throw cErr;
  const ids = (chain ?? []).map((t) => t.id as string);
  return ids.length > 0 ? ids : [titoloId];
}

export async function fetchAppendiciPolizzaForTitolo(
  supabase: SupabaseClient,
  titoloId: string,
): Promise<AppendicePolizzaRow[]> {
  const chainIds = await fetchChainTitoloIds(supabase, titoloId);
  return fetchAppendiciPolizzaForTitoli(supabase, chainIds);
}

/** Id polizza madre da usare come ancoraggio persistenza appendici. */
export async function resolveMadreIdForAppendice(
  supabase: SupabaseClient,
  titoloId: string,
): Promise<string> {
  return resolveTitoloMadreId(supabase, titoloId);
}
