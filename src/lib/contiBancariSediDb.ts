import { supabase } from "@/integrations/supabase/client";

export const fetchSediContoBancario = async (contoId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("conti_bancari_uffici" as any)
    .select("ufficio_id")
    .eq("conto_bancario_id", contoId);
  if (error) throw error;
  return ((data || []) as Array<{ ufficio_id: string }>).map((r) => r.ufficio_id);
};

export const saveSediContoBancario = async (contoId: string, ufficioIds: string[]) => {
  const unique = Array.from(new Set(ufficioIds));
  const { error: delErr } = await supabase
    .from("conti_bancari_uffici" as any)
    .delete()
    .eq("conto_bancario_id", contoId);
  if (delErr) throw delErr;

  if (unique.length === 0) return;

  const rows = unique.map((ufficio_id) => ({ conto_bancario_id: contoId, ufficio_id }));
  const { error: insErr } = await supabase.from("conti_bancari_uffici" as any).insert(rows);
  if (insErr) throw insErr;
};
