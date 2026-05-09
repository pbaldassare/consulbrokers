import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import ServerPagination from "@/components/ServerPagination";
const ClientiContabPage = () => {
  const { page, setPage, pageSize, range } = useServerPagination();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["clienti_contab", page, search],
    queryFn: async () => {
      let q = supabase.from("clienti").select("*", { count: "exact" });
      if (search) q = q.or(`cognome.ilike.%${search}%,nome.ilike.%${search}%,ragione_sociale.ilike.%${search}%,codice_fiscale.ilike.%${search}%`);
      q = q.order("cognome").range(range.from, range.to);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data || [], total: count || 0 };
    },
  });

  const rows = data?.rows || [];
  const totalCount = data?.total || 0;

  const getDisplayName = (c: any) => {
    if (c.tipo_cliente === "azienda") return c.ragione_sociale || "—";
    return [c.cognome, c.nome].filter(Boolean).join(" ") || "—";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageBreadcrumb />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clienti — Contabilità Generale</h1>
          <p className="text-sm text-muted-foreground">Vista clienti per operazioni contabili e collegamento movimenti</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cerca cliente..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
            </div>
            <Badge variant="outline">{totalCount} clienti</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Ragione Sociale</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>C.F.</TableHead>
                <TableHead>P.IVA</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nessun cliente trovato</TableCell></TableRow>
              ) : rows.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{getDisplayName(c)}</TableCell>
                  <TableCell><Badge variant="outline">{c.tipo_cliente}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{c.codice_fiscale || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{c.partita_iva || "—"}</TableCell>
                  <TableCell>{c.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.attivo ? "default" : "secondary"}>{c.attivo ? "Attivo" : "Inattivo"}</Badge>
                  </TableCell>
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

export default ClientiContabPage;
