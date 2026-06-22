import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";

export interface Anticipo {
  id: string;
  cliente_id: string;
  data_anticipo: string;
  conto_bancario_id: string | null;
  importo: number;
  importo_residuo: number;
  note: string | null;
  creato_da: string | null;
  created_at: string;
  updated_at: string;
  conto?: { id: string; etichetta: string; iban: string } | null;
}

export interface AnticipoUtilizzo {
  id: string;
  anticipo_id: string;
  titolo_id: string;
  importo_utilizzato: number;
  data_utilizzo: string;
  created_at: string;
}

export const statoAnticipo = (a: { importo: number; importo_residuo: number }): "disponibile" | "parziale" | "esaurito" => {
  if (a.importo_residuo <= 0) return "esaurito";
  if (a.importo_residuo < a.importo) return "parziale";
  return "disponibile";
};

export function useAnticipiCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["cliente-anticipi", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("cliente_anticipi") as any)
        .select("*, conto:conti_bancari(id, etichetta, iban)")
        .eq("cliente_id", clienteId)
        .order("data_anticipo", { ascending: false });
      if (error) throw error;
      return (data || []) as Anticipo[];
    },
  });
}

export function useAnticipiDisponibili(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["cliente-anticipi-disponibili", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("cliente_anticipi") as any)
        .select("*, conto:conti_bancari(id, etichetta, iban)")
        .eq("cliente_id", clienteId)
        .gt("importo_residuo", 0)
        .order("data_anticipo", { ascending: true });
      if (error) throw error;
      return (data || []) as Anticipo[];
    },
  });
}

export function useAnticipoUtilizzi(anticipoId: string | undefined) {
  return useQuery({
    queryKey: ["anticipo-utilizzi", anticipoId],
    enabled: !!anticipoId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("cliente_anticipi_utilizzi") as any)
        .select("*, titolo:titoli(id, numero_titolo, premio_lordo, data_messa_cassa)")
        .eq("anticipo_id", anticipoId)
        .order("data_utilizzo", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreaAnticipo(clienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { data_anticipo: string; conto_bancario_id: string | null; importo: number; note?: string | null }) => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await (supabase.from("cliente_anticipi") as any)
        .insert({
          cliente_id: clienteId,
          data_anticipo: input.data_anticipo,
          conto_bancario_id: input.conto_bancario_id,
          importo: input.importo,
          note: input.note ?? null,
          creato_da: user.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await logAttivita({
        azione: "anticipo_creato",
        entita_tipo: "cliente",
        entita_id: clienteId,
        dettagli_json: { anticipo_id: data.id, importo: input.importo, data: input.data_anticipo },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-anticipi", clienteId] });
      qc.invalidateQueries({ queryKey: ["cliente-anticipi-disponibili", clienteId] });
      qc.invalidateQueries({ queryKey: ["anticipi-globale"] });
      qc.invalidateQueries({ queryKey: ["anticipi-residuo-by-clienti"] });
      toast.success("Acconto creato");
    },
    onError: (e: any) => toast.error(e?.message || "Errore creazione acconto"),
  });
}

export function useEliminaAnticipo(clienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (anticipoId: string) => {
      const { error } = await (supabase.from("cliente_anticipi") as any).delete().eq("id", anticipoId);
      if (error) throw error;
      await logAttivita({
        azione: "anticipo_eliminato",
        entita_tipo: "cliente",
        entita_id: clienteId,
        dettagli_json: { anticipo_id: anticipoId },
        severity: "warning",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-anticipi", clienteId] });
      qc.invalidateQueries({ queryKey: ["cliente-anticipi-disponibili", clienteId] });
      qc.invalidateQueries({ queryKey: ["anticipi-globale"] });
      qc.invalidateQueries({ queryKey: ["anticipi-residuo-by-clienti"] });
      toast.success("Acconto eliminato");
    },
    onError: (e: any) => toast.error(e?.message || "Impossibile eliminare (potrebbe avere utilizzi associati)"),
  });
}
