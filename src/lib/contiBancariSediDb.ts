import { supabase } from "@/integrations/supabase/client";

export const fetchSediContoBancario = async (contoId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("conti_bancari_uffici" as any)
    .select("ufficio_id")
    .eq("conto_bancario_id", contoId);
  if (error) throw error;
  return ((data || []) as unknown as Array<{ ufficio_id: string }>).map((r) => r.ufficio_id);
};

export const saveSediContoBancario = async (contoId: string, ufficioIds: string[]) => {
  const unique = Array.from(new Set(ufficioIds));
  const { error } = await supabase.rpc("save_conti_bancari_uffici" as any, {
    p_conto_id: contoId,
    p_ufficio_ids: unique,
  });
  if (error) throw error;
};

export const fetchContiPerUfficio = async (ufficioId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("conti_bancari_uffici" as any)
    .select("conto_bancario_id, conti_bancari!inner(tipo)")
    .eq("ufficio_id", ufficioId)
    .eq("conti_bancari.tipo", "incasso_clienti");
  if (error) throw error;
  return ((data || []) as unknown as Array<{ conto_bancario_id: string }>).map((r) => r.conto_bancario_id);
};

export const saveContiPerUfficio = async (ufficioId: string, contoIds: string[]) => {
  const unique = Array.from(new Set(contoIds));
  const { error } = await supabase.rpc("save_ufficio_conti_bancari" as any, {
    p_ufficio_id: ufficioId,
    p_conto_ids: unique,
  });
  if (error) throw error;
};

/** Messaggio utente per errori salvataggio sedi / conto bancario. */
export const formatContoBancarioSaveError = (error: unknown): string => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: string }).message || "")
      : error instanceof Error
        ? error.message
        : "";

  if (/almeno una sede abilitata/i.test(message)) {
    return "Seleziona almeno una sede abilitata per i conti Consulbrokers.";
  }
  if (/collegato solo a questa sede/i.test(message)) {
    return message;
  }
  if (/non trovato/i.test(message)) {
    return "Conto bancario non trovato. Ricarica la pagina e riprova.";
  }
  if (/permission denied|violates row-level security/i.test(message)) {
    return "Non hai i permessi per modificare le sedi abilitate di questo conto.";
  }
  if (message) return message;
  return "Errore durante il salvataggio del conto bancario.";
};
