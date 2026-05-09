import { useState, useEffect } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarCheck } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import ServerPagination from "@/components/ServerPagination";
import { format, differenceInDays } from "date-fns";
const ScadenziarioPage = () => {
  const [statoFilter, setStatoFilter] = useState("tutte");

  const { page, setPage, pageSize, range } = useServerPagination(25, [statoFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ["scadenziario", page, statoFilter],
    queryFn: async () => {
      let q = supabase.from("scadenziario").select("*, fornitori(nome), primanota_generale(numero_pn)", { count: "exact" });
      if (statoFilter !== "tutte") q = q.eq("stato", statoFilter);
      q = q.order("data_scadenza", { ascending: true }).range(range.from, range.to);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data || [], total: count || 0 };
    },
  });

  const rows = data?.rows || [];
  const totalCount = data?.total || 0;

  const getScadenzaBadge = (stato: string, dataScadenza: string) => {
    if (stato === "pagata") return <Badge className="bg-green-100 text-green-800">Pagata</Badge>;
    const days = differenceInDays(new Date(dataScadenza), new Date());
    if (days < 0) return <Badge variant="destructive">Scaduta ({Math.abs(days)}gg)</Badge>;
    if (days <= 7) return <Badge className="bg-amber-100 text-amber-800">Scade tra {days}gg</Badge>;
    return <Badge variant="outline">Aperta</Badge>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageBreadcrumb />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <CalendarCheck className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scadenziario</h1>
          <p className="text-sm text-muted-foreground">Scadenze pagamenti fornitori e obblighi contabili</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Select value={statoFilter} onValueChange={v => { setStatoFilter(v); setPage(0); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutte">Tutte</SelectItem>
                <SelectItem value="aperta">Aperte</SelectItem>
                <SelectItem value="pagata">Pagate</SelectItem>
                <SelectItem value="scaduta">Scadute</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline">{totalCount} scadenze</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornitore</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>N° PN</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nessuna scadenza trovata</TableCell></TableRow>
              ) : rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.fornitori?.nome || "—"}</TableCell>
                  <TableCell>{r.descrizione || "—"}</TableCell>
                  <TableCell>
                    {r.primanota_generale?.numero_pn ? (
                      <Badge variant="secondary" className="font-mono text-xs">{r.primanota_generale.numero_pn}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">€ {Number(r.importo).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{format(new Date(r.data_scadenza), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{r.data_pagamento ? format(new Date(r.data_pagamento), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>{getScadenzaBadge(r.stato, r.data_scadenza)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ScadenziarioPage;
