import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { formatDateIT } from "@/lib/formatDate";
import { fmtEuro } from "@/lib/formatCurrency";
import {
  detectPresetPeriodo,
  exportPrimaNotaXlsx,
  fetchPrimaNota,
  applySedeFilter,
  groupPrimaNotaBySede,
  normalizeDateRange,
  paginatePrimaNota,
  rangeForPreset,
  resolveSedeLock,
  rowsForPrimaNotaExport,
  todayISODate,
  type PrimaNotaRow,
} from "@/lib/primaNota";
import type { PresetPeriodoIncasso } from "@/lib/comunicazioniIncasso";

const PrimaNotaTable = ({
  rows,
  loading,
}: {
  rows: PrimaNotaRow[];
  loading?: boolean;
}) => {
  const navigate = useNavigate();

  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="text-xs">N. polizza</TableHead>
            <TableHead className="text-xs">Nome cliente</TableHead>
            <TableHead className="text-xs">Agenzia</TableHead>
            <TableHead className="text-xs text-right">Premio incassato</TableHead>
            <TableHead className="text-xs">Data incasso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Caricamento…
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                Nessuna polizza incassata per i filtri selezionati
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.titoloId}>
                <TableCell
                  className="text-xs font-mono cursor-pointer hover:underline"
                  onClick={() => navigate(`/titoli/${r.titoloId}`)}
                >
                  {r.numeroPolizza}
                </TableCell>
                <TableCell className="text-xs">{r.clienteNome}</TableCell>
                <TableCell className="text-xs">{r.agenziaNome}</TableCell>
                <TableCell className="text-xs text-right tabular-nums whitespace-nowrap">
                  {fmtEuro(r.premioIncassato)}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">{formatDateIT(r.dataIncasso)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const PrimaNotaPage = () => {
  const navigate = useNavigate();
  const { isAdmin, profile, loading: authLoading } = useAuth();
  const { seeAllSedi, sedeLockedId, authReady } = resolveSedeLock({
    authLoading,
    isAdmin,
    ruolo: profile?.ruolo,
    ufficioId: profile?.ufficio_id,
    hasProfile: !!profile,
  });

  const [dateDa, setDateDa] = useState(() => todayISODate());
  const [dateA, setDateA] = useState(() => todayISODate());
  const [agenziaId, setAgenziaId] = useState<string | null>(null);

  const presetPeriodo = detectPresetPeriodo(dateDa, dateA);
  const { page, setPage, pageSize } = useServerPagination(25, [dateDa, dateA, agenziaId, sedeLockedId]);

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie-attive-prima-nota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnie")
        .select("id, nome, codice")
        .eq("attiva", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: 300_000,
  });

  const agenziaOpts = useMemo(
    () =>
      compagnie.map((c) => ({
        value: c.id,
        label: c.nome,
        description: c.codice || undefined,
        searchText: `${c.nome} ${c.codice || ""}`,
      })),
    [compagnie],
  );

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["prima-nota", dateDa, dateA, agenziaId, sedeLockedId, seeAllSedi],
    enabled: authReady,
    queryFn: () =>
      fetchPrimaNota({
        dataDa: dateDa,
        dataA: dateA,
        ufficioId: sedeLockedId,
        agenziaId,
      }),
  });

  const scopedRows = useMemo(
    () => applySedeFilter(allRows, sedeLockedId),
    [allRows, sedeLockedId],
  );
  const gruppi = useMemo(
    () => (seeAllSedi ? groupPrimaNotaBySede(scopedRows) : []),
    [seeAllSedi, scopedRows],
  );
  const paged = useMemo(
    () => (seeAllSedi ? scopedRows : paginatePrimaNota(scopedRows, page, pageSize)),
    [seeAllSedi, scopedRows, page, pageSize],
  );

  const applyPreset = (preset: Exclude<PresetPeriodoIncasso, "personalizzato">) => {
    const range = rangeForPreset(preset);
    setDateDa(range.da);
    setDateA(range.a);
  };

  const applyCustomRange = (nextDa: string, nextA: string) => {
    const range = normalizeDateRange(nextDa || dateDa, nextA || dateA);
    setDateDa(range.da);
    setDateA(range.a);
  };

  const resetFilters = () => {
    applyPreset("oggi");
    setAgenziaId(null);
  };

  const handleExport = () => {
    const rows = rowsForPrimaNotaExport(scopedRows, seeAllSedi);
    if (rows.length === 0) return;
    exportPrimaNotaXlsx(rows, { dataDa: dateDa, dataA: dateA, includeSede: seeAllSedi });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              Prima nota
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Polizze incassate nel periodo. Default: oggi
              {seeAllSedi ? " — tutte le sedi, raggruppate." : " — solo la tua sede."}
            </p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={scopedRows.length === 0 || isLoading}>
          <FileSpreadsheet className="h-4 w-4 mr-1" />
          Esporta Excel
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Periodo di incasso</p>
              <ToggleGroup
                type="single"
                value={presetPeriodo === "personalizzato" ? "" : presetPeriodo}
                onValueChange={(v) => {
                  if (v === "oggi" || v === "mese_corrente") applyPreset(v);
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="oggi" className="h-9 px-3 text-xs">
                  Oggi
                </ToggleGroupItem>
                <ToggleGroupItem value="mese_corrente" className="h-9 px-3 text-xs">
                  Mese corrente
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dal</p>
              <Input
                type="date"
                className="h-9 w-[160px]"
                value={dateDa}
                onChange={(e) => applyCustomRange(e.target.value, dateA)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Al</p>
              <Input
                type="date"
                className="h-9 w-[160px]"
                value={dateA}
                onChange={(e) => applyCustomRange(dateDa, e.target.value)}
              />
            </div>
            <FilterSearchableSelect
              value={agenziaId}
              onValueChange={setAgenziaId}
              options={agenziaOpts}
              placeholder="Agenzia"
              allLabel="Tutte le agenzie"
              className="w-[260px] h-9"
            />
            <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset (oggi)
            </Button>
          </div>
        </CardContent>
      </Card>

      {!authReady ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          Verifica sede…
        </div>
      ) : seeAllSedi ? (
        gruppi.length === 0 && !isLoading ? (
          <PrimaNotaTable rows={[]} />
        ) : isLoading ? (
          <PrimaNotaTable rows={[]} loading />
        ) : (
          <div className="space-y-6">
            {gruppi.map((g) => (
              <section key={g.sedeId} className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {g.sedeNome}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {g.rows.length} polizz{g.rows.length === 1 ? "a" : "e"}
                  </span>
                </h2>
                <PrimaNotaTable rows={g.rows} />
              </section>
            ))}
          </div>
        )
      ) : (
        <>
          <PrimaNotaTable rows={paged} loading={isLoading} />
          <ServerPagination
            page={page}
            pageSize={pageSize}
            totalCount={scopedRows.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
};

export default PrimaNotaPage;
