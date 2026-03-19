import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, DollarSign, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const PremiProvvigioniPage = () => {
  const navigate = useNavigate();
  const [filtroPagata, setFiltroPagata] = useState<string>("tutte");

  const { data, isLoading } = useQuery({
    queryKey: ["premi-provvigioni"],
    queryFn: async () => {
      const { data: provvigioni, error } = await supabase
        .from("provvigioni_generate")
        .select(`
          id, percentuale, importo_provvigione, pagata, calcolata_il,
          titoli!inner(numero_titolo, premio_lordo, importo_incassato, stato,
            clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale)),
          profiles!provvigioni_generate_user_id_fkey(nome, cognome)
        `)
        .order("calcolata_il", { ascending: false });

      if (error) throw error;
      return provvigioni || [];
    },
  });

  const filtered = (data || []).filter((p: any) => {
    if (filtroPagata === "pagate") return p.pagata;
    if (filtroPagata === "non_pagate") return !p.pagata;
    return true;
  });

  const totPremi = filtered.reduce((s: number, p: any) => s + (Number(p.titoli?.importo_incassato) || 0), 0);
  const totProvvigioni = filtered.reduce((s: number, p: any) => s + (Number(p.importo_provvigione) || 0), 0);

  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const getCliente = (t: any) => {
    const cli = t?.clienti;
    if (!cli) return "—";
    return cli.ragione_sociale || `${cli.cognome || ""} ${cli.nome || ""}`.trim();
  };

  const exportCSV = () => {
    const header = "N. Polizza,Cliente,Premio Lordo,Incassato,%,Provvigione,Produttore,Pagata\n";
    const csv = filtered.map((p: any) => {
      const t = p.titoli;
      const prod = p.profiles;
      return `"${t?.numero_titolo}","${getCliente(t)}",${t?.premio_lordo || 0},${t?.importo_incassato || 0},${p.percentuale}%,${p.importo_provvigione},"${prod?.cognome || ""} ${prod?.nome || ""}",${p.pagata ? "Sì" : "No"}`;
    }).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "premi_provvigioni.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
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
        <div className="flex-1" />
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

export default PremiProvvigioniPage;
