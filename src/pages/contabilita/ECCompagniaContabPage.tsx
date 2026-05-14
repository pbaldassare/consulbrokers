import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Download, Building2, TrendingUp, Percent, Scale, Filter, RotateCcw, Send, ChevronRight, ChevronDown, CreditCard, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { DatePicker } from "@/components/contabilita/DatePicker";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Filters {
  compagnia_id: string | null;
  ufficio_id: string | null;
  produttore_id: string | null;
  periodo_dal: Date | null;
  periodo_al: Date | null;
  tipo_pagamento: string | null;
  
}

interface TitoloDetail {
  id: string;
  numero_titolo: string | null;
  data_messa_cassa: string | null;
  premio_lordo: number;
  importo_incassato: number;
  conferimento_gestito: boolean;
  fondi_ricevuti: boolean;
  tipo_pagamento: string | null;
}

interface GroupedRow {
  compagnia_id: string;
  nome: string;
  codice: string;
  mail: string;
  lordo: number;
  provvigioni: number;
  data_min: string | null;
  data_max: string | null;
  titoli: TitoloDetail[];
}

interface PagaRimessaState {
  open: boolean;
  compagniaId: string;
  compagniaNome: string;
  iban: string; // IBAN destinazione (agenzia/compagnia) — informativo
  contoMittenteId: string | null; // Conto Consulbrokers da cui parte il pagamento
  ibanMittente: string; // IBAN del conto Consulbrokers selezionato (= iban_utilizzato)
  importoTotale: number;
  importoPagato: string;
  note: string;
  titoliIds?: string[];
  titoliCount: number;
}

interface PreConfirmState {
  open: boolean;
  compagniaId: string;
  compagniaNome: string;
  titoliCount: number;
  importo: number;
}

const defaultFilters: Filters = {
  compagnia_id: null, ufficio_id: null, produttore_id: null, periodo_dal: null, periodo_al: null, tipo_pagamento: null,
};

const ECCompagniaContabPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedTitoli, setSelectedTitoli] = useState<Record<string, Set<string>>>({});
  const [pagaDialog, setPagaDialog] = useState<PagaRimessaState>({
    open: false, compagniaId: "", compagniaNome: "", iban: "", contoMittenteId: null, ibanMittente: "", importoTotale: 0, importoPagato: "", note: "", titoliCount: 0,
  });
  const [preConfirm, setPreConfirm] = useState<PreConfirmState>({
    open: false, compagniaId: "", compagniaNome: "", titoliCount: 0, importo: 0,
  });
  const set = (partial: Partial<Filters>) => setFilters((f) => ({ ...f, ...partial }));

  // Conti correnti Consulbrokers (tipo 'generico') — sorgente del bonifico verso l'agenzia
  const { data: contiMittente = [] } = useQuery({
    queryKey: ["conti-bancari-generico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conti_bancari" as any)
        .select("id, etichetta, iban, intestato_a, banca, is_default")
        .eq("tipo", "generico")
        .eq("attivo", true)
        .order("is_default", { ascending: false })
        .order("etichetta");
      if (error) throw error;
      return (data || []) as any[];
    },
  });
  const contoMittenteDefault = contiMittente.find((c: any) => c.is_default) || contiMittente[0] || null;

  const toggleExpand = (compagniaId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(compagniaId)) next.delete(compagniaId);
      else next.add(compagniaId);
      return next;
    });
  };

  const toggleTitolo = (compagniaId: string, titoloId: string) => {
    setSelectedTitoli((prev) => {
      const current = new Set(prev[compagniaId] || []);
      if (current.has(titoloId)) current.delete(titoloId);
      else current.add(titoloId);
      return { ...prev, [compagniaId]: current };
    });
  };

  const toggleAllTitoli = (compagniaId: string, titoli: TitoloDetail[]) => {
    setSelectedTitoli((prev) => {
      const current = prev[compagniaId] || new Set();
      const allSelected = titoli.every((t) => current.has(t.id));
      if (allSelected) {
        return { ...prev, [compagniaId]: new Set() };
      }
      return { ...prev, [compagniaId]: new Set(titoli.map((t) => t.id)) };
    });
  };

  const { data: compagnie } = useQuery({
    queryKey: ["agenzie-ec"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome, codice, comune, mail, iban").eq("attiva", true).order("nome");
      return data || [];
    },
  });
  const { data: uffici } = useQuery({
    queryKey: ["uffici-ec"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
  });
  const { data: produttori } = useQuery({
    queryKey: ["produttori-ec"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["ec-agenzia-contab", filters],
    queryFn: async () => {
      // Fetch titoli already in rimessa_dettaglio to exclude them
      const { data: rimessiRaw } = await supabase
        .from("rimessa_dettaglio")
        .select("titolo_id");
      const rimessiSet = new Set((rimessiRaw || []).map((r) => r.titolo_id));

      let query = supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, importo_incassato, compagnia_id, ufficio_id, produttore_id, data_messa_cassa, provvigioni_firma, provvigioni_quietanza, conferimento_gestito, fondi_ricevuti, tipo_pagamento, compagnie(nome, codice, mail)")
        .not("compagnia_id", "is", null)
        .eq("stato", "incassato");

      if (filters.ufficio_id) query = query.eq("ufficio_id", filters.ufficio_id);
      if (filters.produttore_id) query = query.eq("produttore_id", filters.produttore_id);
      if (filters.periodo_dal) query = query.gte("data_messa_cassa", format(filters.periodo_dal, "yyyy-MM-dd"));
      if (filters.periodo_al) query = query.lte("data_messa_cassa", format(filters.periodo_al, "yyyy-MM-dd"));

      const { data: titoli, error } = await query;
      if (error) throw error;

      const grouped: Record<string, GroupedRow> = {};

      for (const t of titoli || []) {
        // Exclude titles already included in a rimessa
        if (rimessiSet.has(t.id)) continue;

        const cId = (t as any).compagnia_id as string;
        if (!cId) continue;
        if (filters.compagnia_id && cId !== filters.compagnia_id) continue;
        if (filters.tipo_pagamento && (t as any).tipo_pagamento !== filters.tipo_pagamento) continue;
        const isGestito = !!(t as any).conferimento_gestito;
        const fondiOk = (t as any).fondi_ricevuti !== false;
        if (filters.modalita_incasso === "diretto" && isGestito) continue;
        if (filters.modalita_incasso === "gestito" && !isGestito) continue;
        if (filters.modalita_incasso === "attesa_fondi" && (!isGestito || fondiOk)) continue;
        const comp = (t as any).compagnie;
        if (!grouped[cId]) {
          grouped[cId] = {
            compagnia_id: cId,
            nome: comp?.nome || "N/D",
            codice: comp?.codice || "",
            mail: comp?.mail || "",
            lordo: 0,
            provvigioni: 0,
            data_min: null,
            data_max: null,
            titoli: [],
          };
        }
        grouped[cId].lordo += Number(t.premio_lordo) || 0;
        grouped[cId].provvigioni += (Number(t.provvigioni_firma) || 0) + (Number(t.provvigioni_quietanza) || 0);
        grouped[cId].titoli.push({
          id: t.id,
          numero_titolo: t.numero_titolo,
          data_messa_cassa: t.data_messa_cassa,
          premio_lordo: Number(t.premio_lordo) || 0,
          importo_incassato: Number(t.importo_incassato) || 0,
          conferimento_gestito: !!(t as any).conferimento_gestito,
          fondi_ricevuti: (t as any).fondi_ricevuti !== false,
          tipo_pagamento: (t as any).tipo_pagamento || null,
        });
        const dmc = t.data_messa_cassa;
        if (dmc) {
          if (!grouped[cId].data_min || dmc < grouped[cId].data_min!) grouped[cId].data_min = dmc;
          if (!grouped[cId].data_max || dmc > grouped[cId].data_max!) grouped[cId].data_max = dmc;
        }
      }
      return Object.values(grouped).sort((a, b) => b.lordo - a.lordo);
    },
  });

  const creaRimessaMutation = useMutation({
    mutationFn: async ({ compagniaId, titoliIds, iban, importoPagato, note }: { compagniaId: string; titoliIds?: string[]; iban: string; importoPagato: number; note: string }) => {
      const { data, error } = await supabase.functions.invoke("gestione-rimessa", {
        body: {
          action: "crea",
          compagnia_id: compagniaId,
          ufficio_id: profile?.ufficio_id || null,
          created_by: user?.id || null,
          data_da: filters.periodo_dal ? format(filters.periodo_dal, "yyyy-MM-dd") : undefined,
          data_a: filters.periodo_al ? format(filters.periodo_al, "yyyy-MM-dd") : undefined,
          titoli_ids: titoliIds || undefined,
          iban_utilizzato: iban,
          importo_pagato: importoPagato,
          note: note || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ec-agenzia-contab"] });
      queryClient.invalidateQueries({ queryKey: ["rimessa_premi"] });
      setSelectedTitoli((prev) => ({ ...prev, [variables.compagniaId]: new Set() }));
      setPagaDialog((prev) => ({ ...prev, open: false }));
      toast.success(`Rimessa pagata — ${data.titoli_count} titoli inclusi`);
      navigate("/contabilita/storico-rimesse");
    },
    onError: (e: any) => toast.error(e.message || "Errore nella creazione della rimessa"),
  });

  const handleOpenPagaDialog = (compagniaId: string, daRimettere: number, titoli: TitoloDetail[]) => {
    const selected = selectedTitoli[compagniaId];
    const titoliIds = selected && selected.size > 0 ? Array.from(selected) : undefined;
    const count = titoliIds ? titoliIds.length : titoli.length;
    const comp = compagnie?.find((c) => c.id === compagniaId);

    // Show pre-confirmation AlertDialog first
    setPreConfirm({
      open: true,
      compagniaId,
      compagniaNome: comp?.nome || "N/D",
      titoliCount: count,
      importo: daRimettere,
    });
  };

  const handlePreConfirmProceed = () => {
    const compagniaId = preConfirm.compagniaId;
    const selected = selectedTitoli[compagniaId];
    const titoliIds = selected && selected.size > 0 ? Array.from(selected) : undefined;
    const comp = compagnie?.find((c) => c.id === compagniaId);

    setPreConfirm((prev) => ({ ...prev, open: false }));
    setPagaDialog({
      open: true,
      compagniaId,
      compagniaNome: comp?.nome || "N/D",
      iban: comp?.iban || "",
      contoMittenteId: contoMittenteDefault?.id || null,
      ibanMittente: contoMittenteDefault?.iban || "",
      importoTotale: preConfirm.importo,
      importoPagato: preConfirm.importo.toFixed(2),
      note: "",
      titoliIds,
      titoliCount: preConfirm.titoliCount,
    });
  };

  const handleConfermaPagamento = () => {
    const importo = parseFloat(pagaDialog.importoPagato);
    if (isNaN(importo) || importo <= 0) {
      toast.error("Inserire un importo valido");
      return;
    }
    if (importo > pagaDialog.importoTotale) {
      toast.error("L'importo pagato non può superare l'importo da rimettere");
      return;
    }
    if (!pagaDialog.contoMittenteId || !pagaDialog.ibanMittente) {
      toast.error("Selezionare il conto Consulbrokers da cui parte il pagamento");
      return;
    }
    creaRimessaMutation.mutate({
      compagniaId: pagaDialog.compagniaId,
      titoliIds: pagaDialog.titoliIds,
      iban: pagaDialog.ibanMittente,
      importoPagato: importo,
      note: pagaDialog.note,
    });
  };

  const rows = data || [];
  const totLordo = rows.reduce((s, r) => s + r.lordo, 0);
  const totProvv = rows.reduce((s, r) => s + r.provvigioni, 0);
  const totDaRimettere = totLordo - totProvv;
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const hasFilters = filters.compagnia_id || filters.ufficio_id || filters.produttore_id || filters.periodo_dal || filters.periodo_al || filters.tipo_pagamento || filters.modalita_incasso;

  const formatDateRange = (min: string | null, max: string | null) => {
    if (!min) return "—";
    const fmtD = (d: string) => format(new Date(d), "dd/MM/yyyy");
    if (!max || min === max) return fmtD(min);
    return `${fmtD(min)} – ${fmtD(max)}`;
  };

  const exportCSV = () => {
    const header = "Agenzia,Codice,Data,Mail,Lordo,Provvigioni,Da Rimettere\n";
    const csv = rows.map((r) => `"${r.nome}","${r.codice}","${formatDateRange(r.data_min, r.data_max)}","${r.mail}",${r.lordo.toFixed(2)},${r.provvigioni.toFixed(2)},${(r.lordo - r.provvigioni).toFixed(2)}`).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ec_agenzie.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    { label: "N. Agenzie", value: rows.length.toString(), icon: Building2, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "Totale Lordo", value: fmt(totLordo), icon: TrendingUp, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Totale Provvigioni", value: fmt(totProvv), icon: Percent, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
    { label: "Da Rimettere", value: fmt(totDaRimettere), icon: Scale, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">E/C Agenzie</h1>
            <p className="text-sm text-muted-foreground">Estratto conto verso agenzie/plurimandatarie — solo titoli ancora da rimettere</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!rows.length}><Download className="mr-2 h-4 w-4" /> Esporta CSV</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}><CardContent className="p-4 flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", kpi.color)}><kpi.icon className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">{kpi.label}</p><p className="text-lg font-bold">{isLoading ? "..." : kpi.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> <span>Filtri</span>
          {hasFilters && <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setFilters({ ...defaultFilters })}><RotateCcw className="h-3 w-3 mr-1" /> Azzera</Button>}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <FilterSearchableSelect value={filters.compagnia_id} onValueChange={(v) => set({ compagnia_id: v })} options={(compagnie || []).map((c) => ({ value: c.id, label: c.nome }))} placeholder="Agenzia" allLabel="Tutte le agenzie" className="w-[240px]" />
          <FilterSearchableSelect value={filters.ufficio_id} onValueChange={(v) => set({ ufficio_id: v })} options={(uffici || []).map((u) => ({ value: u.id, label: u.nome_ufficio }))} placeholder="Sede" allLabel="Tutte le sedi" className="w-[200px]" />
          <FilterSearchableSelect value={filters.produttore_id} onValueChange={(v) => set({ produttore_id: v })} options={(produttori || []).map((p) => ({ value: p.id, label: `${p.cognome || ""} ${p.nome || ""}`.trim() }))} placeholder="Produttore" allLabel="Tutti i produttori" className="w-[220px]" />
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Periodo dal</Label><DatePicker value={filters.periodo_dal} onChange={(d) => set({ periodo_dal: d })} placeholder="Dal" /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Periodo al</Label><DatePicker value={filters.periodo_al} onChange={(d) => set({ periodo_al: d })} placeholder="Al" /></div>
          <FilterSearchableSelect value={filters.tipo_pagamento} onValueChange={(v) => set({ tipo_pagamento: v })} options={[{ value: "contanti", label: "Contanti" }, { value: "pos", label: "POS" }, { value: "bonifico", label: "Bonifico" }]} placeholder="Tipo Pagamento" allLabel="Tutti i pagamenti" className="w-[180px]" />
          
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Agenzia</TableHead><TableHead>Codice</TableHead><TableHead>Data</TableHead>
            <TableHead className="text-right">Lordo</TableHead><TableHead className="text-right">Provvigioni</TableHead>
            <TableHead className="text-right">Da Rimettere</TableHead>
            <TableHead className="w-[260px]">Azioni</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nessun titolo da rimettere</TableCell></TableRow>
            ) : rows.map((r) => {
              const daRimettere = r.lordo - r.provvigioni;
              const isExpanded = expandedRows.has(r.compagnia_id);
              const selected = selectedTitoli[r.compagnia_id] || new Set();
              const selectedCount = selected.size;
              return (
                <>
                  <TableRow key={r.compagnia_id} className="cursor-pointer" onClick={() => toggleExpand(r.compagnia_id)}>
                    <TableCell className="px-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>{r.codice}</TableCell>
                    <TableCell className="text-sm">{formatDateRange(r.data_min, r.data_max)}</TableCell>
                    <TableCell className="text-right">{fmt(r.lordo)}</TableCell>
                    <TableCell className="text-right">{fmt(r.provvigioni)}</TableCell>
                    <TableCell className="text-right font-semibold text-teal-600 dark:text-teal-400">{fmt(daRimettere)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          title="Stampa Estratto Conto Agenzia"
                          onClick={() => {
                            const sel = selectedTitoli[r.compagnia_id];
                            const ids = sel && sel.size > 0 ? Array.from(sel).join(",") : "";
                            const qs = new URLSearchParams({ compagniaId: r.compagnia_id });
                            if (ids) qs.set("titoliIds", ids);
                            if (filters.periodo_dal) qs.set("periodoDal", format(filters.periodo_dal, "yyyy-MM-dd"));
                            if (filters.periodo_al) qs.set("periodoAl", format(filters.periodo_al, "yyyy-MM-dd"));
                            navigate(`/contabilita/ec-agenzia/pdf?${qs.toString()}`);
                          }}
                        >
                          <FileText className="h-3 w-3" /> Stampa E/C
                        </Button>
                        {daRimettere > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={creaRimessaMutation.isPending}
                            onClick={() => handleOpenPagaDialog(r.compagnia_id, daRimettere, r.titoli)}
                          >
                            <CreditCard className="h-3 w-3" />
                            {selectedCount > 0 ? `Paga (${selectedCount})` : "Paga Rimessa"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${r.compagnia_id}-header`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell></TableCell>
                      <TableCell colSpan={7}>
                        <div className="py-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Checkbox
                              checked={r.titoli.length > 0 && r.titoli.every((t) => selected.has(t.id))}
                              onCheckedChange={() => toggleAllTitoli(r.compagnia_id, r.titoli)}
                            />
                            <span className="text-xs font-medium text-muted-foreground">Seleziona tutti ({r.titoli.length} titoli)</span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[40px] h-8"></TableHead>
                                <TableHead className="h-8 text-xs">N. Titolo</TableHead>
                                <TableHead className="h-8 text-xs">Data Messa a Cassa</TableHead>
                                <TableHead className="h-8 text-xs text-right">Premio Lordo</TableHead>
                                <TableHead className="h-8 text-xs text-right">Importo Incassato</TableHead>
                                <TableHead className="h-8 text-xs">Tipo Pagamento</TableHead>
                                <TableHead className="h-8 text-xs">Modalità Incasso</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {r.titoli.map((t) => {
                                const tipoPagLabel = t.tipo_pagamento === "contanti" ? "Contanti" : t.tipo_pagamento === "pos" ? "POS" : t.tipo_pagamento === "bonifico" ? "Bonifico" : t.tipo_pagamento === "carta_credito" ? "POS" : "—";
                                const tipoPagColor = t.tipo_pagamento === "contanti" ? "secondary" : t.tipo_pagamento === "pos" || t.tipo_pagamento === "carta_credito" ? "default" : t.tipo_pagamento === "bonifico" ? "outline" : "secondary";
                                return (
                                <TableRow key={t.id} className="hover:bg-muted/50">
                                  <TableCell className="py-1 px-2">
                                    <Checkbox
                                      checked={selected.has(t.id)}
                                      onCheckedChange={() => toggleTitolo(r.compagnia_id, t.id)}
                                    />
                                  </TableCell>
                                  <TableCell className="py-1 text-sm">{t.numero_titolo || "—"}</TableCell>
                                  <TableCell className="py-1 text-sm">{t.data_messa_cassa ? format(new Date(t.data_messa_cassa), "dd/MM/yyyy") : "—"}</TableCell>
                                  <TableCell className="py-1 text-sm text-right">{fmt(t.premio_lordo)}</TableCell>
                                  <TableCell className="py-1 text-sm text-right">{fmt(t.importo_incassato)}</TableCell>
                                  <TableCell className="py-1">
                                    <Badge variant={tipoPagColor as any} className="text-[10px] h-5">{tipoPagLabel}</Badge>
                                  </TableCell>
                                  <TableCell className="py-1">
                                    {t.conferimento_gestito ? (
                                      <Badge variant={t.fondi_ricevuti ? "default" : "destructive"} className="text-[10px] h-5">
                                        {t.fondi_ricevuti ? "Cop. Garantita ✓" : "In Attesa Fondi"}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] h-5">Incasso diretto</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
          {rows.length > 0 && <TableFooter><TableRow>
            <TableCell></TableCell>
            <TableCell colSpan={3} className="font-bold">Totale</TableCell>
            <TableCell className="text-right font-bold">{fmt(totLordo)}</TableCell><TableCell className="text-right font-bold">{fmt(totProvv)}</TableCell>
            <TableCell className="text-right font-bold text-teal-600 dark:text-teal-400">{fmt(totDaRimettere)}</TableCell>
            <TableCell></TableCell>
          </TableRow></TableFooter>}
        </Table>
      </div>

      {/* AlertDialog pre-conferma (Livello 1) */}
      <AlertDialog open={preConfirm.open} onOpenChange={(open) => setPreConfirm((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Rimessa</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per creare una rimessa per <strong>{preConfirm.compagniaNome}</strong> con <strong>{preConfirm.titoliCount}</strong> titoli per un totale di <strong>{fmt(preConfirm.importo)}</strong>.
              <br /><br />
              Vuoi procedere con il pagamento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handlePreConfirmProceed}>Procedi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Paga Rimessa (Livello 2) */}
      <Dialog open={pagaDialog.open} onOpenChange={(open) => setPagaDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Paga Rimessa all'Agenzia
            </DialogTitle>
            <DialogDescription>
              {pagaDialog.compagniaNome} — {pagaDialog.titoliCount} titoli
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Conto Consulbrokers (mittente)</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={pagaDialog.contoMittenteId || ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  const c = contiMittente.find((x: any) => x.id === id);
                  setPagaDialog((prev) => ({
                    ...prev,
                    contoMittenteId: id,
                    ibanMittente: c?.iban || "",
                  }));
                }}
              >
                <option value="">— Seleziona conto —</option>
                {contiMittente.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.etichetta}{c.is_default ? " ⭐" : ""} — {c.iban}
                  </option>
                ))}
              </select>
              {pagaDialog.ibanMittente && (
                <p className="text-xs text-muted-foreground font-mono">IBAN: {pagaDialog.ibanMittente}</p>
              )}
              {contiMittente.length === 0 && (
                <p className="text-xs text-amber-600">Nessun conto Consulbrokers (tipo "generico") configurato. Aggiungili in Anagrafiche → Conti bancari.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>IBAN Agenzia (destinazione)</Label>
              <Input
                value={pagaDialog.iban}
                onChange={(e) => setPagaDialog((prev) => ({ ...prev, iban: e.target.value }))}
                placeholder="IBAN di destinazione"
              />
              {!pagaDialog.iban && (
                <p className="text-xs text-amber-600">IBAN non trovato per questa compagnia. Inserirlo manualmente.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Importo da Rimettere</Label>
              <p className="text-sm text-muted-foreground">{fmt(pagaDialog.importoTotale)}</p>
            </div>
            <div className="space-y-2">
              <Label>Importo da Pagare</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={pagaDialog.importoTotale}
                value={pagaDialog.importoPagato}
                onChange={(e) => setPagaDialog((prev) => ({ ...prev, importoPagato: e.target.value }))}
              />
              {parseFloat(pagaDialog.importoPagato) < pagaDialog.importoTotale && parseFloat(pagaDialog.importoPagato) > 0 && (
                <p className="text-xs text-amber-600">Pagamento parziale — rimarranno {fmt(pagaDialog.importoTotale - parseFloat(pagaDialog.importoPagato))} da pagare</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Note (opzionale)</Label>
              <Textarea
                value={pagaDialog.note}
                onChange={(e) => setPagaDialog((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Note sul pagamento..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagaDialog((prev) => ({ ...prev, open: false }))}>Annulla</Button>
            <Button onClick={handleConfermaPagamento} disabled={creaRimessaMutation.isPending}>
              <CreditCard className="h-4 w-4 mr-2" />
              {creaRimessaMutation.isPending ? "Pagamento..." : "Conferma Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ECCompagniaContabPage;
