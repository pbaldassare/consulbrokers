import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatScadenzaRca } from "@/lib/rca/clientela";
import { labelGaranziaAssicurapp } from "@/lib/rca/garanzie";
import { prodottoLabel, statoPreventivoLabel, type RcaPreventivoRow } from "@/lib/rca/preventivi";

export default function RcaPreventiviListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const { page, setPage, pageSize, range } = useServerPagination(25, [debounced]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["rca-preventivi"],
    queryFn: async (): Promise<RcaPreventivoRow[]> => {
      const { data, error } = await (supabase.from("rca_preventivi") as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as RcaPreventivoRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) => {
      const nome = String((r.client_snapshot as { display_name?: string })?.display_name || "").toLowerCase();
      return r.targa.toLowerCase().includes(q) || nome.includes(q) || (r.quote_uid || "").toLowerCase().includes(q);
    });
  }, [data, debounced]);
  const pageRows = filtered.slice(range.from, range.to + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Preventivi RCA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preventivi preparati in CBnet. Le quotazioni compagnie arriveranno con l’integrazione Assicurapp.
        </p>
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca targa, cliente o codice…"
          className="pl-8"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Targa</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Prodotto</TableHead>
                <TableHead>Garanzie</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Creato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Caricamento…</TableCell>
                </TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nessun preventivo salvato
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/rca/preventivi/${r.id}`)}>
                    <TableCell className="font-mono font-medium">{r.targa}</TableCell>
                    <TableCell>{String((r.client_snapshot as { display_name?: string })?.display_name || "—")}</TableCell>
                    <TableCell>{prodottoLabel(r.prodotto_code)}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">
                      {(r.garanzie_richieste || []).map(labelGaranziaAssicurapp).join(", ") || "—"}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{statoPreventivoLabel(r.stato)}</Badge></TableCell>
                    <TableCell>{formatScadenzaRca(r.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ServerPagination page={page} pageSize={pageSize} totalCount={filtered.length} onPageChange={setPage} />
    </div>
  );
}
