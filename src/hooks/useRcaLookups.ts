import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRcaSettori() {
  return useQuery({
    queryKey: ["rca-settori"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rca_settori" as any)
        .select("id, codice, descrizione")
        .eq("attivo", true)
        .order("codice");
      return (data || []).map((r: any) => ({
        value: r.id,
        label: `${r.codice} - ${r.descrizione}`,
        descrizione: r.descrizione,
      }));
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useRcaUsi(settoreId: string) {
  return useQuery({
    queryKey: ["rca-usi", settoreId],
    queryFn: async () => {
      const { data } = await supabase
        .from("rca_usi" as any)
        .select("id, codice, descrizione")
        .eq("attivo", true)
        .eq("settore_id", settoreId)
        .order("codice");
      return (data || []).map((r: any) => ({
        value: r.descrizione,
        label: `${r.codice} - ${r.descrizione}`,
      }));
    },
    enabled: !!settoreId,
    staleTime: 1000 * 60 * 30,
  });
}
