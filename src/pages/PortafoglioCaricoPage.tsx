// Carico – v3: toggle Mese Corrente / Messe a Cassa / Tutte, default = mese corrente + arretrati non a cassa
import { useServerPagination } from "@/hooks/useServerPagination";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Clock, Search, Euro, Banknote, Undo2, ArrowUpDown, ArrowUp, ArrowDown, Hourglass, RotateCcw } from "lucide-react";

import { format } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { annullaMessaACassa } from "@/lib/annullaMessaACassa";
import { MessaCassaDialog } from "@/components/portafoglio/MessaCassaDialog";
import { GarantitoDialog } from "@/components/portafoglio/GarantitoDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Shield } from "lucide-react";
import { useCompensazioniByTitoli } from "@/hooks/useCompensazioniByTitoli";
import { CompensazioneBadge } from "@/components/portafoglio/CompensazioneBadge";
import { TipoFilterSegmented } from "@/components/polizze/TipoFilterSegmented";
import { TipoPolizzaBadge } from "@/components/polizze/TipoPolizzaBadge";
import { rowBorderClass, isQuietanzaRow, displayStatoPolizza } from "@/lib/polizzeDisplay";
import { isInCoperturaGarantita } from "@/lib/garantitoTitolo";
const todayStr = () => format(new Date(), "yyyy-MM-dd");
const rowHref = (p: any): string | null => {
  if (p?.polizza_id) return `/polizze/${p.polizza_id}`;
  if (p?.quietanza_id) return `/quietanze/${p.quietanza_id}`;
  if (p?.id) return `/polizze/${p.id}`;
  return null;
};


const PortafoglioCaricoPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("garanzia_a");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  const [searchParams, setSearchParams] = useSearchParams();
  type Periodo = "mese_corrente" | "messe_cassa" | "tutte";
  const initialPeriodo: Periodo = (() => {
    const p = searchParams.get("periodo");
    return p === "mese_corrente" || p === "messe_cassa" || p === "tutte" ? p : "mese_corrente";
  })();
  const [filtroPeriodo, setFiltroPeriodo] = useState<Periodo>(initialPeriodo);
  const [userTouched, setUserTouched] = useState<boolean>(!!searchParams.get("periodo"));
  const [dateDa, setDateDa] = useState<string>(searchParams.get("dal") || "");
  const [dateA, setDateA] = useState<string>(searchParams.get("al") || "");
  const isDefaultExtended = !userTouched && filtroPeriodo === "mese_corrente" && !dateDa && !dateA;
  const [filtroTipo, setFiltroTipo] = useState<"polizze" | "quietanze" | "regolazioni">("quietanze");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [cassaDialogTitoli, setCassaDialogTitoli] = useState<Array<{ id: string; numero_titolo?: string | null; premio_lordo?: number | null; cliente_anagrafica_id?: string | null }>>([]);
  const [cassaDialogOpen, setCassaDialogOpen] = useState(false);
  const [garantitoDialogTitoli, setGarantitoDialogTitoli] = useState<Array<{ id: string; numero_titolo?: string | null; premio_lordo?: number | null; cliente_anagrafica_id?: string | null }>>([]);
  const [garantitoDialogOpen, setGarantitoDialogOpen] = useState(false);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);

  const hasActiveFilters = !!dateDa || !!dateA || !!search || filtroPeriodo !== "mese_corrente" || userTouched || filtroTipo !== "quietanze";

  const updateUrl = (next: { periodo?: Periodo | null; dal?: string | null; al?: string | null }) => {
    const sp = new URLSearchParams(searchParams);
    if (next.periodo !== undefined) {
      if (next.periodo) sp.set("periodo", next.periodo); else sp.delete("periodo");
    }
    if (next.dal !== undefined) {
      if (next.dal) sp.set("dal", next.dal); else sp.delete("dal");
    }
    if (next.al !== undefined) {
      if (next.al) sp.set("al", next.al); else sp.delete("al");
    }
    setSearchParams(sp, { replace: true });
  };

  const resetFilters = () => {
    setDateDa("");
    setDateA("");
    setSearch("");
    setFiltroPeriodo("mese_corrente");
    setUserTouched(false);
    setFiltroTipo("quietanze");
    setPage(0);
    const sp = new URLSearchParams(searchParams);
    sp.delete("periodo"); sp.delete("dal"); sp.delete("al");
    setSearchParams(sp, { replace: true });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(0);
  };

  const SortableHeader = ({ field, children, className }: { field: string; children: React.ReactNode; className?: string }) => {
    const Icon = sortField === field ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead className={`cursor-pointer select-none ${className || ""}`} onClick={() => handleSort(field)}>
        <div className="flex items-center gap-1">
          {children}
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </TableHead>
    );
  };

  const { page, setPage, pageSize, range } = useServerPagination(25, [search, filtroPeriodo, isDefaultExtended, filtroTipo, dateDa, dateA, sortField, sortDirection]);

  const applyTipoFilter = (q: any) => {
    if (filtroTipo === "polizze") return q.is("sostituisce_polizza", null).or("is_regolazione.is.null,is_regolazione.eq.false");
    if (filtroTipo === "quietanze") return q.not("sostituisce_polizza", "is", null).or("is_regolazione.is.null,is_regolazione.eq.false");
    if (filtroTipo === "regolazioni") return q.eq("is_regolazione", true);
    return q;
  };

  // Esclude le polizze madre che hanno rate successive: non sono incassabili,
  // l'incasso avviene sulla singola quietanza. Le regolazioni e le monorata restano.
  const applyExcludeMadreConRate = (q: any) =>
    q.or("is_regolazione.eq.true,numero_rata.gt.1,numero_rate_totali.lte.1,numero_rate_totali.is.null");

  const applyDateRange = (q: any, col: string) => {
    if (dateDa) q = q.gte(col, dateDa);
    if (dateA) q = q.lte(col, dateA);
    return q;
  };

  const applyPeriodoFilter = (q: any) => {
    if (filtroPeriodo === "messe_cassa") {
      return applyDateRange(q.eq("stato", "incassato"), "data_messa_cassa");
    }
    if (filtroPeriodo === "tutte") {
      const attiveCond = ["stato.eq.attivo"];
      if (dateDa) attiveCond.push(`data_scadenza.gte.${dateDa}`);
      if (dateA) attiveCond.push(`data_scadenza.lte.${dateA}`);
      const incassateCond = ["stato.eq.incassato"];
      if (dateDa) incassateCond.push(`data_messa_cassa.gte.${dateDa}`);
      if (dateA) incassateCond.push(`data_messa_cassa.lte.${dateA}`);
      return q.in("stato", ["attivo", "incassato"]).or(
        `and(${attiveCond.join(",")}),and(${incassateCond.join(",")})`
      );
    }
    // mese_corrente
    if (isDefaultExtended) {
      // default esteso: tutte le attive (incluse arretrati), nessun bordo
      return q.eq("stato", "attivo");
    }
    return applyDateRange(q.eq("stato", "attivo"), "data_scadenza");
  };

  const applySearch = (q: any) =>
    search ? q.or(`numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%,targa_telaio.ilike.%${search}%`) : q;

  const orderField = filtroPeriodo === "messe_cassa"
    ? (sortField === "data_scadenza" || sortField === "garanzia_a" || sortField === "garanzia_da" ? "data_messa_cassa" : sortField)
    : sortField;

  const { data: result, isLoading } = useQuery({
    queryKey: ["portafoglio-carico", search, filtroPeriodo, isDefaultExtended, filtroTipo, page, dateDa, dateA, sortField, sortDirection],
    queryFn: async () => {
      let q = supabase.from("v_portafoglio_quietanze").select(
        "id, quietanza_id, polizza_id, numero_titolo, compagnia_nome, ramo_nome, cliente_nome_display, cliente_codice, cliente_anagrafica_id, stato, garanzia_da, garanzia_a, data_scadenza, premio_lordo, rate, ae_nome, specialist, produttore_nome, provvigioni_firma, provvigioni_quietanza, targa_telaio, compagnia_id, ramo_id, data_messa_cassa, data_copertura, data_pagamento, data_decorrenza_rinnovo, conferimento_gestito, fondi_ricevuti, sostituisce_polizza, is_regolazione, regolazione_quietanza_id, numero_rata, numero_rate_totali",
        { count: "exact" }
      );
      q = applyPeriodoFilter(q);
      q = applySearch(q);
      q = applyTipoFilter(q);
      q = applyExcludeMadreConRate(q);

      const { data, count } = await q
        .order(orderField, { ascending: sortDirection === "asc" })
        .range(range.from, range.to);
      return { data: data || [], count: count || 0 };
    },
  });

  const polizze = (result?.data || []);
  const totalCount = result?.count || 0;

  const titoloIdsRiga = useMemo(() => polizze.map((p: any) => p.id), [polizze]);
  const { data: compensazioniMap } = useCompensazioniByTitoli(titoloIdsRiga);

  const { data: totaleData } = useQuery({
    queryKey: ["portafoglio-carico-totale", search, filtroPeriodo, isDefaultExtended, dateDa, dateA],
    queryFn: async () => {
      let q = supabase.from("v_portafoglio_quietanze").select("premio_lordo, sostituisce_polizza, is_regolazione, numero_rata, numero_rate_totali");
      q = applyPeriodoFilter(q);
      q = applySearch(q);
      q = applyExcludeMadreConRate(q);
      const { data } = await q;
      const rows = (data || []);
      const sumAll = rows.reduce((s, r) => s + (Number(r.premio_lordo) || 0), 0);
      const polizzeRows = rows.filter((r) => !r.sostituisce_polizza);
      const quietanzeRows = rows.filter((r) => !!r.sostituisce_polizza);
      return {
        totale: sumAll,
        polizzeCount: polizzeRows.length,
        polizzeTotale: polizzeRows.reduce((s, r) => s + (Number(r.premio_lordo) || 0), 0),
        quietanzeCount: quietanzeRows.length,
        quietanzeTotale: quietanzeRows.reduce((s, r) => s + (Number(r.premio_lordo) || 0), 0),
      };
    },
  });
  const totalePremio = totaleData?.totale ?? 0;

  // Rinnovi in attesa di messa a cassa della polizza precedente
  const { data: pendingRinnovi } = useQuery({
    queryKey: ["portafoglio-carico-pending", dateDa, dateA],
    queryFn: async () => {
      let q = supabase
        .from("v_portafoglio_quietanze")
        .select("id, quietanza_id, polizza_id, numero_titolo, cliente_nome_display, compagnia_nome, data_scadenza, premio_lordo, sostituisce_polizza")
        .eq("stato", "in_attesa_rinnovo");
      q = applyDateRange(q, "data_scadenza");
      const { data } = await q.order("data_scadenza", { ascending: true });
      return (data || []);
    },
  });
  const pendingCount = pendingRinnovi?.length || 0;

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-pending"] });
    queryClient.invalidateQueries({ queryKey: ["anticipi-residuo-by-clienti"] });
    queryClient.invalidateQueries({ queryKey: ["anticipi-globale"] });
    queryClient.invalidateQueries({ queryKey: ["polizze_cliente"] });
  };

  const mettiACassa = useCallback(async (titoloId: string, premioLordo?: number | null) => {
    const today = todayStr();
    setLoadingIds(prev => new Set(prev).add(titoloId));
    try {
      // Native: scriviamo sulla quietanza (entità nativa). Il trigger DB cura il riallineamento del titolo legacy.
      const { error } = await (supabase.from("quietanze") as any).update({
        stato: "incassato",
        data_incasso: today,
        data_messa_cassa: today,
        data_pagamento: today,
        importo_incassato: premioLordo ?? null,
      }).eq("titolo_id", titoloId);

      if (error) throw error;

      await logAttivita({
        azione: "messa_a_cassa",
        entita_tipo: "quietanza",
        entita_id: titoloId,
        dettagli_json: { data_messa_cassa: today, data_pagamento: today },
      });

      // Genera provvigioni automaticamente (edge function lavora su titolo_id legacy)
      supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: titoloId } }).catch(() => {});
      // Notifica formale all'agenzia/rapporto
      supabase.functions.invoke("notifica-messa-cassa-agenzia", { body: { titolo_id: titoloId } }).catch(() => {});



      toast.success("Polizza messa a cassa");
      invalidateQueries();
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "operazione fallita"));
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(titoloId);
        return next;
      });
    }
  }, []);

  const annullaIncasso = useCallback(async (titoloId: string) => {
    setLoadingIds(prev => new Set(prev).add(titoloId));
    try {
      const res = await annullaMessaACassa(titoloId);
      if (!res.ok) {
        toast.error(res.error || "Operazione fallita");
        return;
      }
      toast.success(
        `Incasso annullato (${res.provvigioniEliminate ?? 0} provv., ${res.movimentiEliminati ?? 0} mov.${res.rataSuccessivaEliminata ? ", rata successiva rimossa" : ""})`
      );
      invalidateQueries();
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "operazione fallita"));
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(titoloId);
        return next;
      });
    }
  }, []);

  // Solo polizze attive E mai messe a cassa sono incassabili (evita doppio incasso)
  const selectedAttive = useMemo(
    () => polizze.filter(p => selectedIds.has(p.id) && p.stato === "attivo" && !p.data_messa_cassa),
    [polizze, selectedIds]
  );
  const selectedGarantibile = useMemo(
    () => selectedAttive.filter(p => !isInCoperturaGarantita(p)),
    [selectedAttive]
  );
  const selectedIncassate = useMemo(() => polizze.filter(p => selectedIds.has(p.id) && p.stato === "incassato"), [polizze, selectedIds]);

  const bulkMettiACassa = useCallback(async () => {
    if (selectedAttive.length === 0) return;
    setBulkLoading(true);
    const today = todayStr();
    let ok = 0, ko = 0;
    for (const p of selectedAttive) {
      // Native write: aggiorniamo la quietanza per titolo_id legacy
      const { error } = await (supabase.from("quietanze") as any).update({
        stato: "incassato",
        data_incasso: today,
        data_messa_cassa: today,
        data_pagamento: today,
        importo_incassato: p.premio_lordo ?? null,
      }).eq("titolo_id", p.id);
      if (error) ko++; else {
        ok++;
        // Genera provvigioni per ogni polizza messa a cassa
        supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: p.id } }).catch(() => {});
        // Notifica formale all'agenzia/rapporto
        supabase.functions.invoke("notifica-messa-cassa-agenzia", { body: { titolo_id: p.id } }).catch(() => {});
      }

    }
    if (ok > 0) {
      await logAttivita({
        azione: "messa_a_cassa_massiva",
        entita_tipo: "quietanza",
        entita_id: "batch",
        dettagli_json: { messe_a_cassa: ok, errori: ko },
      });
    }
    toast.success(`${ok} polizze messe a cassa${ko > 0 ? `, ${ko} errori` : ""}`);
    setSelectedIds(new Set());
    invalidateQueries();
    setBulkLoading(false);
  }, [selectedAttive]);

  const bulkAnnullaIncasso = useCallback(async () => {
    if (selectedIncassate.length === 0) return;
    setBulkLoading(true);
    let ok = 0, ko = 0;
    for (const p of selectedIncassate) {
      const res = await annullaMessaACassa(p.id);
      if (res.ok) ok++; else ko++;
    }
    if (ok > 0) {
      await logAttivita({
        azione: "annulla_incasso_massiva",
        entita_tipo: "titolo",
        entita_id: "batch",
        dettagli_json: { annullate: ok, errori: ko },
      });
    }
    toast.success(`${ok} incassi annullati${ko > 0 ? `, ${ko} errori` : ""}`);
    setSelectedIds(new Set());
    invalidateQueries();
    setBulkLoading(false);
  }, [selectedIncassate]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === polizze.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(polizze.map(p => p.id)));
    }
  };

  const fmtCurrency = (v: number | null) =>
    v != null ? `€ ${Number(v).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—";

  const fmtDate = (d: string | null) =>
    d ? format(new Date(d), "dd/MM/yyyy") : "—";

  const frazLabel = (r: number | null) => {
    if (!r) return "—";
    const map: Record<number, string> = { 1: "Ann.", 2: "Sem.", 3: "Trim.", 4: "Quad.", 12: "Mens." };
    return map[r] || String(r);
  };

  const statoBadgeVariant = (stato: string) => {
    switch (stato) {
      case "attivo": return "default" as const;
      case "incassato": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Carico</h1>
        <p className="text-sm text-muted-foreground">
          {(() => {
            const labelBase = filtroPeriodo === "messe_cassa" ? "Polizze messe a cassa" : "Polizze in scadenza";
            if (!dateDa && !dateA) {
              return (
                <>
                  {filtroPeriodo === "messe_cassa" ? "Tutte le polizze messe a cassa" : "Tutte le polizze"}
                  {isDefaultExtended && <span className="ml-2 text-xs text-primary">· inclusi arretrati non a cassa</span>}
                </>
              );
            }
            const da = dateDa ? format(new Date(dateDa), "dd/MM/yyyy") : null;
            const a = dateA ? format(new Date(dateA), "dd/MM/yyyy") : null;
            if (da && a) return `${labelBase} dal ${da} al ${a}`;
            if (da) return `${labelBase} dal ${da}`;
            return `${labelBase} fino al ${a}`;
          })()}
        </p>
      </div>

      {/* Bulk action buttons */}
      {(selectedAttive.length > 0 || selectedGarantibile.length > 0 || selectedIncassate.length > 0) && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm text-muted-foreground">{selectedIds.size} selezionat{selectedIds.size === 1 ? "a" : "e"}</span>
          {selectedAttive.length > 0 && (
            <Button size="sm" onClick={() => { setCassaDialogTitoli(selectedAttive.map(p => ({ id: p.id, numero_titolo: p.numero_titolo, premio_lordo: p.premio_lordo, cliente_anagrafica_id: (p as any).cliente_anagrafica_id }))); setCassaDialogOpen(true); }} disabled={bulkLoading} className="gap-1">
              <Banknote className="h-3.5 w-3.5" />
              Incassa ({selectedAttive.length})
            </Button>
          )}
          {selectedGarantibile.length > 0 && (
            <Button size="sm" onClick={() => { setGarantitoDialogTitoli(selectedGarantibile.map(p => ({ id: p.id, numero_titolo: p.numero_titolo, premio_lordo: p.premio_lordo, cliente_anagrafica_id: (p as any).cliente_anagrafica_id }))); setGarantitoDialogOpen(true); }} disabled={bulkLoading} className="gap-1 bg-orange-500 hover:bg-orange-600 text-white">
              <Shield className="h-3.5 w-3.5" />
              Garantito ({selectedGarantibile.length})
            </Button>
          )}
          {selectedIncassate.length > 0 && isAdmin && (
            <Button size="sm" variant="outline" onClick={bulkAnnullaIncasso} disabled={bulkLoading} className="gap-1">
              <Undo2 className="h-3.5 w-3.5" />
              {bulkLoading ? "In corso..." : `Annulla Incasso (${selectedIncassate.length})`}
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-accent/50 p-3">
              <Clock className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Totale titoli</p>
              <p className="text-2xl font-bold text-foreground">{totalCount}</p>
              <p className="text-xs text-muted-foreground">{fmtCurrency(totalePremio)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-secondary p-3">
              <Banknote className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quietanze</p>
              <p className="text-2xl font-bold text-foreground">{totaleData?.quietanzeCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">{fmtCurrency(totaleData?.quietanzeTotale ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-orange-100 p-3">
              <Hourglass className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In attesa rinnovo</p>
              <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">polizza precedente non a cassa</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Banner: rinnovi in attesa di messa a cassa della polizza precedente */}
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={() => setPendingDialogOpen(true)}
          className="w-full text-left rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 transition-colors p-3 flex items-center gap-3"
        >
          <Hourglass className="h-5 w-5 text-orange-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-900">
              {pendingCount} {pendingCount === 1 ? "rinnovo in attesa" : "rinnovi in attesa"} di messa a cassa della polizza precedente
            </p>
            <p className="text-xs text-orange-700">
              Compariranno nel carico solo dopo che la polizza precedente sarà messa a cassa. Click per dettagli.
            </p>
          </div>
        </button>
      )}

      <Dialog open={pendingDialogOpen} onOpenChange={setPendingDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hourglass className="w-5 h-5 text-orange-600" /> Rinnovi in attesa di messa a cassa
            </DialogTitle>
            <DialogDescription>
              Questi rinnovi diventeranno attivi automaticamente quando la polizza precedente verrà messa a cassa.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Polizza nuova</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Agenzia</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead className="text-right">Premio</TableHead>
                  <TableHead>Origina da</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pendingRinnovi || []).map((p: any) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { const h = rowHref(p); if (h) { setPendingDialogOpen(false); navigate(h); } }}
                  >
                    <TableCell className="font-mono text-sm">{p.numero_titolo}</TableCell>
                    <TableCell>{p.cliente_nome_display || "—"}</TableCell>
                    <TableCell>{p.compagnia_nome || "—"}</TableCell>
                    <TableCell>{fmtDate(p.data_scadenza)}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(p.premio_lordo)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.sostituisce_polizza}
                    </TableCell>
                  </TableRow>
                ))}
                {pendingCount === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nessun rinnovo in attesa</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per n° polizza, cliente, codice, targa..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Dal</span>
          <Input
            type="date"
            value={dateDa}
            onChange={(e) => { setDateDa(e.target.value); setPage(0); updateUrl({ dal: e.target.value || null }); }}
            className="w-[150px]"
          />
          <span className="text-xs text-muted-foreground ml-1">Al</span>
          <Input
            type="date"
            value={dateA}
            onChange={(e) => { setDateA(e.target.value); setPage(0); updateUrl({ al: e.target.value || null }); }}
            className="w-[150px]"
          />
        </div>
        <ToggleGroup
          type="single"
          value={filtroPeriodo}
          onValueChange={(v) => {
            if (!v) return;
            setFiltroPeriodo(v as Periodo);
            setUserTouched(true);
            setPage(0);
            updateUrl({ periodo: v as Periodo });
          }}
          className="border rounded-md"
        >
          <ToggleGroupItem value="mese_corrente" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Mese Corrente</ToggleGroupItem>
          <ToggleGroupItem value="messe_cassa" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Messe a Cassa</ToggleGroupItem>
          <ToggleGroupItem value="tutte" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Tutte</ToggleGroupItem>
        </ToggleGroup>
        <TipoFilterSegmented
          value={filtroTipo}
          onChange={(v) => { setFiltroTipo(v); setPage(0); }}
          withRegolazioni
          hidePolizze
        />
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Filtri
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento...</div>
      ) : polizze.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Nessuna polizza trovata per questo mese</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={polizze.length > 0 && selectedIds.size === polizze.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <SortableHeader field="numero_titolo">N° Polizza</SortableHeader>
                  <TableHead>Tipo</TableHead>
                  <SortableHeader field="cliente_nome_display">Cliente</SortableHeader>
                  
                  <SortableHeader field="compagnia_nome">Agenzia</SortableHeader>
                  <SortableHeader field="ramo_nome">Garanzia</SortableHeader>
                  <SortableHeader field="garanzia_da">Inizio Garanzia</SortableHeader>
                  <SortableHeader field="garanzia_a">Fine Garanzia</SortableHeader>
                  <SortableHeader field="targa_telaio">Targa</SortableHeader>
                  <SortableHeader field="rate">Fraz</SortableHeader>
                  <SortableHeader field="premio_lordo" className="text-right">Lordo</SortableHeader>
                  <SortableHeader field="ae_nome">AE</SortableHeader>
                  <SortableHeader field="produttore_nome">Produttore</SortableHeader>
                  <SortableHeader field="stato">Stato</SortableHeader>
                  <SortableHeader field="data_copertura" className="text-center">Copertura</SortableHeader>
                  <SortableHeader field="data_messa_cassa" className="text-center">Messa a Cassa</SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {polizze.map((p: any) => {
                  const isIncassato = p.stato === "incassato";
                  const inCopertura = isInCoperturaGarantita(p);
                  const isProcessing = loadingIds.has(p.id);
                  const isQ = isQuietanzaRow(p) || (Number(p.numero_rata) || 0) > 1;
                  const statoShown = displayStatoPolizza(p);
                  const polizzaMadreNumero = p.numero_polizza_snapshot || p.numero_titolo;
                  return (
                    <TableRow
                      key={p.id}
                      className={`cursor-pointer ${rowBorderClass(p)} ${inCopertura ? "bg-orange-50 hover:bg-orange-100/70" : p.is_regolazione ? "bg-orange-50/40" : isIncassato ? "bg-yellow-50 hover:bg-yellow-100/70" : isQ ? "bg-quietanza-soft/40" : ""}`}
                      onClick={() => { const h = rowHref(p); if (h) navigate(h); }}

                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                        />
                      </TableCell>
                      <TableCell className={`font-medium ${isQ ? "pl-8 font-normal text-muted-foreground" : ""}`}>
                        {isQ && <span className="mr-1 text-muted-foreground">└</span>}
                        {p.is_regolazione && <span className="text-orange-600 mr-1" title="Regolazione collegata">↳</span>}
                        {p.numero_titolo || "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {p.is_regolazione ? (
                          <Badge className="bg-orange-500 hover:bg-orange-600 text-white" title="Titolo di Regolazione Premio">Regolazione</Badge>
                        ) : (
                          <TipoPolizzaBadge
                            tipo="quietanza"
                            numero={p.numero_rata || (isQ ? undefined : 1)}
                            totale={p.numero_rate_totali || (isQ ? undefined : 1)}
                          />
                        )}
                      </TableCell>
                      <TableCell>{p.cliente_nome_display || "—"}</TableCell>
                      <TableCell>{p.compagnia_nome || "—"}</TableCell>
                      <TableCell>{p.ramo_nome || "—"}</TableCell>
                      <TableCell>{fmtDate(p.garanzia_da)}</TableCell>
                      <TableCell>{fmtDate(p.garanzia_a)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.targa_telaio || "—"}</TableCell>
                      <TableCell>{frazLabel(p.rate)}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(p.premio_lordo)}</TableCell>
                      <TableCell className="text-sm">{p.ae_nome || "—"}</TableCell>
                      <TableCell className="text-sm">{p.produttore_nome || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant={statoBadgeVariant(statoShown)}>{statoShown}</Badge>
                          {p.conferimento_gestito && !p.fondi_ricevuti && (
                            <Badge variant="destructive" className="text-[10px] h-5">Att. Fondi</Badge>
                          )}
                          {p.conferimento_gestito && p.fondi_ricevuti && (
                            <Badge className="bg-orange-500 text-white text-[10px] h-5 hover:bg-orange-600">Conf.</Badge>
                          )}
                          <CompensazioneBadge summary={compensazioniMap?.get(p.id)} titoloId={p.id} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {inCopertura ? fmtDate(p.data_copertura) : "—"}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {isIncassato ? fmtDate(p.data_messa_cassa) : "—"}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {isIncassato && isAdmin ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isProcessing}
                            onClick={() => annullaIncasso(p.id)}
                            className="gap-1 h-8 text-xs"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            {isProcessing ? "..." : "Annulla"}
                          </Button>
                        ) : isIncassato ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : inCopertura ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isProcessing}
                            onClick={() => { setCassaDialogTitoli([{ id: p.id, numero_titolo: p.numero_titolo, premio_lordo: p.premio_lordo, cliente_anagrafica_id: (p as any).cliente_anagrafica_id }]); setCassaDialogOpen(true); }}
                            className="gap-1 h-8 text-xs"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            Incassa
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1 justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isProcessing}
                              onClick={() => { setCassaDialogTitoli([{ id: p.id, numero_titolo: p.numero_titolo, premio_lordo: p.premio_lordo, cliente_anagrafica_id: (p as any).cliente_anagrafica_id }]); setCassaDialogOpen(true); }}
                              className="gap-1 h-8 text-xs"
                            >
                              <Banknote className="h-3.5 w-3.5" />
                              Cassa
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isProcessing}
                              onClick={() => { setGarantitoDialogTitoli([{ id: p.id, numero_titolo: p.numero_titolo, premio_lordo: p.premio_lordo, cliente_anagrafica_id: (p as any).cliente_anagrafica_id }]); setGarantitoDialogOpen(true); }}
                              className="gap-1 h-8 text-xs border-orange-400 text-orange-700 hover:bg-orange-50"
                              title="Garantito (incasso senza fondi)"
                            >
                              <Shield className="h-3.5 w-3.5" />
                              Gar.
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}

      <MessaCassaDialog
        open={cassaDialogOpen}
        onOpenChange={setCassaDialogOpen}
        titoli={cassaDialogTitoli}
        onSuccess={() => { setSelectedIds(new Set()); invalidateQueries(); }}
      />

      <GarantitoDialog
        open={garantitoDialogOpen}
        onOpenChange={setGarantitoDialogOpen}
        titoli={garantitoDialogTitoli}
        onSuccess={() => { setSelectedIds(new Set()); invalidateQueries(); }}
      />

    </div>
  );
};

export default PortafoglioCaricoPage;
