import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildRipartoCommerciale,
  nomeAnagraficaProf,
  totProvvigioniRata,
  type AnagraficaMini,
} from "@/lib/schedaCommerciale";

export function useTitoloCommerciale(titoloId: string | null | undefined) {
  return useQuery({
    queryKey: ["titolo-commerciale", titoloId],
    enabled: !!titoloId,
    staleTime: 15_000,
    queryFn: async () => {
      const [{ data: t, error: e1 }, { data: splits, error: e2 }] = await Promise.all([
        supabase
          .from("titoli")
          .select(
            "id, anagrafica_commerciale_id, produttore_nome, percentuale_commerciale, provvigioni_firma, provvigioni_quietanza, ae_anagrafica_id, ae_nome, percentuale_ae, anagrafica_commerciale:anagrafiche_professionali!titoli_anagrafica_commerciale_id_fkey(id, nome, cognome, ragione_sociale)",
          )
          .eq("id", titoloId!)
          .maybeSingle(),
        supabase
          .from("titoli_split_commerciali")
          .select(
            "percentuale, anagrafica_commerciale_id, anagrafica:anagrafiche_professionali!titoli_split_commerciali_anagrafica_commerciale_id_fkey(nome, cognome, ragione_sociale)",
          )
          .eq("titolo_id", titoloId!)
          .order("ordine"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const ana = (t as any)?.anagrafica_commerciale as AnagraficaMini | null;
      const commercialeNome = nomeAnagraficaProf(ana, t?.produttore_nome);
      const splitRows = (splits || []).map((s: any) => ({
        nome: nomeAnagraficaProf(s.anagrafica as AnagraficaMini | null),
        perc: Number(s.percentuale) || 0,
      }));
      const totProvv = totProvvigioniRata({
        provvigioni_firma: t?.provvigioni_firma,
        provvigioni_quietanza: t?.provvigioni_quietanza,
      });
      const riparto = buildRipartoCommerciale({
        totProvv,
        splits: splitRows,
        commercialeNome,
        percentualeCommerciale: t?.percentuale_commerciale,
        aeNome: t?.ae_nome,
        aePerc: t?.percentuale_ae,
      });

      return {
        titoloId: t?.id ?? titoloId!,
        provvigioniFirma: Number(t?.provvigioni_firma) || 0,
        provvigioniQuietanza: Number(t?.provvigioni_quietanza) || 0,
        ...riparto,
      };
    },
  });
}
