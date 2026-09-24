import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RcaPageHeader, RcaTableCard, RcaToolbar } from "@/components/rca/RcaPageChrome";
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
    <div className="mx-auto max-w-6xl space-y-5">
      <RcaPageHeader
        title="Preventivi RCA"
        subtitle="Preventivi preparati in CBnet. Le quotazioni compagnie arriveranno con l’integrazione Assicurapp."
      />

      <RcaToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Cerca targa, cliente o codice…"
        count={filtered.length}
        countLabel="preventivi"
      />

      <RcaTableCard>
        <Table className="w-full min-w-0 table-fixed" containerClassName="overflow-x-hidden">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[24%]" />
            <col className="w-[14%]" />
            <col className="w-[26%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-3">Targa</TableHead>
              <TableHead className="px-3">Cliente</TableHead>
              <TableHead className="px-3">Prodotto</TableHead>
              <TableHead className="px-3">Garanzie</TableHead>
              <TableHead className="px-3">Stato</TableHead>
              <TableHead className="px-3">Creato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                  Nessun preventivo salvato
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/rca/preventivi/${r.id}`)}>
                  <TableCell className="px-3 py-2.5 font-mono font-medium">{r.targa}</TableCell>
                  <TableCell className="truncate px-3 py-2.5">
                    {String((r.client_snapshot as { display_name?: string })?.display_name || "—")}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">{prodottoLabel(r.prodotto_code)}</TableCell>
                  <TableCell className="truncate px-3 py-2.5 text-muted-foreground">
                    {(r.garanzie_richieste || []).map(labelGaranziaAssicurapp).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Badge variant="secondary">{statoPreventivoLabel(r.stato)}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2.5">{formatScadenzaRca(r.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </RcaTableCard>

      <ServerPagination page={page} pageSize={pageSize} totalCount={filtered.length} onPageChange={setPage} />
    </div>
  );
}
