import { useState, useEffect } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, UserRound } from "lucide-react";
import ServerPagination from "@/components/ServerPagination";
import {
  NuovaControparteSinistroDialog,
  type ControparteSinistroRow,
} from "@/components/sinistri/NuovaControparteSinistroDialog";

function parseSearchPayload(data: unknown): { data: ControparteSinistroRow[]; totalCount: number } {
  const payload = data as { data?: ControparteSinistroRow[]; total_count?: number } | null;
  return {
    data: payload?.data ?? [],
    totalCount: Number(payload?.total_count ?? 0),
  };
}

const ContropartiSinistriList = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editRow, setEditRow] = useState<ControparteSinistroRow | null>(null);
  const { page, setPage, pageSize, range } = useServerPagination(25, [debouncedSearch]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [search, setPage]);

  const { data: result, isLoading, isError, refetch } = useQuery({
    queryKey: ["controparti-sinistri", debouncedSearch, page, pageSize],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_controparti_sinistri_ranked", {
        p_search: debouncedSearch.trim(),
        p_limit: pageSize,
        p_offset: range.from,
      });
      if (error) throw error;
      return parseSearchPayload(data);
    },
  });

  const rows = result?.data ?? [];
  const totalCount = result?.totalCount ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controparti sinistri</h1>
          <p className="text-muted-foreground">
            Anagrafica controparti per l&apos;apertura e la gestione delle pratiche sinistro
          </p>
        </div>
        <NuovaControparteSinistroDialog
          trigger={
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuova controparte
            </Button>
          }
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["controparti-sinistri"] })}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="w-5 h-5" />
              Controparti ({totalCount})
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome, CF, P.IVA..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="py-4 space-y-2">
              <p className="text-destructive">Impossibile caricare le controparti.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Riprova
              </Button>
            </div>
          ) : isLoading ? (
            <p className="text-muted-foreground py-4">Caricamento...</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codice</TableHead>
                    <TableHead>Denominazione</TableHead>
                    <TableHead>CF / P.IVA</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => {
                    const cfPiva = c.codice_fiscale || c.partita_iva || "—";
                    return (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setEditRow(c)}
                      >
                        <TableCell className="font-mono text-xs">{c.codice ?? "—"}</TableCell>
                        <TableCell className="font-medium">{c.denominazione}</TableCell>
                        <TableCell className="font-mono text-xs">{cfPiva}</TableCell>
                        <TableCell>{c.email || "—"}</TableCell>
                        <TableCell>{c.telefono || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={c.attivo ? "default" : "secondary"}>
                            {c.attivo ? "Attivo" : "Disattivo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nessuna controparte trovata
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {editRow && (
        <NuovaControparteSinistroDialog
          existing={editRow}
          open={Boolean(editRow)}
          onOpenChange={(o) => {
            if (!o) setEditRow(null);
          }}
          onSaved={() => {
            setEditRow(null);
            queryClient.invalidateQueries({ queryKey: ["controparti-sinistri"] });
          }}
        />
      )}
    </div>
  );
};

export default ContropartiSinistriList;
