import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Shield, Clock, Archive, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";

const PAGE_SIZE = 25;

type TabType = "attive" | "carico" | "storico";

const PortafoglioPolizzePage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>("attive");
  const [search, setSearch] = useState("");
  const [filtroCompagnia, setFiltroCompagnia] = useState("tutte");
  const [filtroRamo, setFiltroRamo] = useState("tutti");
  const [page, setPage] = useState(0);
  const [caricoDate, setCaricoDate] = useState(new Date());

  const today = format(new Date(), "yyyy-MM-dd");
  const caricoStart = format(startOfMonth(caricoDate), "yyyy-MM-dd");
  const caricoEnd = format(endOfMonth(caricoDate), "yyyy-MM-dd");

  // Compagnie per filtro
  const { data: compagnie } = useQuery({
    queryKey: ["compagnie-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  // Rami per filtro
  const { data: rami } = useQuery({
    queryKey: ["rami-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, descrizione").eq("attivo", true).order("descrizione");
      return data || [];
    },
  });

  // Contatori per ogni tab
  const { data: counters } = useQuery({
    queryKey: ["portafoglio-counters", today, caricoStart, caricoEnd],
    queryFn: async () => {
      const [attive, carico, storico] = await Promise.all([
        supabase.from("titoli").select("id", { count: "exact", head: true })
          .eq("stato", "attivo").gte("garanzia_a", today),
        supabase.from("titoli").select("id", { count: "exact", head: true })
          .gte("data_scadenza", caricoStart).lte("data_scadenza", caricoEnd),
        supabase.from("titoli").select("id", { count: "exact", head: true })
          .or(`stato.in.(incassato,scaduto),and(stato.eq.attivo,garanzia_a.lt.${today})`),
      ]);
      return {
        attive: attive.count || 0,
        carico: carico.count || 0,
        storico: storico.count || 0,
      };
    },
  });

  // Build query in base al tab
  const buildQuery = (countOnly = false) => {
    let q = supabase.from("titoli").select(
      countOnly
        ? "id"
        : "id, numero_polizza, compagnia_nome, ramo_nome, cliente_cognome, cliente_nome, stato, garanzia_dal, garanzia_a, data_scadenza, premio_lordo, tipo_operazione",
      countOnly ? { count: "exact", head: true } : { count: "exact" }
    );

    // Tab filters
    if (tab === "attive") {
      q = q.eq("stato", "attivo").gte("garanzia_a", today);
    } else if (tab === "carico") {
      q = q.gte("data_scadenza", caricoStart).lte("data_scadenza", caricoEnd);
    } else {
      q = q.or(`stato.in.(incassato,scaduto),and(stato.eq.attivo,garanzia_a.lt.${today})`);
    }

    // Search
    if (search) {
      q = q.or(`numero_polizza.ilike.%${search}%,cliente_cognome.ilike.%${search}%,cliente_nome.ilike.%${search}%`);
    }

    if (filtroCompagnia !== "tutte") {
      q = q.eq("compagnia_id", filtroCompagnia);
    }
    if (filtroRamo !== "tutti") {
      q = q.eq("ramo_id", filtroRamo);
    }

    return q;
  };

  const { data: result, isLoading } = useQuery({
    queryKey: ["portafoglio-polizze", tab, search, filtroCompagnia, filtroRamo, page, caricoStart, caricoEnd, today],
    queryFn: async () => {
      const q = buildQuery()
        .order("garanzia_a", { ascending: tab === "storico" ? false : true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count } = await q;
      return { data: data || [], count: count || 0 };
    },
  });

  const polizze = result?.data || [];
  const totalCount = result?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const resetFilters = () => {
    setSearch("");
    setFiltroCompagnia("tutte");
    setFiltroRamo("tutti");
    setPage(0);
  };

  const handleTabChange = (value: string) => {
    setTab(value as TabType);
    setPage(0);
  };

  const statoBadgeVariant = (stato: string) => {
    switch (stato) {
      case "attivo": return "default";
      case "sospeso": return "secondary";
      case "scaduto": return "destructive";
      case "incassato": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portafoglio Polizze</h1>
        <p className="text-sm text-muted-foreground">Gestione e consultazione del portafoglio assicurativo</p>
      </div>

      {/* Contatori */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`cursor-pointer transition-all ${tab === "attive" ? "ring-2 ring-primary" : ""}`} onClick={() => handleTabChange("attive")}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Polizze Attive</p>
              <p className="text-2xl font-bold text-foreground">{counters?.attive ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-all ${tab === "carico" ? "ring-2 ring-primary" : ""}`} onClick={() => handleTabChange("carico")}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-accent/50 p-3">
              <Clock className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Carico {format(caricoDate, "MMMM yyyy", { locale: it })}</p>
              <p className="text-2xl font-bold text-foreground">{counters?.carico ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-all ${tab === "storico" ? "ring-2 ring-primary" : ""}`} onClick={() => handleTabChange("storico")}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-muted p-3">
              <Archive className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Storico</p>
              <p className="text-2xl font-bold text-foreground">{counters?.storico ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="attive">Polizze Attive</TabsTrigger>
            <TabsTrigger value="carico">Carico Mese</TabsTrigger>
            <TabsTrigger value="storico">Storico</TabsTrigger>
          </TabsList>

          {tab === "carico" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCaricoDate(d => subMonths(d, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(caricoDate, "MMMM yyyy", { locale: it })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setCaricoDate(d => addMonths(d, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Filtri */}
        <div className="flex flex-wrap gap-3 mt-4">
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

        {/* Tabella condivisa per tutti i tab */}
        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">Caricamento...</div>
          ) : polizze.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">Nessuna polizza trovata</div>
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
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/titoli/${p.id}`)}
                    >
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

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {totalCount} polizze trovate — Pagina {page + 1} di {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    Precedente
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    Successiva
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default PortafoglioPolizzePage;
