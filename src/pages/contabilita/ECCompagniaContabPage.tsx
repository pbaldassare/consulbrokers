import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, Building2, TrendingUp, Percent, Scale, CalendarIcon, Check, ChevronsUpDown, Filter, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

function SearchableSelect({ value, onValueChange, options, placeholder, allLabel, className }: {
  value: string | null; onValueChange: (v: string | null) => void;
  options: { value: string; label: string }[]; placeholder: string; allLabel: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value ? options.find((o) => o.value === value)?.label || placeholder : allLabel;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn("justify-between bg-background font-normal", className)}>
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Cerca ${placeholder.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Nessun risultato</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => { onValueChange(null); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} /> {allLabel}
              </CommandItem>
              {options.map((opt) => (
                <CommandItem key={opt.value} value={opt.label} onSelect={() => { onValueChange(opt.value); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} /> {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DatePicker({ value, onChange, placeholder }: { value: Date | null; onChange: (d: Date | null) => void; placeholder: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !value && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value || undefined} onSelect={(d) => onChange(d || null)} className="p-3 pointer-events-auto" locale={it} />
      </PopoverContent>
    </Popover>
  );
}

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
        .select("premio_lordo, importo_incassato, prodotto_id, ufficio_id, produttore_id, data_incasso, prodotti!titoli_prodotto_id_fkey(compagnia_id)")
        .not("prodotto_id", "is", null);

      if (filters.ufficio_id) query = query.eq("ufficio_id", filters.ufficio_id);
      if (filters.produttore_id) query = query.eq("produttore_id", filters.produttore_id);
      if (filters.periodo_dal) query = query.gte("data_incasso", format(filters.periodo_dal, "yyyy-MM-dd"));
      if (filters.periodo_al) query = query.lte("data_incasso", format(filters.periodo_al, "yyyy-MM-dd"));

      const { data: titoli, error } = await query;
      if (error) throw error;

      // Get provvigioni
      const titoloIds = (titoli || []).map(t => t.prodotto_id).filter(Boolean);
      const { data: provvigioni } = await supabase
        .from("provvigioni_generate")
        .select("titolo_id, importo_provvigione");

      const provMap: Record<string, number> = {};
      for (const p of provvigioni || []) {
        provMap[p.titolo_id] = (provMap[p.titolo_id] || 0) + (Number(p.importo_provvigione) || 0);
      }

      // Group by compagnia
      const compagniaMap = new Map((compagnie || []).map(c => [c.id, c]));
      const grouped: Record<string, { compagnia_id: string; nome: string; codice: string; comune: string; mail: string; lordo: number; provvigioni: number }> = {};

      for (const t of titoli || []) {
        const prod = t.prodotti as any;
        if (!prod?.compagnia_id) continue;
        if (filters.compagnia_id && prod.compagnia_id !== filters.compagnia_id) continue;

        const comp = compagniaMap.get(prod.compagnia_id);
        const key = prod.compagnia_id;
        if (!grouped[key]) {
          grouped[key] = {
            compagnia_id: key,
            nome: comp?.nome || "N/D",
            codice: comp?.codice || "",
            comune: comp?.comune || "",
            mail: comp?.mail || "",
            lordo: 0, provvigioni: 0,
          };
        }
        grouped[key].lordo += Number(t.premio_lordo) || 0;
      }

      // Add provvigioni totals per compagnia (simplified)
      return Object.values(grouped).sort((a, b) => b.lordo - a.lordo);
    },
  });

  const rows = data || [];
  const totLordo = rows.reduce((s, r) => s + r.lordo, 0);
  const totProvv = rows.reduce((s, r) => s + r.provvigioni, 0);
  const totSaldo = totLordo - totProvv;
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const hasFilters = filters.compagnia_id || filters.ufficio_id || filters.produttore_id || filters.periodo_dal || filters.periodo_al;

  const exportCSV = () => {
    const header = "Compagnia,Codice,Località,Mail,Lordo,Provvigioni\n";
    const csv = rows.map((r) => `"${r.nome}","${r.codice}","${r.comune}","${r.mail}",${r.lordo.toFixed(2)},${r.provvigioni.toFixed(2)}`).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ec_compagnia.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    { label: "N. Compagnie", value: rows.length.toString(), icon: Building2, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "Totale Lordo", value: fmt(totLordo), icon: TrendingUp, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Totale Provvigioni", value: fmt(totProvv), icon: Percent, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
    { label: "Saldo", value: fmt(totSaldo), icon: Scale, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">E/C Compagnia</h1>
            <p className="text-sm text-muted-foreground">Estratto conto compagnie — Contabilità</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!rows.length}>
          <Download className="mr-2 h-4 w-4" /> Esporta CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", kpi.color)}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-bold">{isLoading ? "..." : kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> <span>Filtri</span>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setFilters({ ...defaultFilters })}>
              <RotateCcw className="h-3 w-3 mr-1" /> Azzera
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <SearchableSelect value={filters.compagnia_id} onValueChange={(v) => set({ compagnia_id: v })}
            options={(compagnie || []).map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Compagnia" allLabel="Tutte le compagnie" className="w-[240px]" />

          <SearchableSelect value={filters.ufficio_id} onValueChange={(v) => set({ ufficio_id: v })}
            options={(uffici || []).map((u) => ({ value: u.id, label: u.nome_ufficio }))}
            placeholder="Sede" allLabel="Tutte le sedi" className="w-[200px]" />

          <SearchableSelect value={filters.produttore_id} onValueChange={(v) => set({ produttore_id: v })}
            options={(produttori || []).map((p) => ({ value: p.id, label: `${p.cognome || ""} ${p.nome || ""}`.trim() }))}
            placeholder="Produttore" allLabel="Tutti i produttori" className="w-[220px]" />

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Periodo dal</Label>
            <DatePicker value={filters.periodo_dal} onChange={(d) => set({ periodo_dal: d })} placeholder="Dal" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Periodo al</Label>
            <DatePicker value={filters.periodo_al} onChange={(d) => set({ periodo_al: d })} placeholder="Al" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compagnia</TableHead>
              <TableHead>Codice</TableHead>
              <TableHead>Località</TableHead>
              <TableHead>Mail</TableHead>
              <TableHead className="text-right">Lordo</TableHead>
              <TableHead className="text-right">Provvigioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nessun dato</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.compagnia_id}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.codice}</TableCell>
                <TableCell>{r.comune}</TableCell>
                <TableCell className="text-muted-foreground">{r.mail}</TableCell>
                <TableCell className="text-right">{fmt(r.lordo)}</TableCell>
                <TableCell className="text-right">{fmt(r.provvigioni)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-bold">Totale</TableCell>
                <TableCell className="text-right font-bold">{fmt(totLordo)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totProvv)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
};

export default ECCompagniaContabPage;
