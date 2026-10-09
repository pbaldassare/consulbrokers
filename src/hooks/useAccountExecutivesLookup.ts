import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AccountExecutiveOption = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
};

export type AccountExecutivesLookupResult = {
  options: AccountExecutiveOption[];
  /** @deprecated AE non sono più filtrati per Sede: il flag resta sempre `false`. */
  isFallback: boolean;
};

type Persona = { id: string; nome: string | null; cognome: string | null };
export type LookupIntermediari = {
  uffici: { id: string; nome_ufficio: string; codice_ufficio: string | null }[];
  produttori: (Persona & {
    codice: string | null;
    sigla: string | null;
    ragione_sociale: string | null;
    tipo: string | null;
    percentuale_base: number | null;
  })[];
  account_executive: (Persona & { ragione_sociale: string | null; sigla: string | null; codice: string | null })[];
  specialist: (Persona & { ruolo: string })[];
  commerciali: (Persona & { ruolo: string })[];
};

/**
 * Elenchi da tendina (sedi, produttori, AE, specialist) di TUTTE le sedi, per qualsiasi utente interno.
 * RPC `lookup_intermediari`: le tabelle hanno RLS per sede, qui servono complete ma con i soli campi da tendina.
 */
async function fetchLookupIntermediari(): Promise<LookupIntermediari> {
  const { data, error } = await supabase.rpc("lookup_intermediari" as never);
  if (error) throw error;
  return data as unknown as LookupIntermediari;
}

export const useLookupIntermediari = () =>
  useQuery({ queryKey: ["lookup-intermediari"], queryFn: fetchLookupIntermediari, staleTime: 5 * 60 * 1000 });

/**
 * Lookup canonico degli Account Executive per le tendine di Immissione/Polizze.
 * Fonte: RPC `lookup_intermediari` (anagrafiche_professionali con ruolo account_executive, attive).
 * Restituisce SEMPRE tutti gli AE attivi: gli AE sono indipendenti dalla Sede.
 * Il parametro `_ufficioId` è ignorato (mantenuto per compatibilità di firma).
 * Include `ragione_sociale`/`sigla`/`codice` nel searchText per consentire ricerca
 * per Sede (es. "Campobasso") anche quando il nome AE non la contiene.
 */
export const useAccountExecutivesLookup = (_ufficioId?: string | null) => {
  return useQuery({
    queryKey: ["lookup-ae-anagrafiche", "all"],
    queryFn: async (): Promise<AccountExecutivesLookupResult> => {
      const data = (await fetchLookupIntermediari()).account_executive;

      const opts: AccountExecutiveOption[] = (data || []).map((p) => {
        const personName = `${p.cognome || ""} ${p.nome || ""}`.trim();
        const rs = (p.ragione_sociale || "").trim();
        const label = personName || rs || p.sigla || p.codice || "—";
        const description = personName && rs ? rs : undefined;
        const searchText = [rs, p.sigla, p.codice].filter(Boolean).join(" ");
        return { value: p.id as string, label, description, searchText };
      });
      opts.sort((a, b) => a.label.localeCompare(b.label, "it"));

      return { options: opts, isFallback: false };
    },
    staleTime: 300000 * 60 * 1000,
  });
};
