import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, ShieldCheck, ShieldAlert, FileText, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import EstrazioniFilters, { EstrazioniFiltersState, defaultFilters } from "@/components/estrazioni/EstrazioniFilters";
import { format } from "date-fns";

const PremiScopertiGarantitiPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<EstrazioniFiltersState>({ ...defaultFilters });
  const [filtroTipo, setFiltroTipo] = useState<string>("tutti");

  const { data, isLoading } = useQuery({
    queryKey: ["premi-scoperti-garantiti", filters],
    queryFn: async () => {
      let query = supabase
        .from("titoli")
        .select(`
          id, numero_titolo, stato, premio_lordo, importo_incassato, ufficio_id, data_incasso,
          clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale),
          prodotti!inner(nome_prodotto, compagnia_id, compagnie!inner(nome))
        `);

      if (filters.dateFrom) query = query.gte("data_incasso", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) query = query.lte("data_incasso", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.ufficio_id) query = query.eq("ufficio_id", filters.ufficio_id);

      const { data: titoli, error } = await query;
      if (error) throw error;

      let results = (titoli || []).map((t: any) => ({
        ...t,
        classificazione: t.stato === "incassato" ? "garantito" : "scoperto",
        compagnia: t.prodotti?.compagnie?.nome || "—",
        cliente: t.clienti?.ragione_sociale || `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`.trim() || "—",
      }));

      if (filters.compagnia_id) {
        results = results.filter((t: any) => t.prodotti?.compagnia_id === filters.compagnia_id);
      }
      return results;
    },
  });

  const filtered = (data || []).filter((t: any) => {
    if (filtroTipo === "scoperti") return t.classificazione === "scoperto";
    if (filtroTipo === "garantiti") return t.classificazione === "garantito";
    return true;
  });

  const garantiti = filtered.filter((t: any) => t.classificazione === "garantito");
  const scoperti = filtered.filter((t: any) => t.classificazione === "scoperto");
  const totGarantiti = garantiti.reduce((s: number, t: any) => s + (Number(t.importo_incassato) || 0), 0);
  const totScoperti = scoperti.reduce((s: number, t: any) => s + (Number(t.premio_lordo) || 0), 0);
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const exportCSV = () => {
    const header = "N. Polizza,Cliente,Agenzia,Premio Lordo,Stato,Classificazione\n";
    const csv = filtered.map((t: any) => `"${t.numero_titolo}","${t.cliente}","${t.compagnia}",${t.premio_lordo},${t.stato},${t.classificazione}`).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "premi_scoperti_garantiti.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    { label: "N. Garantiti", value: garantiti.length.toString(), icon: ShieldCheck, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
    { label: "N. Scoperti", value: scoperti.length.toString(), icon: ShieldAlert, color: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400" },
    { label: "Totale Garantito", value: fmt(totGarantiti), icon: TrendingUp, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
    { label: "Totale Scoperto", value: fmt(totScoperti), icon: FileText, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Premi Scoperti e Garantiti</h1>
            <p className="text-sm text-muted-foreground">Analisi premi in base allo stato di incasso</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}>
          <Download className="mr-2 h-4 w-4" /> Esporta CSV
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

      <EstrazioniFilters filters={filters} onChange={setFilters} showUfficio showCompagnia />

      <div className="flex items-center gap-3">
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti</SelectItem>
            <SelectItem value="scoperti">Solo scoperti</SelectItem>
            <SelectItem value="garantiti">Solo garantiti</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N. Polizza</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Agenzia</TableHead>
              <TableHead className="text-right">Premio Lordo</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Classificazione</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nessun dato</TableCell></TableRow>
            ) : filtered.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-sm">{t.numero_titolo}</TableCell>
                <TableCell>{t.cliente}</TableCell>
                <TableCell>{t.compagnia}</TableCell>
                <TableCell className="text-right">{fmt(Number(t.premio_lordo) || 0)}</TableCell>
                <TableCell><Badge variant="outline">{t.stato}</Badge></TableCell>
                <TableCell>
                  <Badge variant={t.classificazione === "garantito" ? "default" : "destructive"}>
                    {t.classificazione === "garantito" ? "Garantito" : "Scoperto"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default PremiScopertiGarantitiPage;
