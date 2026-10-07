import { useMemo, useState } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Shield, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NuovaPolizzaButton } from "@/components/shared/NuovaPolizzaButton";
import { format, startOfMonth, endOfMonth } from "date-fns";
import ServerPagination from "@/components/ServerPagination";
import { RamoSottoramoFilter, expandRamoFilter } from "@/components/polizze/RamoSottoramoFilter";
import { useRamiAll } from "@/hooks/useRamiLookup";
import { useCompensazioniByTitoli } from "@/hooks/useCompensazioniByTitoli";
import { CompensazioneBadge } from "@/components/portafoglio/CompensazioneBadge";
import { TipoPolizzaBadge } from "@/components/polizze/TipoPolizzaBadge";
import { SortableTableHead, nextSort } from "@/components/shared/SortableTableHead";
import { datePeriodoPolizzaGaranzia } from "@/lib/datePolizzaGaranzia";
import { rowBorderClass, isQuietanzaRow, isPolizzaMadreRow, messaCassaRowBgClass, isMessaACassa } from "@/lib/polizzeDisplay";
import { applyPortafoglioTipoOrder, isTipoSortField, TIPO_SORT_FIELD } from "@/lib/portafoglioTipoSort";
import { cn } from "@/lib/utils";

const ROW_SELECT =
  "id, quietanza_id, polizza_id, numero_titolo, compagnia_nome, ramo_nome, cliente_nome_display, cliente_codice, cliente_anagrafica_id, stato, garanzia_da, garanzia_a, durata_da, durata_a, data_scadenza, premio_lordo, rate, ae_nome, specialist, produttore_nome, produttori_display, provvigioni_firma, provvigioni_quietanza, targa_telaio, compagnia_id, ramo_id, sostituisce_polizza, is_regolazione, is_proroga, is_appendice_modifica, regolazione_quietanza_id, numero_rata, numero_rate_totali";

type PortafoglioRow = Record<string, any>;

const rowHref = (p: PortafoglioRow) =>
  p?.sostituisce_polizza
    ? `/quietanze/${p.quietanza_id}`
    : `/polizze/${p.polizza_id}`;

