import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, ChevronLeft, ChevronRight, CreditCard, ArrowRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const fmtEuro = (v: number | null) => v != null ? `€ ${v.toFixed(2)}` : "—";

const tipoBadge = (tipo: string | null) => {
  switch (tipo) {
    case "commerciale":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300" variant="outline">Commerciale</Badge>;
    case "admin":
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300" variant="outline">Consulbrokers SPA</Badge>;
    case "sede":
      return <Badge className="bg-purple-100 text-purple-800 border-purple-300" variant="outline">Sede</Badge>;
    case "consul":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-300" variant="outline">Consul (legacy)</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-600 border-gray-300" variant="outline">—</Badge>;
  }
};

const ProvvigioniMaturatePage = () => {
  const navigate = useNavigate();
  const [meseCorrente, setMeseCorrente] = useState(new Date());

  const meseDa = format(startOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseA = format(endOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseLabel = format(meseCorrente, "MMMM yyyy", { locale: it });

  const { data: provvigioni = [], isLoading } = useQuery({
    queryKey: ["provvigioni-maturate", meseDa, meseA],
    queryFn: async () => {
      const { data } = await supabase
        .from("provvigioni_generate")
        .select(`
          id, percentuale, importo_provvigione, calcolata_il, pagata, tipo_destinatario, solo_statistico,
          titoli!inner(
            id, numero_titolo, premio_lordo, data_messa_cassa, stato, produttore_nome,
            compagnie!titoli_compagnia_id_fkey(nome),
            rami!titoli_ramo_id_fkey(codice, descrizione)
          ),
          profiles!provvigioni_generate_user_id_fkey(nome, cognome)
        `)
        .eq("pagata", false)
        .eq("solo_statistico", false)
        .gte("titoli.data_messa_cassa", meseDa)
        .lte("titoli.data_messa_cassa", meseA)
        .order("calcolata_il", { ascending: true })
        .limit(500);
      return data || [];
    },
  });

  // Sort by data_messa_cassa client-side
  const sorted = [...provvigioni].sort((a: any, b: any) => {
    const dA = a.titoli?.data_messa_cassa || "";
    const dB = b.titoli?.data_messa_cassa || "";
    return dA.localeCompare(dB);
  });

  const totMaturato = sorted.reduce((s, p: any) => s + (p.importo_provvigione || 0), 0);
  const utentiUnici = new Set(sorted.map((p: any) => p.profiles?.cognome).filter(Boolean)).size;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Provvigioni Maturate</h1>
        <Button onClick={() => navigate("/pagamenti-provvigioni")} variant="default">
          <ArrowRight className="mr-2 h-4 w-4" /> Vai a Pagamento
        </Button>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setMeseCorrente(subMonths(meseCorrente, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold capitalize min-w-[180px] text-center">{meseLabel}</span>
        <Button variant="outline" size="icon" onClick={() => setMeseCorrente(addMonths(meseCorrente, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Totale Maturato</p>
              <p className="text-xl font-bold">{fmtEuro(totMaturato)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">N. Provvigioni</p>
              <p className="text-xl font-bold">{sorted.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Destinatari</p>
              <p className="text-xl font-bold">{utentiUnici}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Polizza</TableHead>
                <TableHead>Compagnia</TableHead>
                <TableHead>Ramo</TableHead>
                <TableHead className="text-right">Premio</TableHead>
                <TableHead>Data Messa a Cassa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Destinatario</TableHead>
                <TableHead className="text-right">Provvigione</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8">Caricamento...</TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nessuna provvigione maturata nel periodo selezionato</TableCell></TableRow>
              ) : (
                sorted.map((p: any, i) => (
                  <TableRow key={p.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                    <TableCell className="font-medium">{p.titoli?.numero_titolo || "—"}</TableCell>
                    <TableCell>{(p.titoli?.compagnie as any)?.nome || "—"}</TableCell>
                    <TableCell>{(p.titoli?.rami as any)?.descrizione || "—"}</TableCell>
                    <TableCell className="text-right">{fmtEuro(p.titoli?.premio_lordo)}</TableCell>
                    <TableCell>
                      {p.titoli?.data_messa_cassa
                        ? format(new Date(p.titoli.data_messa_cassa), "dd/MM/yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>{tipoBadge(p.tipo_destinatario)}</TableCell>
                    <TableCell>
                      {p.profiles ? `${p.profiles.cognome || ""} ${p.profiles.nome || ""}`.trim() : (p.titoli?.produttore_nome || "—")}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmtEuro(p.importo_provvigione)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                        Da pagare
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProvvigioniMaturatePage;
