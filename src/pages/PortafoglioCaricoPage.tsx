// Carico – toggle Mese Corrente / Tutte, default = mese corrente + arretrati non a cassa
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
import { Clock, Search, Euro, Banknote, Undo2, ArrowUpDown, ArrowUp, ArrowDown, Hourglass, RotateCcw, ArrowRightLeft } from "lucide-react";

import { format } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { invokeNotificaMessaCassa } from "@/lib/notificaMessaCassa";
import { annullaMessaACassa } from "@/lib/annullaMessaACassa";
import { MessaCassaDialog, type PreferredBonificoContext } from "@/components/portafoglio/MessaCassaDialog";
import { GarantitoDialog } from "@/components/portafoglio/GarantitoDialog";
import { IncassiBonificiPanel } from "@/components/portafoglio/IncassiBonificiPanel";
import { BonificoMatchBadge } from "@/components/portafoglio/BonificoMatchBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Shield } from "lucide-react";
import { useCompensazioniByTitoli } from "@/hooks/useCompensazioniByTitoli";
import { CompensazioneBadge } from "@/components/portafoglio/CompensazioneBadge";
import { TipoFilterSegmented } from "@/components/polizze/TipoFilterSegmented";
import { TipoPolizzaBadge } from "@/components/polizze/TipoPolizzaBadge";
import { rowBorderClass, isQuietanzaRow, displayStatoPolizza, messaCassaRowBgClass, isMessaACassa } from "@/lib/polizzeDisplay";
import { isInCoperturaGarantita } from "@/lib/garantitoTitolo";
import { quietanzaSogliaGaranziaDa } from "@/lib/quietanzeClienteView";
import { UfficiFilterMultiSelect } from "@/components/portafoglio/UfficiFilterMultiSelect";
import { fetchBonificiApertiPerIncassi } from "@/lib/bonificoDaIncasso";
import { suggestBonificiPerCliente, type BonificoAperto, type BonificoSuggerito } from "@/lib/bonificoMatch";
const todayStr = () => format(new Date(), "yyyy-MM-dd");
const startOfMonthStr = () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
const endOfMonthStr = () => format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");
/** Da Incassi: priorità alla quietanza (non alla madre), come Portafoglio Attive. */
const rowHref = (p: any): string | null => {
  if (p?.quietanza_id) return `/quietanze/${p.quietanza_id}`;
  if (p?.is_appendice_modifica || p?.is_proroga || p?.is_regolazione) {
    if (p?.id) return `/titoli/${p.id}`;
  }
  if (p?.polizza_id) return `/polizze/${p.polizza_id}`;
  if (p?.id) return `/titoli/${p.id}`;
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
  type Periodo = "mese_corrente" | "tutte";
  const initialPeriodo: Periodo = (() => {
    const p = searchParams.get("periodo");
    if (p === "messe_cassa") return "tutte";
    return p === "mese_corrente" || p === "tutte" ? p : "tutte";
  })();
  const [filtroPeriodo, setFiltroPeriodo] = useState<Periodo>(initialPeriodo);
  const [userTouched, setUserTouched] = useState<boolean>(() => {
    const p = searchParams.get("periodo");
    return !!p && p !== "messe_cassa";
  });
  const [dateDa, setDateDa] = useState<string>(searchParams.get("dal") || "");
  const [dateA, setDateA] = useState<string>(searchParams.get("al") || "");
  const isDefaultExtended = !userTouched && filtroPeriodo === "mese_corrente" && !dateDa && !dateA;
  const [filtroTipo, setFiltroTipo] = useState<"polizze" | "quietanze" | "regolazioni" | "garantiti">("quietanze");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [cassaDialogTitoli, setCassaDialogTitoli] = useState<Array<{ id: string; numero_titolo?: string | null; premio_lordo?: number | null; cliente_anagrafica_id?: string | null }>>([]);
  const [cassaDialogOpen, setCassaDialogOpen] = useState(false);
  const [garantitoDialogTitoli, setGarantitoDialogTitoli] = useState<Array<{ id: string; numero_titolo?: string | null; premio_lordo?: number | null; cliente_anagrafica_id?: string | null }>>([]);
  const [garantitoDialogOpen, setGarantitoDialogOpen] = useState(false);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [filtroUffici, setFiltroUffici] = useState<string[]>(() => {
    const raw = searchParams.get("sedi");
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  });
  const [bonificiPanelOpen, setBonificiPanelOpen] = useState(() => searchParams.get("tab") === "bonifici");
  const [preferredBonifico, setPreferredBonifico] = useState<PreferredBonificoContext | null>(null);
  type VistaIncasso = "pendenti" | "incassati";
  const [vistaIncasso, setVistaIncasso] = useState<VistaIncasso>(() =>
    searchParams.get("vista") === "incassati" ? "incassati" : "pendenti",
  );
  const isVistaIncassati = vistaIncasso === "incassati";

  const hasActiveFilters =
    !!dateDa ||
    !!dateA ||
    !!search ||
    filtroPeriodo !== "tutte" ||
    userTouched ||
    filtroTipo !== "quietanze" ||
    filtroUffici.length > 0 ||
    vistaIncasso !== "pendenti";

  const updateUrl = (next: {
    periodo?: Periodo | null;
    dal?: string | null;
    al?: string | null;
    sedi?: string[] | null;
    vista?: VistaIncasso | null;
  }) => {
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
    if (next.sedi !== undefined) {
      if (next.sedi && next.sedi.length > 0) sp.set("sedi", next.sedi.join(","));
      else sp.delete("sedi");
    }
    if (next.vista !== undefined) {
      if (next.vista && next.vista !== "pendenti") sp.set("vista", next.vista);
      else sp.delete("vista");
    }
    setSearchParams(sp, { replace: true });
  };

  useEffect(() => {
    if (searchParams.get("periodo") !== "messe_cassa") return;
    const sp = new URLSearchParams(searchParams);
    sp.delete("periodo");
    setSearchParams(sp, { replace: true });
  }, []); // migrazione URL legacy messe_cassa → tutte (default)

  useEffect(() => {
    if (searchParams.get("tab") === "bonifici") setBonificiPanelOpen(true);
    const v = searchParams.get("vista");
    setVistaIncasso(v === "incassati" ? "incassati" : "pendenti");
  }, [searchParams]);

  const setBonificiPanelOpenSync = useCallback(
    (open: boolean) => {
      setBonificiPanelOpen(open);
      const sp = new URLSearchParams(searchParams);
      if (open) sp.set("tab", "bonifici");
      else sp.delete("tab");
      setSearchParams(sp, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const resetFilters = () => {
    setDateDa("");
    setDateA("");
    setSearch("");
    setFiltroPeriodo("tutte");
    setUserTouched(false);
    setFiltroTipo("quietanze");
    setFiltroUffici([]);
    setVistaIncasso("pendenti");
    setSelectedIds(new Set());
    setPage(0);
    const sp = new URLSearchParams(searchParams);
    sp.delete("periodo"); sp.delete("dal"); sp.delete("al"); sp.delete("sedi"); sp.delete("vista");
    setSearchParams(sp, { replace: true });
  };

  const switchVista = (v: VistaIncasso) => {
    setVistaIncasso(v);
    setSelectedIds(new Set());
    setPage(0);
    if (v === "incassati") {
      setSortField("data_messa_cassa");
      setSortDirection("desc");
    } else {
      setSortField("garanzia_a");
      setSortDirection("asc");
    }
    updateUrl({ vista: v });
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

  const { page, setPage, pageSize, range } = useServerPagination(25, [
    search,
    filtroPeriodo,
    isDefaultExtended,
    filtroTipo,
    dateDa,
    dateA,
    sortField,
    sortDirection,
    filtroUffici.join(","),
    vistaIncasso,
  ]);

  const isDaIncassareTipo = !isVistaIncassati && (filtroTipo === "quietanze" || filtroTipo === "regolazioni");

  const applyTipoFilter = (q: any) => {
    // La view v_portafoglio_quietanze è già a livello quietanza (JOIN quietanze).
    // Non usare sostituisce_polizza: sui titoli collegati alla quietanza è spesso NULL
    // (la rata "cliente" con sostituisce_polizza valorizzato può non avere riga in quietanze).
    if (filtroTipo === "polizze") {
      return q
        .not("is_appendice_modifica", "is", true)
        .not("is_proroga", "is", true)
        .not("is_regolazione", "is", true);
    }
    if (filtroTipo === "quietanze") {
      return q
        .not("is_appendice_modifica", "is", true)
        .not("is_proroga", "is", true)
        .not("is_regolazione", "is", true);
    }
    if (filtroTipo === "regolazioni") {
      return q.or("is_regolazione.eq.true,is_proroga.eq.true,is_appendice_modifica.eq.true");
    }
    return q;
  };

  const applyDateRange = (q: any, col: string) => {
    if (dateDa) q = q.gte(col, dateDa);
    if (dateA) q = q.lte(col, dateA);
    return q;
  };

  const applySedeFilter = (q: any) =>
    filtroUffici.length > 0 ? q.in("ufficio_id", filtroUffici) : q;

  /**
   * Pendenti: criteri vista cliente (attivo, senza messa a cassa, soglia 60gg).
   * Incassati: stato=incassato; Dal/Al e "mese corrente" su data_messa_cassa.
   */
  const applyPeriodoFilter = (q: any) => {
    if (isVistaIncassati) {
      q = q.eq("stato", "incassato");
      if (dateDa || dateA) return applyDateRange(q, "data_messa_cassa");
      if (filtroPeriodo === "mese_corrente") {
        return q
          .gte("data_messa_cassa", startOfMonthStr())
          .lte("data_messa_cassa", endOfMonthStr());
      }
      return q;
    }

    if (isDaIncassareTipo) {
      q = q.eq("stato", "attivo").is("data_messa_cassa", null);

      if (dateDa || dateA) {
        // Range esplicito: rispetta Dal/Al su garanzia_da, e per le rate anche la soglia 60gg
        if (filtroTipo === "quietanze") {
          const soglia = quietanzaSogliaGaranziaDa();
          const parts = [`garanzia_da.lte.${soglia}`];
          if (dateDa) parts.push(`garanzia_da.gte.${dateDa}`);
          if (dateA) parts.push(`garanzia_da.lte.${dateA}`);
          return q.or(`garanzia_da.is.null,and(${parts.join(",")})`);
        }
        return applyDateRange(q, "garanzia_da");
      }

      if (filtroPeriodo === "mese_corrente") {
        const today = todayStr();
        const start = startOfMonthStr();
        const end = endOfMonthStr();
        const meseOArretrato = `or(garanzia_da.lt.${today},and(garanzia_da.gte.${start},garanzia_da.lte.${end}))`;
        if (filtroTipo === "quietanze") {
          const soglia = quietanzaSogliaGaranziaDa();
          return q.or(
            `garanzia_da.is.null,and(garanzia_da.lte.${soglia},${meseOArretrato})`,
          );
        }
        // Appendici: arretrate o mese corrente (senza soglia 60gg)
        return q.or(`garanzia_da.is.null,${meseOArretrato}`);
      }

      // "tutte": solo criteri di visibilità
      if (filtroTipo === "quietanze") {
        const soglia = quietanzaSogliaGaranziaDa();
        return q.or(`garanzia_da.is.null,garanzia_da.lte.${soglia}`);
      }
      return q;
    }

    if (isDefaultExtended) {
      return q.eq("stato", "attivo");
    }
    return applyDateRange(q.eq("stato", "attivo"), "data_scadenza");
  };

  const applySearch = (q: any) =>
    search ? q.or(`numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%,targa_telaio.ilike.%${search}%`) : q;

  const { data: result, isLoading } = useQuery({
    queryKey: [
      "portafoglio-carico",
      search,
      filtroPeriodo,
      isDefaultExtended,
      filtroTipo,
      page,
      dateDa,
      dateA,
      sortField,
      sortDirection,
      filtroUffici.join(","),
      vistaIncasso,
    ],
    queryFn: async () => {
      let q = supabase.from("v_portafoglio_quietanze").select(
        "id, quietanza_id, polizza_id, numero_titolo, titolo_derivato_numero, compagnia_nome, ramo_nome, cliente_nome_display, cliente_codice, cliente_anagrafica_id, stato, garanzia_da, garanzia_a, data_scadenza, premio_lordo, rate, ae_nome, specialist, produttore_nome, produttori_display, provvigioni_firma, provvigioni_quietanza, targa_telaio, compagnia_id, ramo_id, ufficio_id, data_messa_cassa, data_copertura, data_pagamento, data_decorrenza_rinnovo, conferimento_gestito, fondi_ricevuti, sostituisce_polizza, is_regolazione, is_proroga, is_appendice_modifica, appendice_tipo, regolazione_quietanza_id, proroga_polizza_madre_id, numero_rata, numero_rate_totali",
        { count: "exact" }
      );
      q = applyPeriodoFilter(q);
      q = applySearch(q);
      q = applyTipoFilter(q);
      q = applySedeFilter(q);

      const { data, count } = await q
        .order(sortField, { ascending: sortDirection === "asc" })
        .range(range.from, range.to);
      return { data: data || [], count: count || 0 };
    },
  });

  const polizze = (result?.data || []);
  const totalCount = result?.count || 0;

  const titoloIdsRiga = useMemo(() => polizze.map((p: any) => p.id), [polizze]);
  const { data: compensazioniMap } = useCompensazioniByTitoli(titoloIdsRiga);

  const { data: totaleData } = useQuery({
    queryKey: [
      "portafoglio-carico-totale",
      search,
      filtroPeriodo,
      isDefaultExtended,
      filtroTipo,
      dateDa,
      dateA,
      filtroUffici.join(","),
      vistaIncasso,
    ],
    queryFn: async () => {
      let q = supabase
        .from("v_portafoglio_quietanze")
        .select(
          "premio_lordo, sostituisce_polizza, is_regolazione, is_proroga, is_appendice_modifica, numero_rata, numero_rate_totali",
        );
      q = applyPeriodoFilter(q);
      q = applySearch(q);
      q = applyTipoFilter(q);
      q = applySedeFilter(q);
      const { data } = await q;
      const rows = (data || []);
      const sumAll = rows.reduce((s, r) => s + (Number(r.premio_lordo) || 0), 0);
      const quietanzeRows = rows.filter(
        (r) => !!r.sostituisce_polizza && !r.is_regolazione && !r.is_proroga && !r.is_appendice_modifica,
      );
      const appendiciRows = rows.filter(
        (r) => !!r.is_regolazione || !!r.is_proroga || !!r.is_appendice_modifica,
      );
      return {
        totale: sumAll,
        quietanzeCount: quietanzeRows.length,
        quietanzeTotale: quietanzeRows.reduce((s, r) => s + (Number(r.premio_lordo) || 0), 0),
        appendiciCount: appendiciRows.length,
        appendiciTotale: appendiciRows.reduce((s, r) => s + (Number(r.premio_lordo) || 0), 0),
      };
    },
  });
  const totalePremio = totaleData?.totale ?? 0;

  // Rinnovi in attesa di messa a cassa della polizza precedente
  const { data: pendingRinnovi } = useQuery({
    queryKey: ["portafoglio-carico-pending", dateDa, dateA, filtroUffici.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("v_portafoglio_quietanze")
        .select("id, quietanza_id, polizza_id, numero_titolo, cliente_nome_display, compagnia_nome, data_scadenza, premio_lordo, sostituisce_polizza, ufficio_id")
        .eq("stato", "in_attesa_rinnovo");
      q = applyDateRange(q, "data_scadenza");
      q = applySedeFilter(q);
      const { data } = await q.order("data_scadenza", { ascending: true });
      return (data || []);
    },
  });
  const pendingCount = pendingRinnovi?.length || 0;

  const { data: bonificiAperti = [], isFetching: bonificiLoading } = useQuery({
    queryKey: ["incassi-bonifici-aperti", filtroUffici.join(",")],
    queryFn: () =>
      fetchBonificiApertiPerIncassi({
        ufficioIds: filtroUffici.length > 0 ? filtroUffici : undefined,
      }),
    staleTime: 30_000,
  });
  const totaleBonificiAperti = useMemo(
    () => bonificiAperti.reduce((s, b) => s + (Number(b.importo) || 0), 0),
    [bonificiAperti],
  );

  /** Per riga quietanza: match nome (importo ignorato). */
  const suggerimentiByTitoloId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof suggestBonificiPerCliente>>();
    for (const p of polizze) {
      if (p.stato !== "attivo" || p.data_messa_cassa) continue;
      const sug = suggestBonificiPerCliente(bonificiAperti, {
        clienteId: (p as any).cliente_anagrafica_id,
        clienteNome: p.cliente_nome_display,
      });
      if (sug.length > 0) map.set(p.id, sug);
    }
    return map;
  }, [polizze, bonificiAperti]);

  const quietanzeConSuggerimento = suggerimentiByTitoloId.size;

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-pending"] });
    queryClient.invalidateQueries({ queryKey: ["incassi-bonifici-aperti"] });
    queryClient.invalidateQueries({ queryKey: ["messa-cassa-bonifici-candidati"] });
    queryClient.invalidateQueries({ queryKey: ["mov-bancari"] });
    queryClient.invalidateQueries({ queryKey: ["anticipi-residuo-by-clienti"] });
    queryClient.invalidateQueries({ queryKey: ["anticipi-globale"] });
    queryClient.invalidateQueries({ queryKey: ["polizze_cliente"] });
  };

  const openIncassa = useCallback(
    (
      rows: Array<{ id: string; numero_titolo?: string | null; premio_lordo?: number | null; cliente_anagrafica_id?: string | null }>,
      prefer?: PreferredBonificoContext | null,
    ) => {
      setPreferredBonifico(prefer ?? null);
      setCassaDialogTitoli(rows);
      setCassaDialogOpen(true);
    },
    [],
  );

  const pickBonificoPerRiga = useCallback(
    (
      p: { id: string; numero_titolo?: string | null; premio_lordo?: number | null; cliente_anagrafica_id?: string | null },
      b: BonificoSuggerito | BonificoAperto,
    ) => {
      openIncassa(
        [{
          id: p.id,
          numero_titolo: p.numero_titolo,
          premio_lordo: p.premio_lordo,
          cliente_anagrafica_id: p.cliente_anagrafica_id,
        }],
        {
          movimentoId: b.id,
          contoBancarioId: b.conto_bancario_id,
        },
      );
    },
    [openIncassa],
  );

  // Solo polizze attive E mai messe a cassa sono incassabili (evita doppio incasso)
  const selectedAttive = useMemo(
    () => polizze.filter(p => selectedIds.has(p.id) && p.stato === "attivo" && !p.data_messa_cassa),
    [polizze, selectedIds]
  );

  const handleUsaBonifico = useCallback(
    (b: BonificoAperto) => {
      const prefer: PreferredBonificoContext = {
        movimentoId: b.id,
        contoBancarioId: b.conto_bancario_id,
      };
      if (selectedAttive.length === 0) {
        setPreferredBonifico(prefer);
        toast.message("Bonifico memorizzato", {
          description: "Seleziona le quietanze e poi clicca Incassa: il bonifico sarà già proposto.",
        });
        return;
      }
      openIncassa(
        selectedAttive.map((p) => ({
          id: p.id,
          numero_titolo: p.numero_titolo,
          premio_lordo: p.premio_lordo,
          cliente_anagrafica_id: (p as any).cliente_anagrafica_id,
        })),
        prefer,
      );
    },
    [selectedAttive, openIncassa],
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
    const notificaIds: string[] = [];
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
        notificaIds.push(p.id);
        // Genera provvigioni per ogni polizza messa a cassa
        supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: p.id } }).catch(() => {});
      }

    }
    if (notificaIds.length > 0) {
      invokeNotificaMessaCassa(notificaIds)
        .then(({ data, error }) => {
          if (error) toast.warning("Notifica agenzia non inviata");
          else if (data?.archive_error) toast.warning(`Email inviata ma archivio PDF fallito: ${data.archive_error}`);
          else if (data?.documenti_archiviati) {
            queryClient.invalidateQueries({ queryKey: ["documenti", "titolo"] });
          }
        })
        .catch(() => toast.warning("Notifica agenzia non inviata"));
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
  }, [selectedAttive, queryClient]);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incassi</h1>
          <p className="text-sm text-muted-foreground">
            {isVistaIncassati ? (
              (() => {
                if (!dateDa && !dateA && filtroPeriodo === "tutte") {
                  return "Quietanze già messe a cassa. Annullando un incasso tornano tra i pendenti.";
                }
                if (!dateDa && !dateA && filtroPeriodo === "mese_corrente") {
                  return "Incassate nel mese corrente (data messa a cassa).";
                }
                const da = dateDa ? format(new Date(dateDa), "dd/MM/yyyy") : null;
                const a = dateA ? format(new Date(dateA), "dd/MM/yyyy") : null;
                if (da && a) return `Incassate dal ${da} al ${a}`;
                if (da) return `Incassate dal ${da}`;
                return `Incassate fino al ${a}`;
              })()
            ) : (
              (() => {
                const labelBase = "Da incassare";
                if (!dateDa && !dateA) {
                  return (
                    <>
                      Quietanze e appendici ancora da mettere a cassa
                      {isDefaultExtended && <span className="ml-2 text-xs text-primary">· inclusi arretrati</span>}
                    </>
                  );
                }
                const da = dateDa ? format(new Date(dateDa), "dd/MM/yyyy") : null;
                const a = dateA ? format(new Date(dateA), "dd/MM/yyyy") : null;
                if (da && a) return `${labelBase} dal ${da} al ${a}`;
                if (da) return `${labelBase} dal ${da}`;
                return `${labelBase} fino al ${a}`;
              })()
            )}
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={vistaIncasso}
          onValueChange={(v) => {
            if (!v) return;
            switchVista(v as VistaIncasso);
          }}
          className="border rounded-md"
        >
          <ToggleGroupItem value="pendenti" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-4">
            Pendenti
          </ToggleGroupItem>
          <ToggleGroupItem value="incassati" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-4">
            Incassati
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Bulk action buttons */}
      {(selectedAttive.length > 0 || selectedGarantibile.length > 0 || selectedIncassate.length > 0) && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm text-muted-foreground">{selectedIds.size} selezionat{selectedIds.size === 1 ? "a" : "e"}</span>
          {!isVistaIncassati && selectedAttive.length > 0 && (
            <Button
              size="sm"
              onClick={() =>
                openIncassa(
                  selectedAttive.map((p) => ({
                    id: p.id,
                    numero_titolo: p.numero_titolo,
                    premio_lordo: p.premio_lordo,
                    cliente_anagrafica_id: (p as any).cliente_anagrafica_id,
                  })),
                  preferredBonifico,
                )
              }
              disabled={bulkLoading}
              className="gap-1"
            >
              <Banknote className="h-3.5 w-3.5" />
              Incassa ({selectedAttive.length})
            </Button>
          )}
          {!isVistaIncassati && selectedGarantibile.length > 0 && (
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

      <div className={`grid grid-cols-1 md:grid-cols-2 ${isVistaIncassati ? "lg:grid-cols-2" : "lg:grid-cols-4"} gap-4`}>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-accent/50 p-3">
              <Clock className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {isVistaIncassati ? "Incassate (filtro)" : "Totale titoli"}
              </p>
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
              <p className="text-sm text-muted-foreground">
                {isVistaIncassati
                  ? (filtroTipo === "regolazioni" ? "Appendici incassate" : "Quietanze incassate")
                  : (filtroTipo === "regolazioni" ? "Appendici" : "Quietanze")}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {filtroTipo === "regolazioni"
                  ? (totaleData?.appendiciCount ?? 0)
                  : (totaleData?.quietanzeCount ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtCurrency(
                  filtroTipo === "regolazioni"
                    ? (totaleData?.appendiciTotale ?? 0)
                    : (totaleData?.quietanzeTotale ?? 0),
                )}
              </p>
            </div>
          </CardContent>
        </Card>
        {!isVistaIncassati && (
          <Card
            className="cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setBonificiPanelOpenSync(!bonificiPanelOpen)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-sky-100 p-3">
                <ArrowRightLeft className="h-6 w-6 text-sky-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bonifici aperti</p>
                <p className="text-2xl font-bold text-foreground">{bonificiAperti.length}</p>
                <p className="text-xs text-muted-foreground">{fmtCurrency(totaleBonificiAperti)}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {!isVistaIncassati && (
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
        )}
      </div>

      {!isVistaIncassati && (
        <IncassiBonificiPanel
          open={bonificiPanelOpen}
          onOpenChange={setBonificiPanelOpenSync}
          bonifici={bonificiAperti}
          loading={bonificiLoading}
          sedeFilterActive={filtroUffici.length > 0}
          suggerimentiCount={quietanzeConSuggerimento}
          onUsaPerIncasso={handleUsaBonifico}
        />
      )}

      {/* Banner: rinnovi in attesa di messa a cassa della polizza precedente */}
      {!isVistaIncassati && pendingCount > 0 && (
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
        <UfficiFilterMultiSelect
          value={filtroUffici}
          onChange={(next) => {
            setFiltroUffici(next);
            setPage(0);
            updateUrl({ sedi: next });
          }}
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground" title={isVistaIncassati ? "Data messa a cassa" : "Inizio garanzia"}>
            Dal
          </span>
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
          {isVistaIncassati && (
            <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">(messa a cassa)</span>
          )}
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
          <ToggleGroupItem value="mese_corrente" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            {isVistaIncassati ? "Mese corrente" : "Mese Corrente"}
          </ToggleGroupItem>
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
        <div className="text-center py-10 text-muted-foreground">
          {isVistaIncassati
            ? "Nessuna quietanza incassata con i filtri selezionati"
            : filtroTipo === "regolazioni"
              ? "Nessuna appendice da incassare"
              : "Nessuna quietanza da incassare"}
        </div>
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
                  const isQ = isQuietanzaRow(p) || (Number(p.numero_rata) || 0) > 1;
                  const statoShown = displayStatoPolizza(p);
                  const polizzaMadreNumero = p.numero_polizza_snapshot || p.numero_titolo;
                  return (
                    <TableRow
                      key={p.id}
                      className={`cursor-pointer ${rowBorderClass(p)} ${inCopertura ? "bg-orange-50 hover:bg-orange-100/70" : p.is_proroga ? "bg-blue-50/40" : p.is_regolazione ? "bg-orange-50/40" : p.is_appendice_modifica ? "bg-primary/5" : messaCassaRowBgClass(p) || (!isMessaACassa(p) && isQ ? "hover:bg-muted/40" : "")}`}
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
                        {p.is_proroga && <span className="text-blue-600 mr-1" title="Proroga collegata">↳</span>}
                        {p.is_regolazione && <span className="text-orange-600 mr-1" title="Regolazione collegata">↳</span>}
                        {p.is_appendice_modifica && <span className="text-primary mr-1" title="Appendice modifica">↳</span>}
                        {p.titolo_derivato_numero || p.numero_titolo || "—"}
                        {p.titolo_derivato_numero && p.numero_titolo && p.titolo_derivato_numero !== p.numero_titolo && (
                          <span className="text-xs text-muted-foreground ml-1">({p.numero_titolo})</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {p.is_proroga ? (
                          <Badge className="bg-blue-500 hover:bg-blue-600 text-white" title="Titolo di proroga">Proroga</Badge>
                        ) : p.is_regolazione ? (
                          <Badge className="bg-orange-500 hover:bg-orange-600 text-white" title="Titolo di Regolazione Premio">Regolazione</Badge>
                        ) : p.is_appendice_modifica ? (
                          <Badge variant="secondary" title="Appendice di modifica">Modifica</Badge>
                        ) : (
                          <TipoPolizzaBadge
                            tipo="quietanza"
                            numero={p.numero_rata || (isQ ? undefined : 1)}
                            totale={p.numero_rate_totali || (isQ ? undefined : 1)}
                            messaACassa={isMessaACassa(p)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{p.cliente_nome_display || "—"}</span>
                          {(() => {
                            const sug = suggerimentiByTitoloId.get(p.id);
                            if (!sug?.length || p.stato !== "attivo" || p.data_messa_cassa) return null;
                            return (
                              <BonificoMatchBadge
                                suggerimenti={sug}
                                onPick={(b) =>
                                  pickBonificoPerRiga(
                                    {
                                      id: p.id,
                                      numero_titolo: p.numero_titolo,
                                      premio_lordo: p.premio_lordo,
                                      cliente_anagrafica_id: (p as any).cliente_anagrafica_id,
                                    },
                                    b,
                                  )
                                }
                              />
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>{p.compagnia_nome || "—"}</TableCell>
                      <TableCell>{p.ramo_nome || "—"}</TableCell>
                      <TableCell>{fmtDate(p.garanzia_da)}</TableCell>
                      <TableCell>{fmtDate(p.garanzia_a)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.targa_telaio || "—"}</TableCell>
                      <TableCell>{frazLabel(p.rate)}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(p.premio_lordo)}</TableCell>
                      <TableCell className="text-sm">{p.ae_nome || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={p.produttori_display || p.produttore_nome || undefined}>{p.produttori_display || p.produttore_nome || "—"}</TableCell>
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
        onOpenChange={(o) => {
          setCassaDialogOpen(o);
          if (!o) setPreferredBonifico(null);
        }}
        titoli={cassaDialogTitoli}
        preferredBonifico={preferredBonifico}
        onSuccess={() => {
          setSelectedIds(new Set());
          setPreferredBonifico(null);
          invalidateQueries();
        }}
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
