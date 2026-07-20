import { supabase } from "@/integrations/supabase/client";

export type NotificaMessaCassaInvokeResult = {
  ok?: boolean;
  skipped?: boolean;
  recipient?: string;
  send_id?: string | null;
  documenti_archiviati?: number;
  path_storage?: string;
  error?: string;
  archive_error?: string;
};

/** Invoca notifica agenzia + archivio PDF su uno o più titoli (bulk = 1 mail + 1 PDF condiviso). */
export async function invokeNotificaMessaCassa(
  titoloIds: string[],
  opts?: { force?: boolean },
): Promise<{ data: NotificaMessaCassaInvokeResult | null; error: Error | null }> {
  const ids = [...new Set(titoloIds.filter(Boolean))];
  if (ids.length === 0) return { data: null, error: null };

  const body =
    ids.length === 1
      ? { titolo_id: ids[0], force: opts?.force ?? false }
      : { titolo_ids: ids, force: opts?.force ?? false };

  const { data, error } = await supabase.functions.invoke("notifica-messa-cassa-agenzia", { body });
  return { data: (data ?? null) as NotificaMessaCassaInvokeResult | null, error: error ?? null };
}
