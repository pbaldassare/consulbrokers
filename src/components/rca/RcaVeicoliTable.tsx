import { useNavigate } from "react-router-dom";
import { Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatScadenzaRca, type RcaClientelaRow } from "@/lib/rca/clientela";
import { preventivaPath, urgenzaScadenzaRca, type UrgenzaScadenzaRca } from "@/lib/rca/scadenze";

const URGENZA_CLASS: Record<UrgenzaScadenzaRca, string> = {
  scaduta: "text-destructive font-medium",
  "30": "text-orange-600 font-medium",
  "60": "text-amber-700",
  "90": "",
  oltre: "text-muted-foreground",
  sconosciuta: "text-muted-foreground",
};

type Props = {
  rows: RcaClientelaRow[];
  isLoading?: boolean;
  today: string;
  emptyText?: string;
  showPreventiva?: boolean;
};

export function RcaVeicoliTable({
  rows,
  isLoading,
  today,
  emptyText = "Nessun veicolo nei filtri attuali",
  showPreventiva = true,
}: Props) {
  const navigate = useNavigate();

  const openCliente = (row: RcaClientelaRow) => {
    if (row.clienteId) navigate(`/archivi/clienti/${row.clienteId}`);
    else if (row.titoloId) navigate(`/titoli/${row.titoloId}`);
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Targa</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>N° polizza</TableHead>
              <TableHead>Scadenza polizza</TableHead>
              {showPreventiva && <TableHead className="w-[1%] whitespace-nowrap" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={showPreventiva ? 6 : 5} className="py-10 text-center text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showPreventiva ? 6 : 5} className="py-10 text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const urgenza = urgenzaScadenzaRca(row.scadenza, today);
                return (
                  <TableRow key={row.veicoloId} className="cursor-pointer" onClick={() => openCliente(row)}>
                    <TableCell className="font-medium font-mono tracking-wide">
                      <span className="inline-flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        {row.targa}
                      </span>
                    </TableCell>
                    <TableCell>{row.clienteNome}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.tipoLabel}</Badge>
                    </TableCell>
                    <TableCell
                      className="text-primary"
                      onClick={(e) => {
                        if (!row.titoloId) return;
                        e.stopPropagation();
                        navigate(`/titoli/${row.titoloId}`);
                      }}
                    >
                      {row.numeroPolizza || "—"}
                    </TableCell>
                    <TableCell className={URGENZA_CLASS[urgenza]}>
                      {formatScadenzaRca(row.scadenza)}
                    </TableCell>
                    {showPreventiva && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(preventivaPath(row));
                          }}
                        >
                          Preventiva
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
