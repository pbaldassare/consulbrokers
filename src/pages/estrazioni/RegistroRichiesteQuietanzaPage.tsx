import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";

const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm");
  } catch {
    return iso;
  }
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
};

const fmtEuro = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

type RichiestaRow = {
  id: string;
  compagnia_id: string | null;
  compagnia_nome: string | null;
  destinatario_email: string;
  oggetto: string;
  num_titoli: number;
  stato: string;
  errore: string | null;
  inviato_at: string;
  inviato_da: string | null;
};

type RigaRow = {
  id: string;
  richiesta_id: string;
  titolo_id: string | null;
  numero_polizza: string | null;
  ramo: string | null;
  cliente_nome: string | null;
  premio_lordo: number | null;
  data_scadenza: string | null;
};

const RegistroRichiesteQuietanzaPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [agenziaId, setAgenziaId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { page, setPage, pageSize, range } = useServerPagination(25, [search, agenziaId]);

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie-attive-registro-rq"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnie")
        .select("id, nome")
        .eq("attiva", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: 300_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["registro-richieste-quietanza", page, search, agenziaId],
    queryFn: async () => {
      let q = supabase
        .from("richieste_quietanza" as any)
        .select(
          "id, compagnia_id, compagnia_nome, destinatario_email, oggetto, num_titoli, stato, errore, inviato_at, inviato_da",
          { count: "exact" },
        );

      if (agenziaId) q = q.eq("compagnia_id", agenziaId);
      if (search.trim()) {
        const s = search.trim();
        q = q.or(
          `destinatario_email.ilike.%${s}%,oggetto.ilike.%${s}%,compagnia_nome.ilike.%${s}%`,
        );
      }

      const { data: rows, error, count } = await q
        .order("inviato_at", { ascending: false })
        .range(range.from, range.to);
      if (error) throw error;
      return { rows: (rows || []) as RichiestaRow[], count: count || 0 };
    },
  });

  const rows = data?.rows || [];
  const totalCount = data?.count || 0;

  const expandedIds = Object.keys(expanded).filter((k) => expanded[k]);

  const { data: righeByReq = {} } = useQuery({
    queryKey: ["registro-richieste-quietanza-righe", expandedIds.join(",")],
    enabled: expandedIds.length > 0,
    queryFn: async () => {
      const { data: righe, error } = await supabase
        .from("richieste_quietanza_righe" as any)
        .select("id, richiesta_id, titolo_id, numero_polizza, ramo, cliente_nome, premio_lordo, data_scadenza")
        .in("richiesta_id", expandedIds);
      if (error) throw error;
      const map: Record<string, RigaRow[]> = {};
      for (const r of (righe || []) as RigaRow[]) {
        (map[r.richiesta_id] ||= []).push(r);
      }
      return map;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/portafoglio/estrazioni/richiesta-quietanza")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              Registro richieste quietanza
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Storico degli invii email alle agenzie
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/portafoglio/estrazioni/richiesta-quietanza")}>
          Nuova richiesta
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="h-9 max-w-sm"
          placeholder="Cerca destinatario, oggetto, agenzia…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterSearchableSelect
          value={agenziaId}
          onValueChange={setAgenziaId}
          options={compagnie.map((c) => ({ value: c.id, label: c.nome }))}
          placeholder="Agenzia"
          allLabel="Tutte le agenzie"
          className="w-[240px] h-9"
        />
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-8" />
              <TableHead className="text-xs">Data invio</TableHead>
              <TableHead className="text-xs">Agenzia</TableHead>
              <TableHead className="text-xs">Destinatario</TableHead>
              <TableHead className="text-xs">Oggetto</TableHead>
              <TableHead className="text-xs text-right">N° titoli</TableHead>
              <TableHead className="text-xs">Stato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                  Nessun invio registrato
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const isOpen = !!expanded[r.id];
                const detail = righeByReq[r.id] || [];
                return (
                  <Fragment key={r.id}>
                    <TableRow className="cursor-pointer" onClick={() => setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))}>
                      <TableCell>
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(r.inviato_at)}</TableCell>
                      <TableCell className="text-xs">{r.compagnia_nome || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{r.destinatario_email}</TableCell>
                      <TableCell className="text-xs max-w-[280px] truncate" title={r.oggetto}>
                        {r.oggetto}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{r.num_titoli}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={r.stato === "inviato" ? "default" : "destructive"}>
                          {r.stato === "inviato" ? "Inviato" : "Errore"}
                        </Badge>
                        {r.errore ? (
                          <span className="block text-[10px] text-destructive mt-0.5 truncate max-w-[160px]" title={r.errore}>
                            {r.errore}
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/20 p-0">
                          <div className="p-3">
                            {detail.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nessuna riga dettaglio</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Polizza</TableHead>
                                    <TableHead className="text-xs">Ramo</TableHead>
                                    <TableHead className="text-xs">Cliente</TableHead>
                                    <TableHead className="text-xs text-right">Premio</TableHead>
                                    <TableHead className="text-xs">Scadenza</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {detail.map((d) => (
                                    <TableRow
                                      key={d.id}
                                      className={d.titolo_id ? "cursor-pointer" : undefined}
                                      onClick={() => d.titolo_id && navigate(`/titoli/${d.titolo_id}`)}
                                    >
                                      <TableCell className="text-xs font-mono">{d.numero_polizza || "—"}</TableCell>
                                      <TableCell className="text-xs">{d.ramo || "—"}</TableCell>
                                      <TableCell className="text-xs">{d.cliente_nome || "—"}</TableCell>
                                      <TableCell className="text-xs text-right">{fmtEuro(d.premio_lordo)}</TableCell>
                                      <TableCell className="text-xs">{fmtDate(d.data_scadenza)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
    </div>
  );
};

export default RegistroRichiesteQuietanzaPage;
