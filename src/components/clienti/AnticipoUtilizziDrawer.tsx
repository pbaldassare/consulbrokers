import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAnticipoUtilizzi } from "@/hooks/useAnticipiCliente";
import { fmtEuro } from "@/lib/formatCurrency";
import { useNavigate } from "react-router-dom";

interface Props {
  anticipoId: string | null;
  onClose: () => void;
}

const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString("it-IT"); } catch { return s; } };

export default function AnticipoUtilizziDrawer({ anticipoId, onClose }: Props) {
  const navigate = useNavigate();
  const { data: utilizzi = [], isLoading } = useAnticipoUtilizzi(anticipoId || undefined);

  return (
    <Dialog open={!!anticipoId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Utilizzi Acconto</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Caricamento...</div>
        ) : utilizzi.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Acconto non ancora utilizzato</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Polizza</TableHead>
                <TableHead className="text-xs text-right">Importo Usato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {utilizzi.map((u: any, i: number) => (
                <TableRow key={u.id} className={`cursor-pointer ${i % 2 === 0 ? "bg-muted/30" : ""}`}
                  onClick={() => { if (u.titolo?.id) { navigate(`/titoli/${u.titolo.id}`); onClose(); } }}>
                  <TableCell className="text-xs">{fmtDate(u.data_utilizzo)}</TableCell>
                  <TableCell className="text-xs">{u.titolo?.numero_titolo || u.titolo_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs text-right font-medium">{fmtEuro(u.importo_utilizzato)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
