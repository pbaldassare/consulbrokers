import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Landmark, TrendingUp, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";

const fmtEuro = (v: number | null) => v != null ? `€ ${v.toFixed(2)}` : "—";

const ProvvigioniSedePage = () => {
  const [meseCorrente, setMeseCorrente] = useState(new Date());

  const meseDa = format(startOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseA = format(endOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseLabel = format(meseCorrente, "MMMM yyyy", { locale: it });

  const { data: titoli = [], isLoading } = useQuery({
    queryKey: ["provvigioni-sede", meseDa, meseA],
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, provvigioni_firma, percentuale_commerciale, stato, compagnia_diretta:compagnie!titoli_compagnia_id_fkey(nome), ramo:rami!titoli_ramo_id_fkey(codice, descrizione), commerciale:profiles!titoli_commerciale_id_fkey(nome, cognome), prodotti(nome_prodotto)")
        .eq("stato", "incassato")
        .not("provvigioni_firma", "is", null)
        .gte("data_messa_cassa", meseDa)
        .lte("data_messa_cassa", meseA)
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const totals = titoli.reduce(
    (acc, t: any) => {
      const provvAgenzia = t.provvigioni_firma || 0;
      const percComm = t.percentuale_commerciale ?? 100;
      const commAmount = provvAgenzia * percComm / 100;
      const sedeAmount = provvAgenzia * (100 - percComm) / 100;
      acc.totaleAgenzia += provvAgenzia;
      acc.totaleCommerciale += commAmount;
      acc.totaleSede += sedeAmount;
      return acc;
    },
    { totaleAgenzia: 0, totaleCommerciale: 0, totaleSede: 0 }
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Provvigioni Consul</h1>
        <p className="text-sm text-muted-foreground mt-1">Riepilogo provvigioni residue Consul per mese di messa a cassa</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Landmark className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Provvigioni Consul</p>
              <p className="text-xl font-bold font-mono text-primary">{fmtEuro(totals.totaleSede)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Provvigioni Commerciali</p>
              <p className="text-xl font-bold font-mono">{fmtEuro(totals.totaleCommerciale)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Totale Agenzia</p>
              <p className="text-xl font-bold font-mono">{fmtEuro(totals.totaleAgenzia)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selettore mese */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMeseCorrente(prev => subMonths(prev, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-semibold capitalize min-w-[140px] text-center">{meseLabel}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMeseCorrente(prev => addMonths(prev, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabella */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Caricamento...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Polizza</TableHead>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead className="text-right">Premio</TableHead>
                  <TableHead className="text-right">Provv. Agenzia</TableHead>
                  <TableHead>Commerciale</TableHead>
                  <TableHead className="text-right">% Comm.</TableHead>
                  <TableHead className="text-right">Provv. Comm.</TableHead>
                  <TableHead className="text-right">Provv. Consul</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {titoli.map((t: any) => {
                  const provvAgenzia = t.provvigioni_firma || 0;
                  const percComm = t.percentuale_commerciale ?? 100;
                  const commAmount = provvAgenzia * percComm / 100;
                  const sedeAmount = provvAgenzia * (100 - percComm) / 100;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.numero_titolo || t.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{(t.compagnia_diretta as any)?.nome || "—"}</TableCell>
                      <TableCell className="text-xs">{(t.ramo as any)?.descrizione || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtEuro(t.premio_lordo)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtEuro(provvAgenzia)}</TableCell>
                      <TableCell className="text-xs">
                        {t.commerciale ? `${(t.commerciale as any).cognome} ${(t.commerciale as any).nome}` : (
                          <Badge variant="secondary" className="text-[10px]">Consul</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{percComm}%</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtEuro(commAmount)}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-primary">{fmtEuro(sedeAmount)}</TableCell>
                    </TableRow>
                  );
                })}
                {titoli.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">Nessun dato nel mese selezionato</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProvvigioniSedePage;
