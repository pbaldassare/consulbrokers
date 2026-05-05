import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Download, ExternalLink, Inbox, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

export type DrillDomain = "titoli" | "sinistri";

export interface DrillState {
  open: boolean;
  domain: DrillDomain;
  title: string;
  /** Extra filters specific to the click (mese, ramo, cliente_id, stato, ...) */
  extra: Record<string, any>;
}

interface Props {
  state: DrillState;
  onClose: () => void;
  /** Global CFO filters already applied (data_da, data_a, ufficio_id, compagnia_id, produttore_nome) */
  baseFilters: Record<string, any>;
}

const fmtMoney = (n: any) =>
  n == null
    ? "—"
    : `€ ${Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("it-IT") : "—");

export default function CfoDrillDownDialog({ state, onClose, baseFilters }: Props) {
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const params = useMemo(() => {
    if (state.domain === "titoli") {
      return {
        _data_da: baseFilters._data_da ?? null,
        _data_a: baseFilters._data_a ?? null,
        _ufficio_id: baseFilters._ufficio_id ?? null,
        _compagnia_id: baseFilters._compagnia_id ?? null,
        _produttore_nome: baseFilters._produttore_nome ?? null,
        _mese: state.extra._mese ?? null,
        _ramo: state.extra._ramo ?? null,
        _cliente_id: state.extra._cliente_id ?? null,
        _stato: state.extra._stato ?? null,
      };
    }
    return {
      _data_da: baseFilters._data_da ?? null,
      _data_a: baseFilters._data_a ?? null,
      _ufficio_id: baseFilters._ufficio_id ?? null,
      _compagnia_id: baseFilters._compagnia_id ?? null,
      _ramo: state.extra._ramo ?? null,
      _stato: state.extra._stato ?? null,
    };
  }, [state, baseFilters]);

  const rpcName = state.domain === "titoli" ? "cfo_drill_titoli" : "cfo_drill_sinistri";

  const query = useQuery({
    queryKey: [rpcName, params, state.open],
    enabled: state.open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(rpcName as any, params as any);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const rows = query.data || [];
  const paged = rows.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  const exportCSV = () => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]).filter((k) => k !== "id" && k !== "cliente_id");
    const csv = [
      headers.join(";"),
      ...rows.map((r: any) =>
        headers.map((h) => String(r[h] ?? "").replace(/[;\n\r]/g, " ")).join(";"),
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drill_${state.domain}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chips = [
    baseFilters._data_da && `Da: ${baseFilters._data_da}`,
    baseFilters._data_a && `A: ${baseFilters._data_a}`,
    baseFilters._ufficio_id && `Sede attiva`,
    baseFilters._compagnia_id && `Compagnia attiva`,
    baseFilters._produttore_nome && `Produttore: ${baseFilters._produttore_nome}`,
    state.extra._mese && `Mese: ${state.extra._mese}`,
    state.extra._ramo && `Ramo: ${state.extra._ramo}`,
    state.extra._stato && `Stato: ${state.extra._stato}`,
    state.extra._cliente_id && `Cliente specifico`,
  ].filter(Boolean) as string[];

  return (
    <Dialog
      open={state.open}
      onOpenChange={(o) => {
        if (!o) {
          setPage(0);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {chips.length === 0 ? (
              <Badge variant="outline" className="text-xs">Nessun filtro</Badge>
            ) : (
              chips.map((c, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">
                  {c}
                </Badge>
              ))
            )}
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 py-2">
          <p className="text-xs text-muted-foreground">
            {query.isLoading
              ? "Caricamento..."
              : `${rows.length} risultati${rows.length === 500 ? " (limite massimo)" : ""}`}
          </p>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!rows.length}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Esporta CSV
          </Button>
        </div>

        <div className="flex-1 overflow-auto rounded-md border">
          {query.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-destructive">
              <AlertCircle className="w-10 h-10" />
              <p className="text-sm">{(query.error as any)?.message || "Errore nel caricamento"}</p>
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Riprova
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Inbox className="w-10 h-10 opacity-50" />
              <p className="text-sm">Nessun risultato per i filtri selezionati</p>
            </div>
          ) : state.domain === "titoli" ? (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>N. Titolo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Produttore</TableHead>
                  <TableHead className="text-right">Premio</TableHead>
                  <TableHead className="text-right">Provv.</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r: any, i: number) => (
                  <TableRow key={r.id} className={i % 2 ? "bg-muted/20" : ""}>
                    <TableCell className="text-xs">{fmtDate(r.data_incasso)}</TableCell>
                    <TableCell className="font-medium text-xs">{r.numero_titolo || "—"}</TableCell>
                    <TableCell className="text-xs">{r.cliente}</TableCell>
                    <TableCell className="text-xs">{r.ramo}</TableCell>
                    <TableCell className="text-xs">{r.compagnia}</TableCell>
                    <TableCell className="text-xs">{r.sede}</TableCell>
                    <TableCell className="text-xs">{r.produttore}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtMoney(r.premio_lordo)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtMoney(r.provvigioni)}</TableCell>
                    <TableCell>
                      <Badge variant={r.stato === "incassato" ? "default" : "secondary"} className="text-[10px]">
                        {r.stato}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Link to={`/portafoglio/titolo/${r.id}`} title="Apri titolo">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Apertura</TableHead>
                  <TableHead>N. Sinistro</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-right">Liquidato</TableHead>
                  <TableHead className="text-right">Riserva</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r: any, i: number) => (
                  <TableRow key={r.id} className={i % 2 ? "bg-muted/20" : ""}>
                    <TableCell className="text-xs">{fmtDate(r.data_apertura)}</TableCell>
                    <TableCell className="font-medium text-xs">{r.numero_sinistro || "—"}</TableCell>
                    <TableCell className="text-xs">{r.cliente}</TableCell>
                    <TableCell className="text-xs">{r.ramo}</TableCell>
                    <TableCell className="text-xs">{r.compagnia}</TableCell>
                    <TableCell className="text-xs">{r.sede}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtMoney(r.importo_liquidato)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtMoney(r.importo_riserva)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{r.stato}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Link to={`/sinistri/${r.id}`} title="Apri sinistro">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {rows.length > pageSize && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Pagina {page + 1} di {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                Precedente
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                Successiva
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
