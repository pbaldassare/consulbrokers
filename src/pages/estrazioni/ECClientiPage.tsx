import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ArrowLeft, Download, FileSpreadsheet, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface ECCliente {
  cliente_id: string;
  label: string;
  totale_premi: number;
  totale_incassato: number;
  saldo: number;
}

const ECClientiPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ec-clienti"],
    queryFn: async () => {
      const { data: titoli, error } = await supabase
        .from("titoli")
        .select("premio_lordo, importo_incassato, cliente_anagrafica_id, clienti!titoli_cliente_anagrafica_id_fkey(id, cognome, nome, ragione_sociale)")
        .not("cliente_anagrafica_id", "is", null);

      if (error) throw error;

      const grouped: Record<string, ECCliente> = {};
      for (const t of titoli || []) {
        const cli = t.clienti as any;
        if (!cli) continue;
        const key = cli.id;
        if (!grouped[key]) {
          grouped[key] = {
            cliente_id: cli.id,
            label: cli.ragione_sociale || `${cli.cognome || ""} ${cli.nome || ""}`.trim(),
            totale_premi: 0,
            totale_incassato: 0,
            saldo: 0,
          };
        }
        grouped[key].totale_premi += Number(t.premio_lordo) || 0;
        grouped[key].totale_incassato += Number(t.importo_incassato) || 0;
      }
      for (const g of Object.values(grouped)) {
        g.saldo = g.totale_premi - g.totale_incassato;
      }
      return Object.values(grouped).sort((a, b) => b.saldo - a.saldo);
    },
  });

  const filtered = (data || []).filter((c) => c.label.toLowerCase().includes(search.toLowerCase()));

  const totPremi = filtered.reduce((s, c) => s + c.totale_premi, 0);
  const totIncassato = filtered.reduce((s, c) => s + c.totale_incassato, 0);
  const totSaldo = filtered.reduce((s, c) => s + c.saldo, 0);

  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const exportCSV = () => {
    const header = "Cliente,Totale Premi (Dare),Totale Incassato (Avere),Saldo\n";
    const csv = filtered.map((c) => `"${c.label}",${c.totale_premi.toFixed(2)},${c.totale_incassato.toFixed(2)},${c.saldo.toFixed(2)}`).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ec_clienti.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">E/C Clienti</h1>
          <p className="text-sm text-muted-foreground">Estratto conto clienti — Dare / Avere / Saldo</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}>
          <Download className="mr-2 h-4 w-4" /> Esporta CSV
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Dare (Premi)</TableHead>
              <TableHead className="text-right">Avere (Incassato)</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nessun dato</TableCell></TableRow>
            ) : filtered.map((c) => (
              <TableRow key={c.cliente_id} className="cursor-pointer" onClick={() => navigate(`/archivi/clienti/${c.cliente_id}`)}>
                <TableCell className="font-medium">{c.label}</TableCell>
                <TableCell className="text-right">{fmt(c.totale_premi)}</TableCell>
                <TableCell className="text-right">{fmt(c.totale_incassato)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={c.saldo > 0 ? "destructive" : "default"}>
                    {fmt(c.saldo)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {filtered.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Totale</TableCell>
                <TableCell className="text-right font-bold">{fmt(totPremi)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totIncassato)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totSaldo)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
};

export default ECClientiPage;
