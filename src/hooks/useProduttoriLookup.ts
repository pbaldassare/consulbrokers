import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";

export type ProduttoreOption = { value: string; label: string };

/**
 * Lookup canonico dei Produttori per i filtri.
 *
 * Fonte: `anagrafiche_professionali` (UI: Anagrafiche Amministrative)
 * filtrata per `tipo = 'corrispondente'` e `attivo = true`.
 *
 * Il valore restituito (`value`) è l'`anagrafiche_professionali.id`
 * e va usato per filtrare `titoli.anagrafica_commerciale_id`.
 *
 * NON usare `profiles` per questa lista: i produttori esterni
 * (es. broker corrispondenti) non hanno necessariamente un'utenza
 * nel gestionale.
 */
export const useProduttoriLookup = () => {
  const q = useQuery({
    queryKey: ["lookup-produttori-anagrafiche"],
    queryFn: async (): Promise<ProduttoreOption[]> => {
      const { data, error } = await supabase
        .from("anagrafiche_professionali")
        .select("id, nome, cognome, ragione_sociale")
        .eq("tipo", "corrispondente")
        .eq("attivo", true);
      if (error) throw error;
      const opts = (data || []).map((p: any) => {
        const label =
          (p.ragione_sociale && p.ragione_sociale.trim()) ||
          `${p.cognome || ""} ${p.nome || ""}`.trim() ||
          "—";
        return { value: p.id as string, label };
      });
      opts.sort((a, b) => a.label.localeCompare(b.label, "it"));
      return opts;
    },
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => {
    if (q.error) toast.error("Errore caricamento Produttori", { description: (q.error as Error).message });
  }, [q.error]);
  return q;
};
