import { useState, useEffect } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import ServerPagination from "@/components/ServerPagination";
import { formatTipoSinistro } from "@/lib/tipiSinistro";

const statiSinistro = ["in_valutazione", "aperto", "in_lavorazione", "in_attesa_documenti", "in_liquidazione", "chiuso", "respinto"];

const statoBadge: Record<string, string> = {
  in_valutazione: "bg-amber-100 text-amber-800",
  aperto: "bg-blue-100 text-blue-800",
  in_lavorazione: "bg-yellow-100 text-yellow-800",
  in_attesa_documenti: "bg-orange-100 text-orange-800",
  in_liquidazione: "bg-purple-100 text-purple-800",
  chiuso: "bg-green-100 text-green-800",
  respinto: "bg-red-100 text-red-800",
};

const getClienteName = (clienti: any) => {
  if (!clienti) return "—";
  if (clienti.tipo_cliente === "azienda" && clienti.ragione_sociale) return clienti.ragione_sociale;
  return `${clienti.cognome || ""} ${clienti.nome || ""}`.trim() || "—";
};

export default function SinistriList() {
  const navigate = useNavigate();
  const [filtroStato, setFiltroStato] = useState<string>("tutti");
  const [filtroCompagnia, setFiltroCompagnia] = useState<string>("tutti");
  const [search, setSearch] = useState("");
  const { page, setPage, pageSize, range } = useServerPagination(25, [filtroStato, filtroCompagnia, search]);
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("sinistri-list-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "sinistri" },
        () => qc.invalidateQueries({ queryKey: ["sinistri"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data: sinistriResult } = useQuery({
    queryKey: ["sinistri", filtroStato, filtroCompagnia, search, page],
    queryFn: async () => {
      let q = supabase.from("sinistri").select(
        `*, compagnie(nome), profiles!sinistri_responsabile_id_fkey(nome, cognome),
         clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente),
         titoli(numero_titolo)`,
        { count: "exact" }
      );
      if (filtroStato !== "tutti") q = q.eq("stato", filtroStato);
      if (filtroCompagnia !== "tutti") q = q.eq("compagnia_id", filtroCompagnia);
      if (search) q = q.or(`numero_sinistro.ilike.%${search}%,descrizione.ilike.%${search}%`);
      const { data, error, count } = await q.order("created_at", { ascending: false }).range(range.from, range.to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const sinistri = sinistriResult?.data || [];
  const totalCount = sinistriResult?.count || 0;

  const { data: compagnie } = useQuery({
    queryKey: ["agenzie"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: eventiScaduti } = useQuery({
    queryKey: ["eventi-scaduti"],
    queryFn: async () => {
      const { data } = await supabase.from("sinistro_eventi").select("id").eq("stato", "scaduto");
      return data?.length || 0;
    },
  });

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" /> Sinistri
          </h1>
          <p className="text-muted-foreground">Gestione pratiche sinistri</p>
        </div>
        <div className="flex items-center gap-2">
          {(eventiScaduti ?? 0) > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              ⚠ {eventiScaduti} eventi scaduti
            </Badge>
          )}
          <Button onClick={() => navigate("/sinistri/apertura")}>
            <Plus className="h-4 w-4 mr-1" /> Nuovo Sinistro
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca per numero, descrizione..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        <Select value={filtroStato} onValueChange={handleFilterChange(setFiltroStato)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {statiSinistro.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCompagnia} onValueChange={handleFilterChange(setFiltroCompagnia)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutte le compagnie</SelectItem>
            {compagnie?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Sinistro</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Polizza</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Compagnia</TableHead>
              <TableHead>Data Apertura</TableHead>
              <TableHead>Descrizione</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sinistri.map((s: any) => (
              <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/sinistri/${s.id}`)}>
                <TableCell className="font-medium">{s.numero_sinistro || "—"}</TableCell>
                <TableCell>{getClienteName(s.clienti)}</TableCell>
                <TableCell>{s.titoli?.numero_titolo || "—"}</TableCell>
                <TableCell>{formatTipoSinistro(s)}</TableCell>
                <TableCell>
                  <Badge className={statoBadge[s.stato]}>{s.stato.replace(/_/g, " ")}</Badge>
                </TableCell>
                <TableCell>{s.compagnie?.nome || "—"}</TableCell>
                <TableCell>{s.data_apertura ? format(new Date(s.data_apertura), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{s.descrizione || "—"}</TableCell>
              </TableRow>
            ))}
            {!sinistri.length && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nessun sinistro trovato</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <div className="p-4">
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
