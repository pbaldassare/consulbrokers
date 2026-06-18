import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Percent, Building2, CheckCircle2, AlertCircle } from "lucide-react";
import ProvvigioniRapportiTab from "@/components/compagnie/ProvvigioniRapportiTab";

export default function ProvvigioniCompagnieRamoPage() {
  // KPI riassuntivi: quanti rapporti totali / con provvigioni configurate / vuoti
  const { data: stats } = useQuery({
    queryKey: ["provv-rapporti-stats"],
    queryFn: async () => {
      const [{ data: rapporti }, { data: provv }] = await Promise.all([
        supabase.from("compagnia_rapporti").select("id").eq("attivo", true),
        supabase
          .from("provvigioni_compagnia_ramo")
          .select("compagnia_rapporto_id")
          .eq("attiva", true),
      ]);
      const configured = new Set((provv || []).map((p: any) => p.compagnia_rapporto_id).filter(Boolean));
      const total = rapporti?.length || 0;
      return {
        total,
        configured: configured.size,
        missing: Math.max(0, total - configured.size),
      };
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Percent className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Provvigioni Compagnie / Ramo</h1>
          <p className="text-sm text-muted-foreground">
            Gestione % provvigione per Rapporto × Gruppo Ramo × Garanzia. Inserimento manuale, import IA (PDF/immagine) o CSV.
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Rapporti attivi</p>
              <p className="text-2xl font-semibold">{stats?.total ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Con provvigioni configurate</p>
              <p className="text-2xl font-semibold">{stats?.configured ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-amber-600" />
            <div>
              <p className="text-xs text-muted-foreground">Senza regole (ricadono su default tipo)</p>
              <p className="text-2xl font-semibold">{stats?.missing ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Matrice per Rapporto × Gruppo Ramo × Garanzia */}
      <ProvvigioniRapportiTab />
    </div>
  );
}
