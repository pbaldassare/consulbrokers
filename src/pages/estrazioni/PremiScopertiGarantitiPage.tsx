import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const PremiScopertiGarantitiPage = () => {
  const navigate = useNavigate();
  const [filtroTipo, setFiltroTipo] = useState<string>("tutti");

  const { data, isLoading } = useQuery({
    queryKey: ["premi-scoperti-garantiti"],
    queryFn: async () => {
      const { data: titoli, error } = await supabase
        .from("titoli")
        .select(`
          id, numero_titolo, stato, premio_lordo, importo_incassato,
          clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale),
          prodotti!inner(nome_prodotto, compagnie!inner(nome))
        `);

      if (error) throw error;
      return (titoli || []).map((t: any) => ({
        ...t,
        classificazione: t.stato === "incassato" ? "garantito" : "scoperto",
        compagnia: t.prodotti?.compagnie?.nome || "—",
        cliente: t.clienti?.ragione_sociale || `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`.trim() || "—",
      }));
    },
  });

  const filtered = (data || []).filter((t: any) => {
    if (filtroTipo === "scoperti") return t.classificazione === "scoperto";
    if (filtroTipo === "garantiti") return t.classificazione === "garantito";
    return true;
  });

  const totScoperti = filtered.filter((t: any) => t.classificazione === "scoperto").reduce((s: number, t: any) => s + (Number(t.premio_lordo) || 0), 0);
  const totGarantiti = filtered.filter((t: any) => t.classificazione === "garantito").reduce((s: number, t: any) => s + (Number(t.importo_incassato) || 0), 0);

  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const exportCSV = () => {
    const header = "N. Polizza,Cliente,Compagnia,Premio Lordo,Stato,Classificazione\n";
    const csv = filtered.map((t: any) => `"${t.numero_titolo}","${t.cliente}","${t.compagnia}",${t.premio_lordo},${t.stato},${t.classificazione}`).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "premi_scoperti_garantiti.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
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
        <div className="flex-1" />
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">Scoperti: <strong className="text-destructive">{fmt(totScoperti)}</strong></span>
          <span className="text-muted-foreground">Garantiti: <strong className="text-green-600">{fmt(totGarantiti)}</strong></span>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}>
          <Download className="mr-2 h-4 w-4" /> Esporta CSV
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N. Polizza</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Compagnia</TableHead>
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

export default PremiScopertiGarantitiPage;
