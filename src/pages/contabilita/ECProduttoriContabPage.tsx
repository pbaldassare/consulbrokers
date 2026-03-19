import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download, Users, TrendingUp, Percent, CalendarIcon, Check, ChevronsUpDown, Filter, RotateCcw, Printer } from "lucide-react";
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
      <PopoverContent className="w-[280px] p-0" align="start">
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
  produttore_id: string | null;
  tipo_filtro: "con_ec" | "tutti";
  data_limite_incassi: Date | null;
  desc_periodo: string;
  data_ec: Date | null;
  data_valuta: Date | null;
}

const defaultFilters: Filters = {
  produttore_id: null, tipo_filtro: "tutti",
  data_limite_incassi: null, desc_periodo: "", data_ec: null, data_valuta: null,
};

const ECProduttoriContabPage = () => {
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters });
  const set = (partial: Partial<Filters>) => setFilters((f) => ({ ...f, ...partial }));

  const { data: anagrafiche } = useQuery({
    queryKey: ["anagrafiche-produttori-ec"],
    queryFn: async () => {
      const { data } = await supabase.from("anagrafiche_professionali")
        .select("id, codice, cognome, nome, ragione_sociale, citta, fax, email, tipo")
        .in("tipo", ["account_executive", "corrispondente"])
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["ec-produttori-contab", filters],
    queryFn: async () => {
      // Get all provvigioni with titolo data
      const { data: provvigioni, error } = await supabase
        .from("provvigioni_generate")
        .select("user_id, importo_provvigione, titolo_id, titoli!provvigioni_generate_titolo_id_fkey(premio_lordo, data_incasso, produttore_id)");
      if (error) throw error;

      const prods = anagrafiche || [];
      // Build map of profile_id -> anagrafica
      // We need to match produttore_id from titoli to anagrafiche

      const grouped: Record<string, { id: string; codice: string; nome: string; citta: string; fax: string; email: string; lordo: number; provvigioni: number }> = {};

      // Initialize from anagrafiche
      for (const a of prods) {
        if (filters.produttore_id && a.id !== filters.produttore_id) continue;
        grouped[a.id] = {
          id: a.id,
          codice: a.codice || "",
          nome: a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim(),
          citta: a.citta || "",
          fax: a.fax || "",
          email: a.email || "",
          lordo: 0, provvigioni: 0,
        };
      }

      // Aggregate provvigioni by user
      for (const p of provvigioni || []) {
        const tit = p.titoli as any;
        if (!tit) continue;
        if (filters.data_limite_incassi && tit.data_incasso) {
          if (new Date(tit.data_incasso) > filters.data_limite_incassi) continue;
        }
        // Try to match user_id to an anagrafica (simplified)
        if (p.user_id && grouped[p.user_id]) {
          grouped[p.user_id].lordo += Number(tit.premio_lordo) || 0;
          grouped[p.user_id].provvigioni += Number(p.importo_provvigione) || 0;
        }
      }

      let results = Object.values(grouped);
      if (filters.tipo_filtro === "con_ec") {
        results = results.filter(r => r.lordo > 0 || r.provvigioni > 0);
      }
      return results.sort((a, b) => b.lordo - a.lordo);
    },
    enabled: !!anagrafiche,
  });

  const rows = data || [];
  const totLordo = rows.reduce((s, r) => s + r.lordo, 0);
  const totProvv = rows.reduce((s, r) => s + r.provvigioni, 0);
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const hasFilters = filters.produttore_id || filters.tipo_filtro !== "tutti" || filters.data_limite_incassi || filters.desc_periodo;

  const exportCSV = () => {
    const header = "Codice,Produttore,Località,Fax,Mail,Lordo,Provvigioni\n";
    const csv = rows.map((r) => `"${r.codice}","${r.nome}","${r.citta}","${r.fax}","${r.email}",${r.lordo.toFixed(2)},${r.provvigioni.toFixed(2)}`).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ec_produttori.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    { label: "N. Produttori", value: rows.length.toString(), icon: Users, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "Totale Lordo", value: fmt(totLordo), icon: TrendingUp, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Totale Provvigioni", value: fmt(totProvv), icon: Percent, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">E/C Produttori</h1>
            <p className="text-sm text-muted-foreground">Estratto conto produttori — Contabilità</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!rows.length}>
          <Download className="mr-2 h-4 w-4" /> Esporta CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
      <div className="bg-muted/30 border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> <span>Filtri</span>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setFilters({ ...defaultFilters })}>
              <RotateCcw className="h-3 w-3 mr-1" /> Azzera
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Produttori</Label>
            <RadioGroup value={filters.tipo_filtro} onValueChange={(v) => set({ tipo_filtro: v as any })} className="flex gap-4">
              <div className="flex items-center gap-1.5"><RadioGroupItem value="con_ec" id="pf-conec" /><Label htmlFor="pf-conec" className="text-sm">Con E/C</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="tutti" id="pf-tutti" /><Label htmlFor="pf-tutti" className="text-sm">Tutti</Label></div>
            </RadioGroup>
          </div>

          <SearchableSelect value={filters.produttore_id} onValueChange={(v) => set({ produttore_id: v })}
            options={(anagrafiche || []).map((a) => ({ value: a.id, label: a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim() }))}
            placeholder="Produttore" allLabel="Tutti i produttori" className="w-[260px]" />

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Data limite incassi</Label>
            <DatePicker value={filters.data_limite_incassi} onChange={(d) => set({ data_limite_incassi: d })} placeholder="Data limite" />
          </div>
        </div>

        {/* Parametri di Stampa */}
        <div className="border-t pt-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Printer className="h-4 w-4" /> <span>Parametri di Stampa</span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descrizione Periodo</Label>
              <Input value={filters.desc_periodo} onChange={(e) => set({ desc_periodo: e.target.value })}
                placeholder="es. Gennaio 2026" className="w-[200px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data Estratto Conto</Label>
              <DatePicker value={filters.data_ec} onChange={(d) => set({ data_ec: d })} placeholder="Data E/C" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data Valuta</Label>
              <DatePicker value={filters.data_valuta} onChange={(d) => set({ data_valuta: d })} placeholder="Data Valuta" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codice</TableHead>
              <TableHead>Produttore</TableHead>
              <TableHead>Località</TableHead>
              <TableHead>Fax</TableHead>
              <TableHead>Mail</TableHead>
              <TableHead className="text-right">Lordo</TableHead>
              <TableHead className="text-right">Provvigioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nessun dato</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.codice}</TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.citta}</TableCell>
                <TableCell className="text-muted-foreground">{r.fax}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell className="text-right">{fmt(r.lordo)}</TableCell>
                <TableCell className="text-right">{fmt(r.provvigioni)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-bold">Totale</TableCell>
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

export default ECProduttoriContabPage;
