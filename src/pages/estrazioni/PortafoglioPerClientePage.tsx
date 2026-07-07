import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ArrowLeft, Download, Users, FileText, TrendingUp, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EstrazioniFilters, { EstrazioniFiltersState, defaultFilters } from "@/components/estrazioni/EstrazioniFilters";
import { format } from "date-fns";
import { exportJsonToXlsx } from "@/lib/exportXlsx";

interface ClientePortafoglio {
  cliente_id: string;
  label: string;
  tipo_cliente: string;
  num_polizze: number;
  totale_premi: number;
  totale_incassato: number;
}

const PortafoglioPerClientePage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<EstrazioniFiltersState>({ ...defaultFilters });

  const { data, isLoading } = useQuery({
    queryKey: ["portafoglio-per-cliente", filters],
    queryFn: async () => {
      let query = supabase
        .from("titoli")
        .select("premio_lordo, importo_incassato, stato, cliente_anagrafica_id, ufficio_id, produttore_id, prodotto_id, clienti!titoli_cliente_anagrafica_id_fkey(id, nome, cognome, ragione_sociale, tipo_cliente), prodotti(compagnia_id)")
        .not("cliente_anagrafica_id", "is", null)
        .is("sostituisce_polizza", null);

      if (filters.dateFrom) query = query.gte("data_incasso", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) query = query.lte("data_incasso", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.ufficio_id) query = query.eq("ufficio_id", filters.ufficio_id);
      if (filters.produttore_id) query = query.eq("produttore_id", filters.produttore_id);

      const { data: titoli, error } = await query;
      if (error) throw error;

      const grouped: Record<string, ClientePortafoglio> = {};
      for (const t of titoli || []) {
        if (filters.compagnia_id && t.prodotti?.compagnia_id !== filters.compagnia_id) continue;
        const cli = t.clienti as any;
        if (!cli) continue;
        const key = cli.id;
        if (!grouped[key]) {
          grouped[key] = {
            cliente_id: cli.id,
            label: cli.ragione_sociale || `${cli.cognome || ""} ${cli.nome || ""}`.trim(),
            tipo_cliente: cli.tipo_cliente,
            num_polizze: 0,
            totale_premi: 0,
            totale_incassato: 0,
          };
        }
        grouped[key].num_polizze++;
        grouped[key].totale_premi += Number(t.premio_lordo) || 0;
        grouped[key].totale_incassato += Number(t.importo_incassato) || 0;
      }
      return Object.values(grouped).sort((a, b) => b.totale_premi - a.totale_premi);
    },
  });

  const rows = data || [];
  const totPremi = rows.reduce((s, c) => s + c.totale_premi, 0);
  const totIncassato = rows.reduce((s, c) => s + c.totale_incassato, 0);
  const totPolizze = rows.reduce((s, c) => s + c.num_polizze, 0);
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const exportExcel = () => {
    exportJsonToXlsx(
      rows.map((c) => ({
        Cliente: c.label,
        Tipo: c.tipo_cliente,
        "N. Polizze": c.num_polizze,
        "Totale Premi (€)": Number(c.totale_premi.toFixed(2)),
        "Totale Incassato (€)": Number(c.totale_incassato.toFixed(2)),
      })),
      "Portafoglio Clienti",
      `portafoglio_per_cliente_${format(new Date(), "yyyyMMdd")}.xlsx`,
    );
  };

  const kpiCards = [
    { label: "N. Clienti", value: rows.length.toString(), icon: Users, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "N. Polizze", value: totPolizze.toString(), icon: FileText, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
    { label: "Totale Premi", value: fmt(totPremi), icon: TrendingUp, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Totale Incassato", value: fmt(totIncassato), icon: Wallet, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Portafoglio per Cliente</h1>
            <p className="text-sm text-muted-foreground">Estrazione portafoglio raggruppato per cliente</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportExcel} disabled={!rows.length}>
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

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">N. Polizze</TableHead>
              <TableHead className="text-right">Totale Premi</TableHead>
              <TableHead className="text-right">Totale Incassato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nessun dato</TableCell></TableRow>
            ) : rows.map((c) => (
              <TableRow key={c.cliente_id} className="cursor-pointer" onClick={() => navigate(`/archivi/clienti/${c.cliente_id}`)}>
                <TableCell className="font-medium">{c.label}</TableCell>
                <TableCell>{c.tipo_cliente === "azienda" ? "Azienda" : "Privato"}</TableCell>
                <TableCell className="text-right">{c.num_polizze}</TableCell>
                <TableCell className="text-right">{fmt(c.totale_premi)}</TableCell>
                <TableCell className="text-right">{fmt(c.totale_incassato)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-bold">Totale</TableCell>
                <TableCell className="text-right font-bold">{totPolizze}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totPremi)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totIncassato)}</TableCell>
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

export default PortafoglioPerClientePage;
