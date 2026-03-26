import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
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

export default function ClienteSinistri() {
  const { user } = useAuth();

  const { data: sinistri = [] } = useQuery({
    queryKey: ["cliente-sinistri", user?.id],
    queryFn: async () => {
      // Get cliente IDs linked to this user
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) return [];
      
      const { data, error } = await supabase
        .from("sinistri")
        .select("*, compagnie(nome), titoli(numero_titolo)")
        .in("cliente_anagrafica_id", clienteIds.map((c: any) => c))
        .order("data_apertura", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const aperti = sinistri.filter((s: any) => !["chiuso", "respinto"].includes(s.stato)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">I Miei Sinistri</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Totale</p><p className="text-2xl font-bold">{sinistri.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Aperti</p><p className="text-2xl font-bold text-orange-600">{aperti}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Chiusi</p><p className="text-2xl font-bold text-green-600">{sinistri.length - aperti}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Elenco Sinistri</CardTitle></CardHeader>
        <CardContent>
          {sinistri.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessun sinistro presente</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N. Sinistro</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Polizza</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Luogo</TableHead>
                  <TableHead>Data Evento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sinistri.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.numero_sinistro || "—"}</TableCell>
                    <TableCell>{tipoLabels[s.tipo_sinistro] || s.tipo_sinistro || "—"}</TableCell>
                    <TableCell>{s.titoli?.numero_titolo || "—"}</TableCell>
                    <TableCell><Badge className={statoBadge[s.stato] || ""}>{s.stato?.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>{s.luogo_sinistro || "—"}</TableCell>
                    <TableCell>{s.data_evento ? format(new Date(s.data_evento), "dd/MM/yyyy") : "—"}</TableCell>
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
