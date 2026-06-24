import { useState, useMemo, useEffect } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import ServerPagination from "@/components/ServerPagination";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
const ECAgenzieStoricoPage = () => {
  const [q, setQ] = useState("");
  const [agenziaId, setAgenziaId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const { page, setPage, pageSize, range } = useServerPagination(25, [q, agenziaId, dateFrom, dateTo]);

  useEffect(() => { setPage(0); }, [q, agenziaId, dateFrom, dateTo]);

  // Agencies dropdown
  const { data: agenzieOpts = [] } = useQuery({
    queryKey: ["ec-agenzie-storico-agenzie"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").order("nome");
      return (data || []).map((c: any) => ({ value: c.id, label: c.nome }));
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["ec-agenzie-storico", q, agenziaId, dateFrom, dateTo, page],
    queryFn: async () => {
      let query = supabase
        .from("documenti")
        .select("id, nome_file, path_storage, bucket_name, entita_id, created_at, caricato_da, categoria", { count: "exact" })
        .eq("categoria", "EC Agenzia")
        .order("created_at", { ascending: false });

      if (agenziaId) query = query.eq("entita_id", agenziaId);
      if (q.trim()) query = query.ilike("nome_file", `%${q.trim()}%`);
      if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

      const from = range.from;
      const to = range.to;
      const { data: docs, count, error } = await query.range(from, to);
      if (error) throw error;

      const compIds = Array.from(new Set((docs || []).map((d: any) => d.entita_id).filter(Boolean)));
      const compMap: Record<string, string> = {};
      if (compIds.length) {
        const { data: comps } = await supabase.from("compagnie").select("id, nome").in("id", compIds);
        (comps || []).forEach((c: any) => { compMap[c.id] = c.nome; });
      }
      return {
        rows: (docs || []).map((d: any) => ({ ...d, agenzia_nome: compMap[d.entita_id] || "—" })),
        total: count || 0,
      };
    },
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;

  const handleDownload = async (row: any) => {
    try {
      const { data: blob, error } = await supabase.storage
        .from(row.bucket_name || "documenti_generali")
        .download(row.path_storage);
      if (error) throw error;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = row.nome_file;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e: any) {
      toast.error("Errore download: " + (e?.message || e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Storico E/C Agenzie</h1>
          <p className="text-sm text-muted-foreground">PDF "Estratto Conto Agenzia" archiviati</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nome file..." className="pl-9" />
          </div>
          <FilterSearchableSelect
            value={agenziaId}
            onValueChange={setAgenziaId}
            options={agenzieOpts}
            placeholder="Agenzia"
            allLabel="Tutte le agenzie"
          />
          <div>
            <label className="text-xs text-muted-foreground">Da</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">A</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Agenzia</TableHead>
              <TableHead>Nome File / Riferimento</TableHead>
              <TableHead className="w-[120px] text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nessun E/C archiviato</TableCell></TableRow>
            ) : rows.map((d: any, i: number) => (
              <TableRow key={d.id} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                <TableCell className="text-sm">{d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                <TableCell className="font-medium">{d.agenzia_nome}</TableCell>
                <TableCell className="text-sm font-mono">{d.nome_file}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(d)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Scarica
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ServerPagination page={page} pageSize={pageSize} totalCount={total} onPageChange={setPage} />
    </div>
  );
};

export default ECAgenzieStoricoPage;
