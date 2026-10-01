import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Coins,
  ExternalLink,
  FileText,
  Hash,
  Loader2,
  Package,
  Printer,
  Receipt,
  RotateCcw,
  Save,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useDebouncedClienteSearch } from "@/hooks/useClienteSearch";
import { useRamiAll } from "@/hooks/useRamiLookup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ServerPagination from "@/components/ServerPagination";
import { UfficiFilterMultiSelect } from "@/components/portafoglio/UfficiFilterMultiSelect";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { RamoSottoramoFilter, expandRamoFilter } from "@/components/polizze/RamoSottoramoFilter";
import { TipoPolizzaBadge } from "@/components/polizze/TipoPolizzaBadge";
import { SortableTableHead, nextSort } from "@/components/shared/SortableTableHead";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { buildIncassiCoperturePdf } from "@/lib/incassi-coperture-pdf";
import { fmtEuro } from "@/lib/formatCurrency";
import { fetchAllQueryPages } from "@/lib/movimentiBancari";
import { applySedeFilter, rowHref } from "@/lib/portafoglioCarico/filters";
import {
  applyCassaSearch,
  applyRiepilogoCassaDate,
  buildRiepilogoTree,
  dataMessaCassaLabel,
  flattenAgenzia,
  importiTitolo,
  labelPeriodoCassa,
  RIEPILOGO_CASSA_SELECT,
  tipoIncassoCassaLabel,
  totaliDaTitoli,
  viewRowToTitoloCassa,
  type PeriodoRiepilogoCassa,
  type TitoloCassa,
} from "@/lib/riepilogoMesseACassa";
import {
  resolveTipoPagamentoBadgeVariant,
  resolveTipoPagamentoLabelEcAgenzia,
} from "@/lib/ecAgenziaDisplay";
import {
  isMessaACassa,
  isQuietanzaRow,
  messaCassaRowBgClass,
  rowBorderClass,
} from "@/lib/polizzeDisplay";

const SORT_COLS = new Set([
  "data_messa_cassa",
  "numero_titolo",
  "cliente_nome_display",
  "compagnia_nome",
  "ramo_nome",
  "premio_lordo",
]);

type ViewRow = Record<string, any>;

function rowTipo(p: ViewRow): "polizza" | "quietanza" | "appendice" {
  if (p.is_appendice_modifica || p.is_regolazione || p.is_proroga) return "appendice";
  if (isQuietanzaRow(p) || (Number(p.numero_rata) || 0) > 1) return "quietanza";
  return "polizza";
}

function appendiceLabel(p: ViewRow): string | null {
  if (p.is_proroga) return "Proroga";
  if (p.is_regolazione) return "Regolazione";
  if (p.is_appendice_modifica) return "Modifica";
  return null;
}

