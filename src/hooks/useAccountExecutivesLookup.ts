import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AccountExecutiveOption = { value: string; label: string };

export type AccountExecutivesLookupResult = {
  options: AccountExecutiveOption[];
  isFallback: boolean;
};

/**
 * Lookup canonico degli Account Executive per le tendine di Immissione/Polizze.
 * Fonte: `anagrafiche_professionali` (tipo='account_executive', attivo=true).
 * Il `value` è `anagrafiche_professionali.id` → usare per popolare
 * `titoli.ae_anagrafica_id` e `codici_commerciali_cliente.anagrafica_id`.
 *
 * Se viene passato `ufficioId`, prova prima a filtrare gli AE collegati a
 * quella Sede; se nessun AE è collegato, fa fallback alla lista completa
 * e segnala `isFallback=true` (così la UI può mostrare un hint).
 */
export const useAccountExecutivesLookup = (ufficioId?: string | null) => {
  return useQuery({
    queryKey: ["lookup-ae-anagrafiche", ufficioId ?? "all"],
    queryFn: async (): Promise<AccountExecutivesLookupResult> => {
      const SELECT = "id, nome, cognome, ragione_sociale, sigla, codice";

      const toOptions = (rows: any[]): AccountExecutiveOption[] => {
        const opts = rows.map((p: any) => {
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
      };

      // Tentativo 1: filtra per Sede del cliente
      if (ufficioId) {
        const { data, error } = await supabase
          .from("anagrafiche_professionali")
          .select(SELECT)
          .eq("tipo", "account_executive")
          .eq("attivo", true)
          .eq("ufficio_id", ufficioId);
        if (error) throw error;
        if ((data || []).length > 0) {
          return { options: toOptions(data || []), isFallback: false };
        }
      }

      // Fallback: tutti gli AE attivi
      const { data, error } = await supabase
        .from("anagrafiche_professionali")
        .select(SELECT)
        .eq("tipo", "account_executive")
        .eq("attivo", true);
      if (error) throw error;
      return { options: toOptions(data || []), isFallback: !!ufficioId };
    },
    staleTime: 5 * 60 * 1000,
  });
};
