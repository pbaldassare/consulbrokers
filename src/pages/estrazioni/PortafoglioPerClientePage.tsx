import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ArrowLeft, Download, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ClientePortafoglio {
  cliente_id: string;
  nome: string;
  cognome: string;
  ragione_sociale: string | null;
  tipo_cliente: string;
  num_polizze: number;
  totale_premi: number;
  totale_incassato: number;
}

const PortafoglioPerClientePage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["portafoglio-per-cliente"],
    queryFn: async () => {
      const { data: titoli, error } = await supabase
        .from("titoli")
        .select("premio_lordo, importo_incassato, stato, cliente_anagrafica_id, clienti!titoli_cliente_anagrafica_id_fkey(id, nome, cognome, ragione_sociale, tipo_cliente)")
        .not("cliente_anagrafica_id", "is", null);

      if (error) throw error;

      const grouped: Record<string, ClientePortafoglio> = {};
      for (const t of titoli || []) {
        const cli = t.clienti as any;
        if (!cli) continue;
        const key = cli.id;
        if (!grouped[key]) {
          grouped[key] = {
            cliente_id: cli.id,
            nome: cli.nome || "",
            cognome: cli.cognome || "",
            ragione_sociale: cli.ragione_sociale,
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

  const filtered = (data || []).filter((c) => {
    const label = c.ragione_sociale || `${c.cognome} ${c.nome}`;
    return label.toLowerCase().includes(search.toLowerCase());
  });

  const totPremi = filtered.reduce((s, c) => s + c.totale_premi, 0);
  const totIncassato = filtered.reduce((s, c) => s + c.totale_incassato, 0);
  const totPolizze = filtered.reduce((s, c) => s + c.num_polizze, 0);

  const exportCSV = () => {
    const header = "Cliente,Tipo,N. Polizze,Totale Premi,Totale Incassato\n";
    const rows = filtered.map((c) => {
      const label = c.ragione_sociale || `${c.cognome} ${c.nome}`;
      return `"${label}",${c.tipo_cliente},${c.num_polizze},${c.totale_premi.toFixed(2)},${c.totale_incassato.toFixed(2)}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "portafoglio_per_cliente.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  return (
    <div className="space-y-6">
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
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">N. Polizze</TableHead>
              <TableHead className="text-right">Totale Premi</TableHead>
              <TableHead className="text-right">Totale Incassato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nessun dato</TableCell></TableRow>
            ) : filtered.map((c) => (
              <TableRow key={c.cliente_id} className="cursor-pointer" onClick={() => navigate(`/archivi/clienti/${c.cliente_id}`)}>
                <TableCell className="font-medium">{c.ragione_sociale || `${c.cognome} ${c.nome}`}</TableCell>
                <TableCell>{c.tipo_cliente === "azienda" ? "Azienda" : "Privato"}</TableCell>
                <TableCell className="text-right">{c.num_polizze}</TableCell>
                <TableCell className="text-right">{fmt(c.totale_premi)}</TableCell>
                <TableCell className="text-right">{fmt(c.totale_incassato)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {filtered.length > 0 && (
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

export default PortafoglioPerClientePage;
