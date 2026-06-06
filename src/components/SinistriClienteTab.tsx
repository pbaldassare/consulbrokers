import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const statoBadge: Record<string, string> = {
  aperto: "bg-blue-100 text-blue-800",
  in_lavorazione: "bg-yellow-100 text-yellow-800",
  in_attesa_documenti: "bg-orange-100 text-orange-800",
  chiuso: "bg-green-100 text-green-800",
  respinto: "bg-red-100 text-red-800",
};

const tipoLabels: Record<string, string> = {
  incidente_stradale: "Incidente Stradale",
  furto: "Furto",
  incendio: "Incendio",
  danni_acqua: "Danni Acqua",
  RC_terzi: "RC Terzi",
  infortunio: "Infortunio",
  grandine: "Grandine",
};

export default function SinistriClienteTab({ clienteId }: { clienteId: string }) {
  const navigate = useNavigate();

  const { data: sinistri = [] } = useQuery({
    queryKey: ["sinistri-cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistri")
        .select("*, agenzie(nome), titoli(numero_titolo)")
        .eq("cliente_anagrafica_id", clienteId)
        .order("data_apertura", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const totaleRiserva = sinistri.reduce((s: number, x: any) => s + (x.importo_riserva || 0), 0);
  const totaleLiquidato = sinistri.reduce((s: number, x: any) => s + (x.importo_liquidato || 0), 0);
  const aperti = sinistri.filter((s: any) => !["chiuso", "respinto"].includes(s.stato)).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Totale Sinistri</p><p className="text-2xl font-bold">{sinistri.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Aperti</p><p className="text-2xl font-bold text-orange-600">{aperti}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Riserva Totale</p><p className="text-2xl font-bold font-mono">€ {totaleRiserva.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Liquidato Totale</p><p className="text-2xl font-bold font-mono">€ {totaleLiquidato.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {sinistri.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessun sinistro collegato a questo cliente</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N. Sinistro</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Polizza</TableHead>
                  <TableHead>Agenzia</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Costo Prev. €</TableHead>
                  <TableHead>Costo Eff. €</TableHead>
                  <TableHead>Liquidato €</TableHead>
                  <TableHead>Data Apertura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sinistri.map((s: any) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/sinistri/${s.id}`)}>
                    <TableCell className="font-medium">{s.numero_sinistro || "—"}</TableCell>
                    <TableCell>{tipoLabels[s.tipo_sinistro] || s.tipo_sinistro || "—"}</TableCell>
                    <TableCell>{s.titoli?.numero_titolo || "—"}</TableCell>
                    <TableCell>{s.compagnie?.nome || "—"}</TableCell>
                    <TableCell><Badge className={statoBadge[s.stato] || ""}>{s.stato?.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="font-mono">{s.costo_preventivato?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell className="font-mono">{s.costo_effettivo?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell className="font-mono">{s.importo_liquidato?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell>{s.data_apertura ? format(new Date(s.data_apertura), "dd/MM/yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
