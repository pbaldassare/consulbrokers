import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Car, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TIPI_CLIENTELA_RCA,
  filterRcaClientelaRows,
  formatScadenzaRca,
  mapRcaClientelaRow,
  sortRcaClientelaRows,
  type RcaClientelaFiltroTipo,
  type RcaClientelaRaw,
  type RcaClientelaRow,
} from "@/lib/rca/clientela";

const FILTRI_TIPO: { value: RcaClientelaFiltroTipo; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "auto", label: "Auto" },
  { value: "autocarro", label: "Autocarro" },
];

export default function RcaClientelaPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tipo, setTipo] = useState<RcaClientelaFiltroTipo>("tutti");
  const { page, setPage, pageSize, range } = useServerPagination(25, [debounced, tipo]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["rca-clientela"],
    queryFn: async (): Promise<RcaClientelaRow[]> => {
      const { data, error } = await supabase
        .from("veicoli_polizza")
        .select(
          `
          id,
          targa,
          tipo_veicolo,
          marca,
          modello,
          titolo:titoli!veicoli_polizza_titolo_id_fkey(
            id,
            numero_titolo,
            data_scadenza,
            garanzia_a,
            stato,
            cliente_anagrafica_id,
            clienti:clienti!titoli_cliente_anagrafica_id_fkey(
              id, nome, cognome, ragione_sociale, tipo_cliente
            )
          )
        `,
        )
        .in("tipo_veicolo", [...TIPI_CLIENTELA_RCA])
        .limit(1000);
      if (error) throw error;
      return sortRcaClientelaRows(
        ((data || []) as RcaClientelaRaw[])
          .map(mapRcaClientelaRow)
          .filter((r): r is RcaClientelaRow => r != null),
      );
    },
  });

  const filtered = useMemo(
    () => filterRcaClientelaRows(data, { search: debounced, tipo }),
    [data, debounced, tipo],
  );
  const pageRows = filtered.slice(range.from, range.to + 1);

  const openRow = (row: RcaClientelaRow) => {
    if (row.clienteId) navigate(`/archivi/clienti/${row.clienteId}`);
    else if (row.titoloId) navigate(`/titoli/${row.titoloId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clientela RCA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Clienti con auto o autocarro: targa, nominativo e scadenza polizza.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca targa, cliente o n° polizza…"
            className="pl-8"
          />
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {FILTRI_TIPO.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTipo(f.value)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                tipo === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} veicoli
        </span>
      </div>

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Caricamento…
                  </TableCell>
                </TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Nessun cliente con auto o autocarro nei filtri attuali
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => (
                  <TableRow
                    key={row.veicoloId}
                    className="cursor-pointer"
                    onClick={() => openRow(row)}
                  >
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
                    <TableCell>{formatScadenzaRca(row.scadenza)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ServerPagination
        page={page}
        pageSize={pageSize}
        totalCount={filtered.length}
        onPageChange={setPage}
      />
    </div>
  );
}
