import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileStack, Search } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import ServerPagination from "@/components/ServerPagination";
import { format } from "date-fns";

const PAGE_SIZE = 25;

const DichiarativiCUPage = () => {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [annoFilter, setAnnoFilter] = useState(new Date().getFullYear().toString());

  const { data, isLoading } = useQuery({
    queryKey: ["certificazioni_cu", page, search, annoFilter],
    queryFn: async () => {
      let q = supabase.from("certificazioni_cu").select("*, fornitori(nome)", { count: "exact" });
      if (annoFilter) q = q.eq("anno_fiscale", parseInt(annoFilter));
      if (search) q = q.or(`codice_fornitore.ilike.%${search}%,nome_fornitore.ilike.%${search}%,numero_primanota.ilike.%${search}%`);
      q = q.order("codice_fornitore").order("data_primanota").range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data || [], total: count || 0 };
    },
  });

  const rows = data?.rows || [];
  const totalCount = data?.total || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageBreadcrumb />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileStack className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dichiarativi — Certificazioni CU</h1>
          <p className="text-sm text-muted-foreground">Certificazioni Uniche per fornitore con dettaglio movimenti</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cerca codice, nome, N° PN..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
            </div>
            <Select value={annoFilter} onValueChange={v => { setAnnoFilter(v); setPage(0); }}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2026, 2025, 2024, 2023].map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="outline">{totalCount} record</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead>N° PN</TableHead>
                <TableHead>Data PN</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Imponibile</TableHead>
                <TableHead className="text-right">Ritenuta</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nessuna CU trovata per l'anno selezionato</TableCell></TableRow>
              ) : rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.codice_fornitore || "—"}</TableCell>
                  <TableCell>{r.nome_fornitore || r.fornitori?.nome || "—"}</TableCell>
                  <TableCell className="font-mono">{r.numero_primanota || "—"}</TableCell>
                  <TableCell>{r.data_primanota ? format(new Date(r.data_primanota), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.tipo_reddito}</Badge></TableCell>
                  <TableCell className="text-right font-mono">€ {Number(r.imponibile).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-mono">€ {Number(r.ritenuta).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <Badge variant={r.stato === "inviata" ? "default" : r.stato === "generata" ? "secondary" : "outline"}>{r.stato}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
};

export default DichiarativiCUPage;
