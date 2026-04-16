import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Download, Building2, TrendingUp, Percent, Scale, Filter, RotateCcw, Send, PackagePlus } from "lucide-react";
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
}

const defaultFilters: Filters = {
  compagnia_id: null, ufficio_id: null, produttore_id: null, periodo_dal: null, periodo_al: null,
};

const ECCompagniaContabPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters });
  const set = (partial: Partial<Filters>) => setFilters((f) => ({ ...f, ...partial }));

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

  const creaRimessaMutation = useMutation({
    mutationFn: async (compagniaId: string) => {
      const { data, error } = await supabase.functions.invoke("gestione-rimessa", {
        body: {
          action: "crea",
          compagnia_id: compagniaId,
          ufficio_id: profile?.ufficio_id || null,
          created_by: user?.id || null,
          data_da: filters.periodo_dal ? format(filters.periodo_dal, "yyyy-MM-dd") : undefined,
          data_a: filters.periodo_al ? format(filters.periodo_al, "yyyy-MM-dd") : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ec-compagnia-contab"] });
      queryClient.invalidateQueries({ queryKey: ["rimessa_premi"] });
      toast.success(`Rimessa creata — ${data.titoli_count} titoli inclusi`, {
        action: {
          label: "Vedi Storico",
          onClick: () => navigate("/rimessa-premi"),
        },
      });
    },
    onError: (e: any) => toast.error(e.message || "Errore nella creazione della rimessa"),
  });

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
            <p className="text-sm text-muted-foreground">Estratto conto per compagnia</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!rows.length}><Download className="mr-2 h-4 w-4" /> Esporta CSV</Button>
      </div>

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
            <TableHead className="w-[120px]">Azioni</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nessun dato — conferma la Messa a Cassa per vedere i dati</TableCell></TableRow>
            ) : rows.map((r) => {
              const daRimettere = r.lordo - r.provvigioni - r.gia_rimesso;
              return (
              <TableRow key={r.compagnia_id}>
                <TableCell className="font-medium">{r.nome}</TableCell><TableCell>{r.codice}</TableCell><TableCell>{r.comune}</TableCell>
                <TableCell className="text-right">{fmt(r.lordo)}</TableCell><TableCell className="text-right">{fmt(r.provvigioni)}</TableCell>
                <TableCell className="text-right text-purple-600 dark:text-purple-400">{fmt(r.gia_rimesso)}</TableCell>
                <TableCell className="text-right font-semibold text-teal-600 dark:text-teal-400">{fmt(daRimettere)}</TableCell>
                <TableCell>
                  {daRimettere > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      disabled={creaRimessaMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Creare rimessa per ${r.nome}?`)) {
                          creaRimessaMutation.mutate(r.compagnia_id);
                        }
                      }}
                    >
                      <PackagePlus className="h-3 w-3" />
                      Crea Rimessa
                    </Button>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
          {rows.length > 0 && <TableFooter><TableRow>
            <TableCell colSpan={3} className="font-bold">Totale</TableCell>
            <TableCell className="text-right font-bold">{fmt(totLordo)}</TableCell><TableCell className="text-right font-bold">{fmt(totProvv)}</TableCell>
            <TableCell className="text-right font-bold text-purple-600 dark:text-purple-400">{fmt(totRimesso)}</TableCell>
            <TableCell className="text-right font-bold text-teal-600 dark:text-teal-400">{fmt(totDaRimettere)}</TableCell>
            <TableCell></TableCell>
          </TableRow></TableFooter>}
        </Table>
      </div>
    </div>
  );
};

export default ECCompagniaContabPage;
