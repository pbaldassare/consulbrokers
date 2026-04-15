import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Building2, TrendingUp, Percent, Scale, Filter, RotateCcw, Send, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { DatePicker } from "@/components/contabilita/DatePicker";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import ServerPagination from "@/components/ServerPagination";

interface Filters {
  compagnia_id: string | null;
  ufficio_id: string | null;
  produttore_id: string | null;
  periodo_dal: Date | null;
  periodo_al: Date | null;
}

const defaultFilters: Filters = {
  compagnia_id: null, ufficio_id: null, produttore_id: null, periodo_dal: null, periodo_al: null,
};

const PAGE_SIZE = 25;
const statiRimessa = ["bozza", "pronta", "inviata", "errore"];

const ECCompagniaContabPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters });
  const set = (partial: Partial<Filters>) => setFilters((f) => ({ ...f, ...partial }));

  // Rimesse tab state
  const [filtroStato, setFiltroStato] = useState("all");
  const [rimessaPage, setRimessaPage] = useState(0);

  const { data: compagnie } = useQuery({
    queryKey: ["compagnie-ec"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome, codice, comune, mail").eq("attiva", true).order("nome");
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
    queryKey: ["ec-compagnia-contab", filters],
    queryFn: async () => {
      let query = supabase
        .from("titoli")
        .select("premio_lordo, importo_incassato, prodotto_id, ufficio_id, produttore_id, data_messa_cassa, provvigioni_firma, provvigioni_quietanza, prodotti!titoli_prodotto_id_fkey(compagnia_id)")
        .not("prodotto_id", "is", null)
        .eq("stato", "incassato");

      if (filters.ufficio_id) query = query.eq("ufficio_id", filters.ufficio_id);
      if (filters.produttore_id) query = query.eq("produttore_id", filters.produttore_id);
      if (filters.periodo_dal) query = query.gte("data_messa_cassa", format(filters.periodo_dal, "yyyy-MM-dd"));
      if (filters.periodo_al) query = query.lte("data_messa_cassa", format(filters.periodo_al, "yyyy-MM-dd"));

      const { data: titoli, error } = await query;
      if (error) throw error;

      // Fetch rimesse totals per compagnia
      const { data: rimesseAgg } = await supabase
        .from("rimessa_premi")
        .select("compagnia_id, totale_importi")
        .neq("stato", "errore");
      const rimesseMap = new Map<string, number>();
      for (const r of rimesseAgg || []) {
        if (r.compagnia_id) {
          rimesseMap.set(r.compagnia_id, (rimesseMap.get(r.compagnia_id) || 0) + Number(r.totale_importi || 0));
        }
      }

      const compagniaMap = new Map((compagnie || []).map(c => [c.id, c]));
      const grouped: Record<string, { compagnia_id: string; nome: string; codice: string; comune: string; mail: string; lordo: number; provvigioni: number; gia_rimesso: number }> = {};

      for (const t of titoli || []) {
        const prod = t.prodotti as any;
        if (!prod?.compagnia_id) continue;
        if (filters.compagnia_id && prod.compagnia_id !== filters.compagnia_id) continue;
        const comp = compagniaMap.get(prod.compagnia_id);
        const key = prod.compagnia_id;
        if (!grouped[key]) {
          grouped[key] = { compagnia_id: key, nome: comp?.nome || "N/D", codice: comp?.codice || "", comune: comp?.comune || "", mail: comp?.mail || "", lordo: 0, provvigioni: 0, gia_rimesso: rimesseMap.get(key) || 0 };
        }
        grouped[key].lordo += Number(t.premio_lordo) || 0;
        grouped[key].provvigioni += (Number(t.provvigioni_firma) || 0) + (Number(t.provvigioni_quietanza) || 0);
      }
      return Object.values(grouped).sort((a, b) => b.lordo - a.lordo);
    },
  });

  // --- Rimesse query ---
  const { data: rimesseResult, isLoading: rimesseLoading } = useQuery({
    queryKey: ["rimessa_premi", rimessaPage, filtroStato],
    queryFn: async () => {
      let q = supabase
        .from("rimessa_premi")
        .select("*, compagnie(nome), uffici(nome_ufficio), profiles(nome, cognome)", { count: "exact" });
      if (filtroStato !== "all") q = q.eq("stato", filtroStato);
      const { data, error, count } = await q
        .order("data_creazione", { ascending: false })
        .range(rimessaPage * PAGE_SIZE, (rimessaPage + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const revertMutation = useMutation({
    mutationFn: async (rimessaId: string) => {
      const { error: dErr } = await supabase.from("rimessa_dettaglio").delete().eq("rimessa_id", rimessaId);
      if (dErr) throw dErr;
      const { error: rErr } = await supabase.from("rimessa_premi").delete().eq("id", rimessaId);
      if (rErr) throw rErr;
      await logAttivita({ azione: "annullamento_rimessa", entita_tipo: "rimessa_premi", entita_id: rimessaId });
    },
    onSuccess: () => {
      toast.success("Rimessa annullata — i titoli sono tornati nel riepilogo");
      queryClient.invalidateQueries({ queryKey: ["rimessa_premi"] });
      queryClient.invalidateQueries({ queryKey: ["titoli-cassa-mese"] });
      queryClient.invalidateQueries({ queryKey: ["rimessa-dettaglio-used"] });
    },
    onError: (e: any) => toast.error(e.message || "Errore nell'annullamento"),
  });

  const rimesse = rimesseResult?.data || [];
  const rimesseTotalCount = rimesseResult?.count || 0;

  const statoBadge = (s: string) => {
    switch (s) {
      case "pronta": return "default";
      case "inviata": return "secondary";
      case "errore": return "destructive";
      default: return "outline";
    }
  };

  const rows = data || [];
  const totLordo = rows.reduce((s, r) => s + r.lordo, 0);
  const totProvv = rows.reduce((s, r) => s + r.provvigioni, 0);
  const totRimesso = rows.reduce((s, r) => s + r.gia_rimesso, 0);
  const totDaRimettere = totLordo - totProvv - totRimesso;
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const hasFilters = filters.compagnia_id || filters.ufficio_id || filters.produttore_id || filters.periodo_dal || filters.periodo_al;

  const exportCSV = () => {
    const header = "Compagnia,Codice,Località,Mail,Lordo,Provvigioni,Già Rimesso,Da Rimettere\n";
    const csv = rows.map((r) => `"${r.nome}","${r.codice}","${r.comune}","${r.mail}",${r.lordo.toFixed(2)},${r.provvigioni.toFixed(2)},${r.gia_rimesso.toFixed(2)},${(r.lordo - r.provvigioni - r.gia_rimesso).toFixed(2)}`).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ec_compagnia.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    { label: "N. Compagnie", value: rows.length.toString(), icon: Building2, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "Totale Lordo", value: fmt(totLordo), icon: TrendingUp, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Totale Provvigioni", value: fmt(totProvv), icon: Percent, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
    { label: "Già Rimesso", value: fmt(totRimesso), icon: Send, color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400" },
    { label: "Da Rimettere", value: fmt(totDaRimettere), icon: Scale, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">E/C Compagnia</h1>
            <p className="text-sm text-muted-foreground">Estratto conto e storico rimesse</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!rows.length}><Download className="mr-2 h-4 w-4" /> Esporta CSV</Button>
      </div>

      <Tabs defaultValue="estratto-conto">
        <TabsList>
          <TabsTrigger value="estratto-conto">Estratto Conto</TabsTrigger>
          <TabsTrigger value="storico-rimesse" className="gap-1.5"><Send className="h-3.5 w-3.5" />Storico Rimesse</TabsTrigger>
        </TabsList>

        <TabsContent value="estratto-conto" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
              <FilterSearchableSelect value={filters.compagnia_id} onValueChange={(v) => set({ compagnia_id: v })} options={(compagnie || []).map((c) => ({ value: c.id, label: c.nome }))} placeholder="Compagnia" allLabel="Tutte le compagnie" className="w-[240px]" />
              <FilterSearchableSelect value={filters.ufficio_id} onValueChange={(v) => set({ ufficio_id: v })} options={(uffici || []).map((u) => ({ value: u.id, label: u.nome_ufficio }))} placeholder="Sede" allLabel="Tutte le sedi" className="w-[200px]" />
              <FilterSearchableSelect value={filters.produttore_id} onValueChange={(v) => set({ produttore_id: v })} options={(produttori || []).map((p) => ({ value: p.id, label: `${p.cognome || ""} ${p.nome || ""}`.trim() }))} placeholder="Produttore" allLabel="Tutti i produttori" className="w-[220px]" />
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Periodo dal</Label><DatePicker value={filters.periodo_dal} onChange={(d) => set({ periodo_dal: d })} placeholder="Dal" /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Periodo al</Label><DatePicker value={filters.periodo_al} onChange={(d) => set({ periodo_al: d })} placeholder="Al" /></div>
            </div>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Compagnia</TableHead><TableHead>Codice</TableHead><TableHead>Località</TableHead>
                <TableHead className="text-right">Lordo</TableHead><TableHead className="text-right">Provvigioni</TableHead>
                <TableHead className="text-right">Già Rimesso</TableHead><TableHead className="text-right">Da Rimettere</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nessun dato — conferma la Messa a Cassa per vedere i dati</TableCell></TableRow>
                ) : rows.map((r) => {
                  const daRimettere = r.lordo - r.provvigioni - r.gia_rimesso;
                  return (
                  <TableRow key={r.compagnia_id}>
                    <TableCell className="font-medium">{r.nome}</TableCell><TableCell>{r.codice}</TableCell><TableCell>{r.comune}</TableCell>
                    <TableCell className="text-right">{fmt(r.lordo)}</TableCell><TableCell className="text-right">{fmt(r.provvigioni)}</TableCell>
                    <TableCell className="text-right text-purple-600 dark:text-purple-400">{fmt(r.gia_rimesso)}</TableCell>
                    <TableCell className="text-right font-semibold text-teal-600 dark:text-teal-400">{fmt(daRimettere)}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
              {rows.length > 0 && <TableFooter><TableRow>
                <TableCell colSpan={3} className="font-bold">Totale</TableCell>
                <TableCell className="text-right font-bold">{fmt(totLordo)}</TableCell><TableCell className="text-right font-bold">{fmt(totProvv)}</TableCell>
                <TableCell className="text-right font-bold text-purple-600 dark:text-purple-400">{fmt(totRimesso)}</TableCell>
                <TableCell className="text-right font-bold text-teal-600 dark:text-teal-400">{fmt(totDaRimettere)}</TableCell>
              </TableRow></TableFooter>}
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="storico-rimesse" className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={filtroStato} onValueChange={(v) => { setFiltroStato(v); setRimessaPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stato" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                {statiRimessa.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-auto">{rimesseTotalCount} rimesse</span>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-right">Importo €</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Creata da</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rimesseLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
                ) : rimesse.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nessuna rimessa archiviata</TableCell></TableRow>
                ) : rimesse.map((r: any) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/rimessa-premi/${r.id}`)}>
                    <TableCell className="font-medium">{r.compagnie?.nome || "—"}</TableCell>
                    <TableCell>{r.uffici?.nome_ufficio || "—"}</TableCell>
                    <TableCell className="text-right font-mono">€ {(r.totale_importi ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.iban_utilizzato || "—"}</TableCell>
                    <TableCell>{r.data_pagamento_rimessa ? format(new Date(r.data_pagamento_rimessa), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell><Badge variant={statoBadge(r.stato)}>{r.stato}</Badge></TableCell>
                    <TableCell>{r.profiles ? `${r.profiles.nome} ${r.profiles.cognome}` : "—"}</TableCell>
                    <TableCell>{r.data_creazione ? format(new Date(r.data_creazione), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Annullare la rimessa per ${r.compagnie?.nome || "questa compagnia"}? I titoli torneranno nel riepilogo.`)) {
                            revertMutation.mutate(r.id);
                          }
                        }}
                        disabled={revertMutation.isPending}
                      >
                        <Undo2 className="w-3 h-3 mr-1" />Annulla
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ServerPagination page={rimessaPage} pageSize={PAGE_SIZE} totalCount={rimesseTotalCount} onPageChange={setRimessaPage} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ECCompagniaContabPage;