const PortafoglioAttivePage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filtroGruppoRamo, setFiltroGruppoRamo] = useState<string | null>(null);
  const [filtroRamo, setFiltroRamo] = useState<string | null>(null);
  const [escludiMeseCorrente, setEscludiMeseCorrente] = useState(true);
  const [sortField, setSortField] = useState("fineGaranzia");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const today = format(new Date(), "yyyy-MM-dd");
  const inizioMese = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const fineMese = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const { data: ramiAll = [] } = useRamiAll();
  const { ramoIds: filterRamoIds } = expandRamoFilter(filtroGruppoRamo, filtroRamo, ramiAll);
  const { page, setPage, pageSize, range } = useServerPagination(25, [
    search,
    filtroGruppoRamo,
    filtroRamo,
    escludiMeseCorrente,
    sortField,
    sortDirection,
  ]);

  const applyBaseFilters = (q: any) => {
    let next = q
      .in("stato", ["attivo", "sospeso"])
      .gte("garanzia_a", today);
    if (escludiMeseCorrente) {
      next = next.or(`data_scadenza.lt.${inizioMese},data_scadenza.gt.${fineMese},data_scadenza.is.null`);
    }
    if (search) {
      next = next.or(
        `numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%,targa_telaio.ilike.%${search}%`,
      );
    }
    if (filterRamoIds && filterRamoIds.length > 0) next = next.in("ramo_id", filterRamoIds);
    return next;
  };

  const { data: result, isLoading } = useQuery({
    queryKey: ["portafoglio-attive", search, filterRamoIds, page, today, escludiMeseCorrente, sortField, sortDirection],
    queryFn: async () => {
      let q = applyBaseFilters(
        supabase.from("v_portafoglio_quietanze").select(ROW_SELECT, { count: "exact" }),
      );
      if (isTipoSortField(sortField)) {
        q = applyPortafoglioTipoOrder(q, sortDirection === "asc");
      } else {
        const orderCol =
          sortField === "ramo_nome" ? "ramo_nome"
          : sortField === "inizioPolizza" ? "durata_da"
          : sortField === "finePolizza" ? "durata_a"
          : sortField === "inizioGaranzia" ? "garanzia_da"
          : "garanzia_a";
        q = q.order(orderCol, { ascending: sortDirection === "asc" });
      }
      const { data, count, error } = await q.range(range.from, range.to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const polizze = result?.data || [];
  const totalCount = result?.count || 0;

  const titoloIdsRiga = useMemo(() => polizze.map((p: PortafoglioRow) => p.id), [polizze]);
  const { data: compensazioniMap } = useCompensazioniByTitoli(titoloIdsRiga);

  const { data: totaleData } = useQuery({
    queryKey: ["portafoglio-attive-totale", search, filterRamoIds, today, escludiMeseCorrente],
    queryFn: async () => {
      const q = applyBaseFilters(supabase.from("v_portafoglio_quietanze").select("premio_lordo"));
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).reduce((sum: number, r: any) => sum + (Number(r.premio_lordo) || 0), 0);
    },
  });

  const fmtCurrency = (v: number | null) =>
    v != null ? `€ ${Number(v).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—";

  const fmtDate = (d: string | null) =>
    d ? format(new Date(d), "dd/MM/yyyy") : "—";

  const frazLabel = (r: number | null) => {
    if (!r) return "—";
    const map: Record<number, string> = { 1: "Ann.", 2: "Sem.", 3: "Trim.", 4: "Quad.", 12: "Mens." };
    return map[r] || String(r);
  };

  const handleSort = (field: string) => {
    const next = nextSort(sortField, sortDirection, field);
    setSortField(next.field);
    setSortDirection(next.direction);
    setPage(0);
  };

  const renderTipoCell = (p: PortafoglioRow) => {
    const isQ = isQuietanzaRow(p);
    return (
      <TableCell>
        <div className="flex gap-1 flex-wrap">
          {p.is_proroga ? (
            <Badge className="bg-blue-500 hover:bg-blue-600 text-white" title="Titolo di proroga">
              Proroga
            </Badge>
          ) : p.is_regolazione ? (
            <Badge className="bg-orange-500 hover:bg-orange-600 text-white" title="Titolo di Regolazione Premio">
              Regolazione
            </Badge>
          ) : p.is_appendice_modifica ? (
            <Badge variant="secondary" title="Appendice di modifica">
              Modifica
            </Badge>
          ) : isQ ? (
            <TipoPolizzaBadge
              tipo="quietanza"
              messaACassa={isMessaACassa(p)}
              numero={p.numero_rata ?? undefined}
              totale={p.numero_rate_totali ?? undefined}
            />
          ) : (
            <TipoPolizzaBadge tipo="polizza" messaACassa={isMessaACassa(p)} />
          )}
          {p.stato === "sospeso" && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-700 bg-yellow-50">
              Sospesa
            </Badge>
          )}
          <CompensazioneBadge summary={compensazioniMap?.get(p.id)} titoloId={p.id} />
        </div>
      </TableCell>
    );
  };

  const renderDataCells = (p: PortafoglioRow, dates?: ReturnType<typeof datePeriodoPolizzaGaranzia>) => {
    const d = dates || datePeriodoPolizzaGaranzia(p);
    return (
    <>
      <TableCell>{p.cliente_nome_display || "—"}</TableCell>
      <TableCell>{isQuietanzaRow(p) ? fmtDate(p.garanzia_da ?? d.inizioGaranzia) : "—"}</TableCell>
      <TableCell>{isQuietanzaRow(p) ? fmtDate(p.garanzia_a ?? d.fineGaranzia) : "—"}</TableCell>
      <TableCell>{p.compagnia_nome || "—"}</TableCell>
      <TableCell>{p.ramo_nome || "—"}</TableCell>
      <TableCell>{isPolizzaMadreRow(p) ? fmtDate(d.inizioPolizza) : "—"}</TableCell>
      <TableCell>{isPolizzaMadreRow(p) ? fmtDate(d.finePolizza) : "—"}</TableCell>
      <TableCell className="font-mono text-xs">{p.targa_telaio || "—"}</TableCell>
      <TableCell>{frazLabel(p.rate)}</TableCell>
      <TableCell className="text-right">{fmtCurrency(p.premio_lordo)}</TableCell>
      <TableCell className="text-right">{fmtCurrency(p.provvigioni_firma)}</TableCell>
      <TableCell className="text-right">{fmtCurrency(p.provvigioni_quietanza)}</TableCell>
      <TableCell className="text-sm">{p.ae_nome || "—"}</TableCell>
      <TableCell className="text-sm">{p.specialist || "—"}</TableCell>
      <TableCell className="text-sm max-w-[200px] truncate" title={p.produttori_display || p.produttore_nome || undefined}>{p.produttori_display || p.produttore_nome || "—"}</TableCell>
    </>
    );
  };

  const renderRow = (p: PortafoglioRow) => {
    const dates = datePeriodoPolizzaGaranzia(p);
    const isQ = isQuietanzaRow(p);
    return (
      <TableRow
        key={p.id}
        className={cn(
          "cursor-pointer",
          rowBorderClass(p),
          messaCassaRowBgClass(p),
          !isMessaACassa(p) && isQ && "hover:bg-muted/40",
          p.is_regolazione && "bg-orange-50/40",
          p.is_proroga && "bg-blue-50/40",
          p.is_appendice_modifica && "bg-primary/5",
        )}
        onClick={() => navigate(rowHref(p))}
        title="Apri titolo"
      >
        <TableCell className="font-mono text-xs">
          {p.is_proroga && (
            <span className="text-blue-600 mr-1" title="Proroga collegata">↳</span>
          )}
          {p.is_regolazione && !p.is_proroga && (
            <span className="text-orange-600 mr-1" title="Regolazione collegata">↳</span>
          )}
          {p.is_appendice_modifica && !p.is_proroga && !p.is_regolazione && (
            <span className="text-primary mr-1" title="Appendice modifica">↳</span>
          )}
          {p.numero_titolo || "—"}
        </TableCell>
        {renderTipoCell(p)}
        <TableCell onClick={(e) => e.stopPropagation()}>
          {isQ && p.polizza_id ? (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 font-mono text-xs"
              onClick={() => navigate(`/polizze/${p.polizza_id}`)}
            >
              {p.numero_titolo || "—"}
            </Button>
          ) : (
            "—"
          )}
        </TableCell>
        {renderDataCells(p, dates)}
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Polizze Attive</h1>
          <p className="text-sm text-muted-foreground">Polizze in corso di validità</p>
        </div>
        <NuovaPolizzaButton />
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Titoli attivi</p>
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            {totaleData != null && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Premio lordo filtrato: {fmtCurrency(totaleData)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per n° polizza, cliente, codice, targa..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <RamoSottoramoFilter
          gruppoRamoId={filtroGruppoRamo}
          ramoId={filtroRamo}
          onChange={({ gruppoRamoId, ramoId }) => {
            setFiltroGruppoRamo(gruppoRamoId);
            setFiltroRamo(ramoId);
            setPage(0);
          }}
        />
        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="escludi-mese"
            checked={escludiMeseCorrente}
            onCheckedChange={(v) => {
              setEscludiMeseCorrente(v);
              setPage(0);
            }}
          />
          <Label htmlFor="escludi-mese" className="text-sm cursor-pointer whitespace-nowrap">
            Escludi scadenze del mese
          </Label>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento...</div>
      ) : polizze.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Nessun titolo trovato</div>
      ) : (
        <>
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Polizza</TableHead>
                  <SortableTableHead field={TIPO_SORT_FIELD} sortField={sortField} sortDirection={sortDirection} onSort={handleSort} title="Ordina per tipo">Tipo</SortableTableHead>
                  <TableHead>Polizza madre</TableHead>
                  <TableHead>Cliente</TableHead>
                  <SortableTableHead field="inizioGaranzia" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} title="Periodo di garanzia della quietanza">Inizio Garanzia</SortableTableHead>
                  <SortableTableHead field="fineGaranzia" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} title="Periodo di garanzia della quietanza">Fine Garanzia</SortableTableHead>
                  <TableHead>Agenzia</TableHead>
                  <SortableTableHead field="ramo_nome" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} title="Ordina per garanzia">Garanzia</SortableTableHead>
                  <SortableTableHead field="inizioPolizza" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} title="Inizio durata complessiva del contratto">Inizio Polizza</SortableTableHead>
                  <SortableTableHead field="finePolizza" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} title="Fine durata complessiva del contratto">Fine Polizza</SortableTableHead>
                  <TableHead>Targa</TableHead>
                  <TableHead>Fraz</TableHead>
                  <TableHead className="text-right">Lordo</TableHead>
                  <TableHead className="text-right">Attive</TableHead>
                  <TableHead className="text-right">Passive</TableHead>
                  <TableHead>AE</TableHead>
                  <TableHead>Specialist</TableHead>
                  <TableHead>Produttore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {polizze.map((p: PortafoglioRow) => renderRow(p))}
              </TableBody>
            </Table>
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default PortafoglioAttivePage;
