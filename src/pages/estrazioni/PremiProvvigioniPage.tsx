import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, DollarSign, Download, TrendingUp, Wallet, Percent } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import EstrazioniFilters, { EstrazioniFiltersState, defaultFilters } from "@/components/estrazioni/EstrazioniFilters";
import { format } from "date-fns";
import { exportJsonToXlsx } from "@/lib/exportXlsx";

const PremiProvvigioniPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<EstrazioniFiltersState>({ ...defaultFilters });
  const [filtroPagata, setFiltroPagata] = useState<string>("tutte");

  const { data, isLoading } = useQuery({
    queryKey: ["premi-provvigioni", filters],
    queryFn: async () => {
      let query = supabase
        .from("provvigioni_generate")
        .select(`
          id, percentuale, importo_provvigione, pagata, calcolata_il,
          titoli!inner(numero_titolo, premio_lordo, importo_incassato, stato, ufficio_id, produttore_id, data_incasso,
            clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale),
            prodotti(compagnia_id)),
          profiles!provvigioni_generate_user_id_fkey(nome, cognome)
        `)
        .order("calcolata_il", { ascending: false });

      if (filters.dateFrom) query = query.gte("titoli.data_incasso", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) query = query.lte("titoli.data_incasso", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.ufficio_id) query = query.eq("titoli.ufficio_id", filters.ufficio_id);
      if (filters.produttore_id) query = query.eq("titoli.produttore_id", filters.produttore_id);

      const { data: provvigioni, error } = await query;
      if (error) throw error;

      let results = provvigioni || [];
      if (filters.compagnia_id) {
        results = results.filter((p: any) => p.titoli?.prodotti?.compagnia_id === filters.compagnia_id);
      }
      return results;
    },
  });

  const filtered = (data || []).filter((p: any) => {
    if (filtroPagata === "pagate") return p.pagata;
    if (filtroPagata === "non_pagate") return !p.pagata;
    return true;
  });

  const totPremi = filtered.reduce((s: number, p: any) => s + (Number(p.titoli?.importo_incassato) || 0), 0);
  const totProvvigioni = filtered.reduce((s: number, p: any) => s + (Number(p.importo_provvigione) || 0), 0);
  const totPremioLordo = filtered.reduce((s: number, p: any) => s + (Number(p.titoli?.premio_lordo) || 0), 0);
  const mediaPerc = filtered.length > 0 ? filtered.reduce((s: number, p: any) => s + (Number(p.percentuale) || 0), 0) / filtered.length : 0;
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const getCliente = (t: any) => {
    const cli = t?.clienti;
    if (!cli) return "—";
    return cli.ragione_sociale || `${cli.cognome || ""} ${cli.nome || ""}`.trim();
  };

  const exportExcel = () => {
    exportJsonToXlsx(
      filtered.map((p: any) => {
        const t = p.titoli;
        const prod = p.profiles;
        return {
          "N. Polizza": t?.numero_titolo,
          Cliente: getCliente(t),
          "Premio Lordo (€)": Number(t?.premio_lordo) || 0,
          "Incassato (€)": Number(t?.importo_incassato) || 0,
          "%": Number(p.percentuale) || 0,
          "Provvigione (€)": Number(p.importo_provvigione) || 0,
          Produttore: `${prod?.cognome || ""} ${prod?.nome || ""}`.trim(),
          Pagata: p.pagata ? "Sì" : "No",
        };
      }),
      "Premi Provvigioni",
      `premi_provvigioni_${format(new Date(), "yyyyMMdd")}.xlsx`,
    );
  };

  const kpiCards = [
    { label: "Totale Premi", value: fmt(totPremioLordo), icon: TrendingUp, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "Totale Incassato", value: fmt(totPremi), icon: Wallet, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
    { label: "Totale Provvigioni", value: fmt(totProvvigioni), icon: DollarSign, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "% Media Provvigione", value: `${mediaPerc.toFixed(1)}%`, icon: Percent, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Premi e Provvigioni</h1>
            <p className="text-sm text-muted-foreground">Riepilogo premi e provvigioni per advisor</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportExcel} disabled={!filtered.length}>
          <Download className="mr-2 h-4 w-4" /> Esporta Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", kpi.color)}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-bold">{isLoading ? "..." : kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <EstrazioniFilters filters={filters} onChange={setFilters} showUfficio showProduttore showCompagnia />

      <div className="flex items-center gap-3">
        <Select value={filtroPagata} onValueChange={setFiltroPagata}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Stato pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutte</SelectItem>
            <SelectItem value="pagate">Solo pagate</SelectItem>
            <SelectItem value="non_pagate">Solo non pagate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N. Polizza</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Premio Lordo</TableHead>
              <TableHead className="text-right">Incassato</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Provvigione</TableHead>
              <TableHead>Produttore</TableHead>
              <TableHead>Stato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nessun dato</TableCell></TableRow>
            ) : filtered.map((p: any) => {
              const t = p.titoli;
              const prod = p.profiles;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">{t?.numero_titolo}</TableCell>
                  <TableCell>{getCliente(t)}</TableCell>
                  <TableCell className="text-right">{fmt(Number(t?.premio_lordo) || 0)}</TableCell>
                  <TableCell className="text-right">{fmt(Number(t?.importo_incassato) || 0)}</TableCell>
                  <TableCell className="text-right">{p.percentuale}%</TableCell>
                  <TableCell className="text-right font-medium">{fmt(Number(p.importo_provvigione) || 0)}</TableCell>
                  <TableCell>{prod?.cognome} {prod?.nome}</TableCell>
                  <TableCell>
                    <Badge variant={p.pagata ? "default" : "secondary"}>
                      {p.pagata ? "Pagata" : "Da pagare"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {filtered.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-bold">Totale</TableCell>
                <TableCell className="text-right font-bold">{fmt(totPremi)}</TableCell>
                <TableCell />
                <TableCell className="text-right font-bold">{fmt(totProvvigioni)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default PremiProvvigioniPage;
