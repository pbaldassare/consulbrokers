import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { Clock, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";

const PAGE_SIZE = 25;

const PortafoglioCaricoPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filtroCompagnia, setFiltroCompagnia] = useState("tutte");
  const [filtroRamo, setFiltroRamo] = useState("tutti");
  const [page, setPage] = useState(0);
  const [caricoDate, setCaricoDate] = useState(new Date());

  const caricoStart = format(startOfMonth(caricoDate), "yyyy-MM-dd");
  const caricoEnd = format(endOfMonth(caricoDate), "yyyy-MM-dd");

  const { data: compagnie } = useQuery({
    queryKey: ["compagnie-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: rami } = useQuery({
    queryKey: ["rami-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, descrizione").eq("attivo", true).order("descrizione");
      return data || [];
    },
  });

  const { data: result, isLoading } = useQuery({
    queryKey: ["portafoglio-carico", search, filtroCompagnia, filtroRamo, page, caricoStart, caricoEnd],
    queryFn: async () => {
      let q = supabase.from("titoli").select(
        "id, numero_polizza, compagnia_nome, ramo_nome, cliente_cognome, cliente_nome, stato, garanzia_dal, garanzia_a, data_scadenza, premio_lordo, tipo_operazione",
        { count: "exact" }
      ).gte("data_scadenza", caricoStart).lte("data_scadenza", caricoEnd);

      if (search) {
        q = q.or(`numero_polizza.ilike.%${search}%,cliente_cognome.ilike.%${search}%,cliente_nome.ilike.%${search}%`);
      }
      if (filtroCompagnia !== "tutte") q = q.eq("compagnia_id", filtroCompagnia);
      if (filtroRamo !== "tutti") q = q.eq("ramo_id", filtroRamo);

      const { data, count } = await q
        .order("data_scadenza", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      return { data: data || [], count: count || 0 };
    },
  });

  const polizze = result?.data || [];
  const totalCount = result?.count || 0;

  const statoBadgeVariant = (stato: string) => {
    switch (stato) {
      case "attivo": return "default" as const;
      case "sospeso": return "secondary" as const;
      case "scaduto": return "destructive" as const;
      case "incassato": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carico del Mese</h1>
          <p className="text-sm text-muted-foreground">Polizze in scadenza da confermare o rinnovare</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => { setCaricoDate(d => subMonths(d, 1)); setPage(0); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center capitalize">
            {format(caricoDate, "MMMM yyyy", { locale: it })}
          </span>
          <Button variant="outline" size="icon" onClick={() => { setCaricoDate(d => addMonths(d, 1)); setPage(0); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="rounded-lg bg-accent/50 p-3">
            <Clock className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Carico {format(caricoDate, "MMMM yyyy", { locale: it })}
            </p>
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          </div>
        </CardContent>
      </Card>

      {/* Filtri */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per n° polizza, cliente..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={filtroCompagnia} onValueChange={(v) => { setFiltroCompagnia(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Compagnia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutte le compagnie</SelectItem>
            {compagnie?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroRamo} onValueChange={(v) => { setFiltroRamo(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Ramo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti i rami</SelectItem>
            {rami?.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.descrizione}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabella */}
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento...</div>
      ) : polizze.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Nessuna polizza trovata per questo mese</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Polizza</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Compagnia</TableHead>
                <TableHead>Ramo</TableHead>
                <TableHead>Decorrenza</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead className="text-right">Premio</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {polizze.map((p: any) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/titoli/${p.id}`)}>
                  <TableCell className="font-medium">{p.numero_polizza || "—"}</TableCell>
                  <TableCell>{[p.cliente_cognome, p.cliente_nome].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell>{p.compagnia_nome || "—"}</TableCell>
                  <TableCell>{p.ramo_nome || "—"}</TableCell>
                  <TableCell>{p.garanzia_dal ? format(new Date(p.garanzia_dal), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>{p.garanzia_a ? format(new Date(p.garanzia_a), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-right">
                    {p.premio_lordo != null ? `€ ${Number(p.premio_lordo).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statoBadgeVariant(p.stato)}>{p.stato}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default PortafoglioCaricoPage;