const ContabilitaUfficio = () => {
  const navigate = useNavigate();
  const { isAdmin, profile, loading: authLoading } = useAuth() as any;
  const isCfo = profile?.ruolo === "cfo";
  const seeAllSedi = isAdmin || isCfo;
  const sedeLockedId = !seeAllSedi && profile?.ufficio_id ? profile.ufficio_id : null;
  const authReady = !authLoading && !!profile && (seeAllSedi || !!sedeLockedId);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedClienteSearch(search, 350);
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoRiepilogoCassa>("mese_corrente");
  const [dateDa, setDateDa] = useState("");
  const [dateA, setDateA] = useState("");
  const [filtroUffici, setFiltroUffici] = useState<string[]>([]);
  const [filtroCompagnia, setFiltroCompagnia] = useState<string | null>(null);
  const [filtroGruppoRamo, setFiltroGruppoRamo] = useState<string | null>(null);
  const [filtroRamo, setFiltroRamo] = useState<string | null>(null);
  const [sortField, setSortField] = useState("data_messa_cassa");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [busy, setBusy] = useState(false);

  const { data: ramiAll = [] } = useRamiAll();
  const { ramoIds: filterRamoIds } = expandRamoFilter(filtroGruppoRamo, filtroRamo, ramiAll);

  useEffect(() => {
    if (!sedeLockedId) return;
    setFiltroUffici((prev) => (prev.length === 1 && prev[0] === sedeLockedId ? prev : [sedeLockedId]));
  }, [sedeLockedId]);

  const applySede = (q: any) => {
    if (sedeLockedId) return q.eq("ufficio_id", sedeLockedId);
    return applySedeFilter(q, filtroUffici);
  };

  const applyFilters = (q: any) => {
    q = applyRiepilogoCassaDate(q, { dateDa, dateA, filtroPeriodo });
    q = applyCassaSearch(q, debouncedSearch);
    q = applySede(q);
    if (filtroCompagnia) q = q.eq("compagnia_id", filtroCompagnia);
    if (filterRamoIds && filterRamoIds.length > 0) q = q.in("ramo_id", filterRamoIds);
    return q;
  };

  const { page, setPage, pageSize, range } = useServerPagination(25, [
    debouncedSearch,
    filtroPeriodo,
    dateDa,
    dateA,
    filtroUffici.join(","),
    filtroCompagnia,
    filtroGruppoRamo,
    filtroRamo,
    sortField,
    sortDirection,
    sedeLockedId,
  ]);

  const filterKey = [
    "riepilogo-messe-cassa",
    debouncedSearch,
    filtroPeriodo,
    dateDa,
    dateA,
    filtroUffici.join(","),
    filtroCompagnia,
    (filterRamoIds || []).join(","),
    sedeLockedId,
  ] as const;

  const { data: result, isLoading, isError, error: listError, refetch } = useQuery({
    queryKey: [...filterKey, page, sortField, sortDirection],
    enabled: authReady,
    retry: 1,
    staleTime: 15_000,
    queryFn: async () => {
      let q = supabase.from("v_portafoglio_quietanze").select(RIEPILOGO_CASSA_SELECT, { count: "exact" });
      q = applyFilters(q);
      const col = SORT_COLS.has(sortField) ? sortField : "data_messa_cassa";
      q = q.order(col, { ascending: sortDirection === "asc" });
      const { data, count, error } = await q.range(range.from, range.to);
      if (error) throw new Error(error.message || "Errore caricamento messe a cassa");
      return { data: (data || []) as ViewRow[], count: count || 0 };
    },
  });

  const rows = result?.data || [];
  const totalCount = result?.count || 0;
  const pageIds = useMemo(() => rows.map((r) => r.id).filter(Boolean), [rows]);

  const { data: tipoPagMap = {} } = useQuery({
    queryKey: ["riepilogo-cassa-tipo-pag", pageIds.join(",")],
    enabled: pageIds.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("titoli").select("id, tipo_pagamento").in("id", pageIds);
      if (error) throw error;
      const map: Record<string, string | null> = {};
      for (const t of data || []) map[t.id] = (t as any).tipo_pagamento ?? null;
      return map;
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["agenzie-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      if (error) throw error;
      return (data || []) as Array<{ id: string; nome: string }>;
    },
    staleTime: 60_000,
  });

  const compagniaOptions = useMemo(
    () => compagnie.map((c) => ({ value: c.id, label: c.nome })),
    [compagnie],
  );

  const { data: totaliCassa } = useQuery({
    queryKey: [...filterKey, "totali"],
    enabled: authReady,
    retry: 1,
    staleTime: 15_000,
    queryFn: async () => {
      const batchSize = 1000;
      const slim: ViewRow[] = [];
      for (let from = 0; from < 20_000; from += batchSize) {
        let q = supabase
          .from("v_portafoglio_quietanze")
          .select("premio_lordo, provvigioni_firma, provvigioni_quietanza");
        q = applyFilters(q);
        const { data, error } = await q.range(from, from + batchSize - 1);
        if (error) throw new Error(error.message || "Errore totali messe a cassa");
        const batch = data || [];
        slim.push(...batch);
        if (batch.length < batchSize) break;
      }
      return totaliDaTitoli(slim.map((r) => viewRowToTitoloCassa(r)));
    },
  });

  const kpi = {
    count: totalCount,
    premio_lordo: totaliCassa?.premio_lordo ?? 0,
    provvigioni: totaliCassa?.provvigioni ?? 0,
    da_rimettere: totaliCassa?.da_rimettere ?? 0,
  };
  const periodoLabel = labelPeriodoCassa({ dateDa, dateA, filtroPeriodo });

  const hasActiveFilters =
    !!dateDa ||
    !!dateA ||
    !!debouncedSearch ||
    filtroPeriodo !== "mese_corrente" ||
    (!sedeLockedId && filtroUffici.length > 0) ||
    !!filtroCompagnia ||
    !!filtroGruppoRamo ||
    !!filtroRamo;

  const resetFilters = () => {
    setDateDa("");
    setDateA("");
    setSearch("");
    setFiltroPeriodo("mese_corrente");
    setFiltroUffici(sedeLockedId ? [sedeLockedId] : []);
    setFiltroCompagnia(null);
    setFiltroGruppoRamo(null);
    setFiltroRamo(null);
    setPage(0);
  };

  const handleSort = (field: string) => {
    const next = nextSort(sortField, sortDirection, field);
    setSortField(next.field);
    setSortDirection(next.direction);
    setPage(0);
  };

  const fetchAllFilteredTitoli = useCallback(async (): Promise<TitoloCassa[]> => {
    const viewRows = await fetchAllQueryPages<ViewRow>(async (from, to) => {
      if (from >= 20_000) return { data: [], error: null };
      let q = supabase.from("v_portafoglio_quietanze").select(RIEPILOGO_CASSA_SELECT);
      q = applyFilters(q);
      return q.order("data_messa_cassa", { ascending: false }).range(from, to);
    }, 1000);

    const ids = viewRows.map((r) => r.id).filter(Boolean);
    const pagMap: Record<string, string | null> = {};
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await supabase.from("titoli").select("id, tipo_pagamento").in("id", chunk);
      if (error) throw error;
      for (const t of data || []) pagMap[t.id] = (t as any).tipo_pagamento ?? null;
    }

    return viewRows.map((r) => viewRowToTitoloCassa({ ...r, tipo_pagamento: pagMap[r.id] ?? null }));
  }, [
    dateDa,
    dateA,
    filtroPeriodo,
    debouncedSearch,
    filtroUffici,
    filtroCompagnia,
    filterRamoIds,
    sedeLockedId,
  ]);

  const buildPdfData = (titoli: TitoloCassa[], agenziaNome?: string) => {
    const albero = buildRiepilogoTree(titoli);
    const gruppi = albero.map((g) => {
      const flat = flattenAgenzia(g);
      return {
        agenzia: g.nome,
        count: g.count,
        premio_lordo: g.premio_lordo,
        provvigioni: g.provvigioni,
        da_rimettere: g.da_rimettere,
        titoli: flat.map((t) => {
          const { lordo, provv, netto } = importiTitolo(t);
          return {
            numero_titolo: t.numero_titolo,
            cliente: t.clienti?.ragione_sociale || "—",
            premio_lordo: lordo,
            provvigioni: provv,
            netto,
            tipo_pagamento: resolveTipoPagamentoLabelEcAgenzia(t.tipo_pagamento),
            tipo_incasso: `${tipoIncassoCassaLabel(t)} · ${dataMessaCassaLabel(t.data_messa_cassa)}`,
          };
        }),
      };
    });
    const totali = totaliDaTitoli(titoli);
    return {
      meseLabel: periodoLabel,
      sedeNome: profile?.ufficio?.nome_ufficio || profile?.nome_ufficio || "Sede",
      generatoIl: format(new Date(), "dd/MM/yyyy HH:mm"),
      filtroAgenzia: agenziaNome || debouncedSearch || undefined,
      gruppi,
      totali,
    };
  };

  const fileName = () => {
    const slug = format(new Date(), "yyyy-MM-dd");
    return `Riepilogo_Messe_a_Cassa_${slug}.pdf`;
  };

  const handleStampa = async () => {
    try {
      setBusy(true);
      const titoli = await fetchAllFilteredTitoli();
      if (titoli.length === 0) {
        toast.error("Nessun titolo da stampare con i filtri attivi");
        return;
      }
      const bytes = await buildIncassiCoperturePdf(buildPdfData(titoli));
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const w = window.open(url, "_blank");
      if (w) w.addEventListener("load", () => { try { w.print(); } catch { /* ignore */ } });
    } catch (e: any) {
      toast.error("Errore stampa: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const handleSalva = async () => {
    try {
      setBusy(true);
      const titoli = await fetchAllFilteredTitoli();
      if (titoli.length === 0) {
        toast.error("Nessun titolo da esportare con i filtri attivi");
        return;
      }
      const bytes = await buildIncassiCoperturePdf(buildPdfData(titoli));
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const name = fileName();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      const entitaId = profile?.ufficio_id || null;
      if (entitaId) {
        const path = `sede/${entitaId}/incassi_coperture/${Date.now()}_${name}`;
        const { error: upErr } = await supabase.storage
          .from("documenti_generali")
          .upload(path, blob, { contentType: "application/pdf", upsert: false });
        if (upErr) throw upErr;
        const { data: u } = await supabase.auth.getUser();
        const { error: dbErr } = await supabase.from("documenti").insert({
          nome_file: name,
          path_storage: path,
          bucket_name: "documenti_generali",
          entita_tipo: "sede",
          entita_id: entitaId,
          categoria: "Riepilogo Messe a Cassa",
          visibile_al_cliente: false,
          caricato_da: u?.user?.id ?? null,
        } as any);
        if (dbErr) throw dbErr;
        await logAttivita({
          azione: "stampa_incassi_coperture",
          entita_tipo: "sede",
          entita_id: entitaId,
          dettagli_json: { periodo: periodoLabel, titoli: titoli.length },
        });
        toast.success("PDF salvato e archiviato");
      } else {
        toast.success("PDF generato");
      }
    } catch (e: any) {
      toast.error("Errore salvataggio: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-10 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-1 pb-3 space-y-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Riepilogo Messe a Cassa</h1>
            <p className="text-sm text-muted-foreground">
              Titoli con data messa a cassa — {periodoLabel}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleStampa} disabled={busy || totalCount === 0}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Printer className="w-4 h-4 mr-1" />}
              Stampa
            </Button>
            <Button size="sm" onClick={handleSalva} disabled={busy || totalCount === 0}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Salva PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2 pt-3">
              <CardDescription className="flex items-center gap-1 text-xs">
                <Hash className="w-3.5 h-3.5" /> Titoli a cassa
              </CardDescription>
              <CardTitle className="text-xl">{isLoading && !result ? "…" : kpi.count}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2 pt-3">
              <CardDescription className="flex items-center gap-1 text-xs">
                <FileText className="w-3.5 h-3.5" /> Premio lordo
              </CardDescription>
              <CardTitle className="text-xl text-blue-600">{fmtEuro(kpi.premio_lordo)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2 pt-3">
              <CardDescription className="flex items-center gap-1 text-xs">
                <Coins className="w-3.5 h-3.5" /> Provvigioni
              </CardDescription>
              <CardTitle className="text-xl text-green-600">{fmtEuro(kpi.provvigioni)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2 pt-3">
              <CardDescription className="flex items-center gap-1 text-xs">
                <Receipt className="w-3.5 h-3.5" /> Da rimettere
              </CardDescription>
              <CardTitle className="text-xl text-orange-600">{fmtEuro(kpi.da_rimettere)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca n° polizza, cliente, codice, targa, agenzia..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-9"
            />
          </div>
          {seeAllSedi && (
            <UfficiFilterMultiSelect
              value={filtroUffici}
              onChange={(next) => {
                setFiltroUffici(next);
                setPage(0);
              }}
            />
          )}
          <FilterSearchableSelect
            value={filtroCompagnia}
            onValueChange={(v) => {
              setFiltroCompagnia(v);
              setPage(0);
            }}
            options={compagniaOptions}
            placeholder="Agenzia"
            allLabel="Tutte le agenzie"
            className="w-[220px]"
          />
          <RamoSottoramoFilter
            gruppoRamoId={filtroGruppoRamo}
            ramoId={filtroRamo}
            onChange={({ gruppoRamoId, ramoId }) => {
              setFiltroGruppoRamo(gruppoRamoId);
              setFiltroRamo(ramoId);
              setPage(0);
            }}
          />
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground" title="Data messa a cassa">Dal</span>
            <Input
              type="date"
              value={dateDa}
              onChange={(e) => {
                const v = e.target.value;
                setDateDa(v);
                setPage(0);
                if (v || dateA) setFiltroPeriodo("tutte");
              }}
              className="w-[150px]"
            />
            <span className="text-xs text-muted-foreground ml-1">Al</span>
            <Input
              type="date"
              value={dateA}
              onChange={(e) => {
                const v = e.target.value;
                setDateA(v);
                setPage(0);
                if (v || dateDa) setFiltroPeriodo("tutte");
              }}
              className="w-[150px]"
            />
            <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">(messa a cassa)</span>
          </div>
          <ToggleGroup
            type="single"
            value={filtroPeriodo}
            onValueChange={(v) => {
              if (!v) return;
              setFiltroPeriodo(v as PeriodoRiepilogoCassa);
              if (v === "mese_corrente") {
                setDateDa("");
                setDateA("");
              }
              setPage(0);
            }}
            className="border rounded-md"
          >
            <ToggleGroupItem
              value="mese_corrente"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Mese corrente
            </ToggleGroupItem>
            <ToggleGroupItem
              value="tutte"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Tutte
            </ToggleGroupItem>
          </ToggleGroup>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filtri
            </Button>
          )}
        </div>
      </div>

      {isLoading || !authReady ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento...</div>
      ) : isError ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-destructive">
            Errore caricamento: {(listError as Error)?.message || "riprova"}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Riprova
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nessun titolo messo a cassa con i filtri selezionati
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="w-5 h-5" />
                {totalCount} {totalCount === 1 ? "titolo" : "titoli"} · {periodoLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border-0 overflow-x-auto">
                <Table>
                  <TableHeader className="[&_tr]:border-b sticky top-0 z-[5] bg-background shadow-sm">
                    <TableRow className="hover:bg-background">
                      <SortableTableHead field="numero_titolo" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                        N° Polizza
                      </SortableTableHead>
                      <TableHead>Tipo</TableHead>
                      <SortableTableHead field="cliente_nome_display" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                        Cliente
                      </SortableTableHead>
                      <SortableTableHead field="compagnia_nome" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                        Agenzia
                      </SortableTableHead>
                      <SortableTableHead field="ramo_nome" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                        Garanzia
                      </SortableTableHead>
                      <SortableTableHead field="data_messa_cassa" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                        Data cassa
                      </SortableTableHead>
                      <SortableTableHead field="premio_lordo" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-right">
                        Lordo
                      </SortableTableHead>
                      <TableHead className="text-right">Provvigioni</TableHead>
                      <TableHead className="text-right">Da rimettere</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Incasso</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((p) => {
                      const t = viewRowToTitoloCassa({ ...p, tipo_pagamento: tipoPagMap[p.id] ?? p.tipo_pagamento });
                      const { lordo, provv, da_rimettere } = importiTitolo(t);
                      const tp = t.tipo_pagamento;
                      const tipo = rowTipo(p);
                      const href = rowHref(p);
                      return (
                        <TableRow
                          key={p.id}
                          className={`cursor-pointer ${rowBorderClass(p)} ${messaCassaRowBgClass(p)}`}
                          onClick={() => href && navigate(href)}
                        >
                          <TableCell className="font-mono text-sm">{p.numero_titolo || "—"}</TableCell>
                          <TableCell>
                            <TipoPolizzaBadge
                              tipo={tipo}
                              numero={p.numero_rata || undefined}
                              totale={p.numero_rate_totali || undefined}
                              messaACassa={isMessaACassa(p)}
                              appendiceLabel={appendiceLabel(p)}
                            />
                          </TableCell>
                          <TableCell>{p.cliente_nome_display || "—"}</TableCell>
                          <TableCell>{p.compagnia_nome || "—"}</TableCell>
                          <TableCell>{p.ramo_nome || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {dataMessaCassaLabel(p.data_messa_cassa)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{fmtEuro(lordo)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{fmtEuro(provv)}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">{fmtEuro(da_rimettere)}</TableCell>
                          <TableCell>
                            <Badge variant={resolveTipoPagamentoBadgeVariant(tp)} className="text-xs">
                              {resolveTipoPagamentoLabelEcAgenzia(tp)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {t.conferimento_gestito ? (
                              <Badge variant={t.fondi_ricevuti ? "default" : "secondary"} className="text-xs">
                                {tipoIncassoCassaLabel(t)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {tipoIncassoCassaLabel(t)}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <ExternalLink className="w-3 h-3 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default ContabilitaUfficio;
