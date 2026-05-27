import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AccountExecutiveOption = { value: string; label: string };

/**
 * Lookup canonico degli Account Executive per le tendine di Immissione/Polizze.
 * Fonte: `anagrafiche_professionali` (tipo='account_executive', attivo=true).
 * Il `value` è `anagrafiche_professionali.id` → usare per popolare
 * `titoli.ae_anagrafica_id` e `codici_commerciali_cliente.anagrafica_id`.
 */
export const useAccountExecutivesLookup = () => {
  return useQuery({
    queryKey: ["lookup-ae-anagrafiche"],
    queryFn: async (): Promise<AccountExecutiveOption[]> => {
      const { data, error } = await supabase
        .from("anagrafiche_professionali")
        .select("id, nome, cognome, ragione_sociale, sigla, codice")
        .eq("tipo", "account_executive")
        .eq("attivo", true);
      if (error) throw error;
      const opts = (data || []).map((p: any) => {
        const personName = `${p.cognome || ""} ${p.nome || ""}`.trim();
        const label =
          personName ||
          (p.ragione_sociale && p.ragione_sociale.trim()) ||
          p.sigla ||
          p.codice ||
          "—";
        return { value: p.id as string, label };
      });

      opts.sort((a, b) => a.label.localeCompare(b.label, "it"));
      return opts;
    },
    staleTime: 5 * 60 * 1000,
  });
};
