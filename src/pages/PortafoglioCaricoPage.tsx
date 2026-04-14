// Carico del Mese – v2 con checkbox, filtro stato, colorazione
import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { Clock, Search, ChevronLeft, ChevronRight, Euro, Banknote, Undo2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";

const PAGE_SIZE = 25;

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const PortafoglioCaricoPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  
  
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [page, setPage] = useState(0);
  const [caricoDate, setCaricoDate] = useState(new Date());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const caricoStart = format(startOfMonth(caricoDate), "yyyy-MM-dd");
  const caricoEnd = format(endOfMonth(caricoDate), "yyyy-MM-dd");


  const { data: result, isLoading } = useQuery({
    queryKey: ["portafoglio-carico", search, filtroStato, page, caricoStart, caricoEnd],
    queryFn: async () => {
      let q = supabase.from("v_portafoglio_titoli" as any).select(
        "id, numero_titolo, compagnia_nome, ramo_nome, cliente_nome_display, cliente_codice, stato, garanzia_da, garanzia_a, data_scadenza, premio_lordo, rate, ae_nome, specialist, produttore_nome, provvigioni_firma, provvigioni_quietanza, targa_telaio, compagnia_id, ramo_id, data_messa_cassa, data_pagamento, data_decorrenza_rinnovo",
        { count: "exact" }
      ).gte("data_scadenza", caricoStart).lte("data_scadenza", caricoEnd).in("stato", ["attivo", "incassato"]);

      if (search) {
        q = q.or(`numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%`);
      }
      if (filtroStato === "attivo") q = q.eq("stato", "attivo");
      if (filtroStato === "incassato") q = q.eq("stato", "incassato");

      const { data, count } = await q
        .order("data_scadenza", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      return { data: data || [], count: count || 0 };
    },
  });

  const polizze = (result?.data || []) as any[];
  const totalCount = result?.count || 0;

  const { data: totaleData } = useQuery({
    queryKey: ["portafoglio-carico-totale", search, filtroStato, caricoStart, caricoEnd],
    queryFn: async () => {
      let q = supabase.from("v_portafoglio_titoli" as any).select("premio_lordo")
        .gte("data_scadenza", caricoStart).lte("data_scadenza", caricoEnd).in("stato", ["attivo", "incassato"]);
      if (search) {
        q = q.or(`numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%`);
      }
      
      if (filtroStato === "attivo") q = q.eq("stato", "attivo");
      if (filtroStato === "incassato") q = q.eq("stato", "incassato");
      const { data } = await q;
      return (data || []).reduce((sum: number, r: any) => sum + (Number(r.premio_lordo) || 0), 0);
    },
  });
  const totalePremio = totaleData ?? 0;

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
  };

  const mettiACassa = useCallback(async (titoloId: string) => {
    const today = todayStr();
    setLoadingIds(prev => new Set(prev).add(titoloId));
    try {
      const { error } = await (supabase.from("titoli") as any).update({
        stato: "incassato",
        data_incasso: today,
        data_messa_cassa: today,
        data_pagamento: today,
        data_decorrenza_rinnovo: today,
      }).eq("id", titoloId);

      if (error) throw error;

      await logAttivita({
        azione: "messa_a_cassa",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: { data_messa_cassa: today, data_pagamento: today, data_decorrenza_rinnovo: today },
      });

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
      const { error } = await (supabase.from("titoli") as any).update({
        stato: "attivo",
        data_incasso: null,
        data_messa_cassa: null,
        data_pagamento: null,
        data_decorrenza_rinnovo: null,
      }).eq("id", titoloId);

      if (error) throw error;

      await logAttivita({
        azione: "annulla_incasso",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: {},
      });

      toast.success("Incasso annullato");
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

  const selectedAttive = useMemo(() => polizze.filter(p => selectedIds.has(p.id) && p.stato === "attivo"), [polizze, selectedIds]);
  const selectedIncassate = useMemo(() => polizze.filter(p => selectedIds.has(p.id) && p.stato === "incassato"), [polizze, selectedIds]);

  const bulkMettiACassa = useCallback(async () => {
    if (selectedAttive.length === 0) return;
    setBulkLoading(true);
    const today = todayStr();
    let ok = 0, ko = 0;
    for (const p of selectedAttive) {
      const { error } = await (supabase.from("titoli") as any).update({
        stato: "incassato",
        data_incasso: today,
        data_messa_cassa: today,
        data_pagamento: today,
        data_decorrenza_rinnovo: today,
      }).eq("id", p.id);
      if (error) ko++; else ok++;
    }
    if (ok > 0) {
      await logAttivita({
        azione: "messa_a_cassa_massiva",
        entita_tipo: "titolo",
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
      const { error } = await (supabase.from("titoli") as any).update({
        stato: "attivo",
        data_incasso: null,
        data_messa_cassa: null,
        data_pagamento: null,
        data_decorrenza_rinnovo: null,
      }).eq("id", p.id);
      if (error) ko++; else ok++;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carico del Mese</h1>
          <p className="text-sm text-muted-foreground">Polizze in scadenza da confermare o rinnovare</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => { setCaricoDate(d => subMonths(d, 1)); setPage(0); setSelectedIds(new Set()); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center capitalize">
            {format(caricoDate, "MMMM yyyy", { locale: it })}
          </span>
          <Button variant="outline" size="icon" onClick={() => { setCaricoDate(d => addMonths(d, 1)); setPage(0); setSelectedIds(new Set()); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bulk action buttons */}
      {(selectedAttive.length > 0 || selectedIncassate.length > 0) && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm text-muted-foreground">{selectedIds.size} selezionat{selectedIds.size === 1 ? "a" : "e"}</span>
          {selectedAttive.length > 0 && (
            <Button size="sm" onClick={bulkMettiACassa} disabled={bulkLoading} className="gap-1">
              <Banknote className="h-3.5 w-3.5" />
              {bulkLoading ? "In corso..." : `Metti a Cassa (${selectedAttive.length})`}
            </Button>
          )}
          {selectedIncassate.length > 0 && (
            <Button size="sm" variant="outline" onClick={bulkAnnullaIncasso} disabled={bulkLoading} className="gap-1">
              <Undo2 className="h-3.5 w-3.5" />
              {bulkLoading ? "In corso..." : `Annulla Incasso (${selectedIncassate.length})`}
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-accent/50 p-3">
              <Clock className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Polizze in scadenza</p>
              <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Euro className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Totale premio lordo</p>
              <p className="text-2xl font-bold text-foreground">{fmtCurrency(totalePremio)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per n° polizza, cliente, codice..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={filtroStato} onValueChange={(v) => { setFiltroStato(v); setPage(0); }}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Stato incasso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Entrambe le opzioni</SelectItem>
            <SelectItem value="attivo">Da mettere a cassa</SelectItem>
            <SelectItem value="incassato">Messe a cassa</SelectItem>
          </SelectContent>
        </Select>
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
                  <TableHead>N° Polizza</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead>Fraz</TableHead>
                  <TableHead className="text-right">Lordo</TableHead>
                  <TableHead>AE</TableHead>
                  <TableHead>Produttore</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-center">Messa a Cassa</TableHead>
                  <TableHead className="text-center">Azione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {polizze.map((p: any) => {
                  const isIncassato = p.stato === "incassato";
                  const isProcessing = loadingIds.has(p.id);
                  return (
                    <TableRow
                      key={p.id}
                      className={`cursor-pointer ${isIncassato ? "bg-yellow-50 hover:bg-yellow-100/70" : ""}`}
                      onClick={() => navigate(`/titoli/${p.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{p.numero_titolo || "—"}</TableCell>
                      <TableCell>{p.cliente_nome_display || "—"}</TableCell>
                      <TableCell>{p.compagnia_nome || "—"}</TableCell>
                      <TableCell>{p.ramo_nome || "—"}</TableCell>
                      <TableCell>{fmtDate(p.data_scadenza)}</TableCell>
                      <TableCell>{frazLabel(p.rate)}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(p.premio_lordo)}</TableCell>
                      <TableCell className="text-sm">{p.ae_nome || "—"}</TableCell>
                      <TableCell className="text-sm">{p.produttore_nome || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statoBadgeVariant(p.stato)}>{p.stato}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {isIncassato ? fmtDate(p.data_messa_cassa) : "—"}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {isIncassato ? (
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
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isProcessing}
                            onClick={() => mettiACassa(p.id)}
                            className="gap-1 h-8 text-xs"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            {isProcessing ? "..." : "Cassa"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default PortafoglioCaricoPage;
