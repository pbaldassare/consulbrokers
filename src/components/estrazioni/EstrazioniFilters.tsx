import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Filter, RotateCcw } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface EstrazioniFiltersState {
  period: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  ufficio_id: string | null;
  produttore_id: string | null;
  compagnia_id: string | null;
  cliente_id: string | null;
}

interface EstrazioniFiltersProps {
  filters: EstrazioniFiltersState;
  onChange: (filters: EstrazioniFiltersState) => void;
  showUfficio?: boolean;
  showProduttore?: boolean;
  showCompagnia?: boolean;
  showCliente?: boolean;
}

export const defaultFilters: EstrazioniFiltersState = {
  period: "all",
  dateFrom: null,
  dateTo: null,
  ufficio_id: null,
  produttore_id: null,
  compagnia_id: null,
  cliente_id: null,
};

export function getDateRange(period: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (period) {
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last_3_months":
      return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
    case "last_6_months":
      return { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) };
    case "this_year":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "all":
      return { from: null, to: null };
    default:
      return { from: null, to: null };
  }
}

const EstrazioniFilters = ({
  filters,
  onChange,
  showUfficio = true,
  showProduttore = false,
  showCompagnia = false,
  showCliente = false,
}: EstrazioniFiltersProps) => {
  const { data: uffici } = useQuery({
    queryKey: ["uffici-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
    enabled: showUfficio,
  });

  const { data: produttori } = useQuery({
    queryKey: ["produttori-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      return data || [];
    },
    enabled: showProduttore,
  });

  const { data: compagnie } = useQuery({
    queryKey: ["compagnie-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
    enabled: showCompagnia,
  });

  const { data: clienti } = useQuery({
    queryKey: ["clienti-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("clienti").select("id, cognome, nome, ragione_sociale").eq("attivo", true).order("cognome");
      return data || [];
    },
    enabled: showCliente,
  });

  const handlePeriodChange = (val: string) => {
    if (val === "custom") {
      onChange({ ...filters, period: val });
    } else {
      const range = getDateRange(val);
      onChange({ ...filters, period: val, dateFrom: range.from, dateTo: range.to });
    }
  };

  const isCustom = filters.period === "custom";
  const hasFilters = filters.period !== "all" || filters.ufficio_id || filters.produttore_id || filters.compagnia_id || filters.cliente_id;

  return (
    <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filtri</span>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => onChange({ ...defaultFilters })}>
            <RotateCcw className="h-3 w-3 mr-1" /> Azzera
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Periodo */}
        <Select value={filters.period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[180px] bg-background">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutto</SelectItem>
            <SelectItem value="this_month">Questo mese</SelectItem>
            <SelectItem value="last_3_months">Ultimi 3 mesi</SelectItem>
            <SelectItem value="last_6_months">Ultimi 6 mesi</SelectItem>
            <SelectItem value="this_year">Quest'anno</SelectItem>
            <SelectItem value="custom">Personalizzato</SelectItem>
          </SelectContent>
        </Select>

        {/* Date personalizzate */}
        {isCustom && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !filters.dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy") : "Da"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filters.dateFrom || undefined} onSelect={(d) => onChange({ ...filters, dateFrom: d || null })} className="p-3 pointer-events-auto" locale={it} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !filters.dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy") : "A"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filters.dateTo || undefined} onSelect={(d) => onChange({ ...filters, dateTo: d || null })} className="p-3 pointer-events-auto" locale={it} />
              </PopoverContent>
            </Popover>
          </>
        )}

        {/* Ufficio */}
        {showUfficio && (
          <Select value={filters.ufficio_id || "all"} onValueChange={(v) => onChange({ ...filters, ufficio_id: v === "all" ? null : v })}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Ufficio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli uffici</SelectItem>
              {(uffici || []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Produttore */}
        {showProduttore && (
          <Select value={filters.produttore_id || "all"} onValueChange={(v) => onChange({ ...filters, produttore_id: v === "all" ? null : v })}>
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue placeholder="Produttore / A.E." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i produttori</SelectItem>
              {(produttori || []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.cognome} {p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Compagnia */}
        {showCompagnia && (
          <Select value={filters.compagnia_id || "all"} onValueChange={(v) => onChange({ ...filters, compagnia_id: v === "all" ? null : v })}>
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue placeholder="Compagnia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le compagnie</SelectItem>
              {(compagnie || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Cliente */}
        {showCliente && (
          <Select value={filters.cliente_id || "all"} onValueChange={(v) => onChange({ ...filters, cliente_id: v === "all" ? null : v })}>
            <SelectTrigger className="w-[220px] bg-background">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i clienti</SelectItem>
              {(clienti || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
};

export default EstrazioniFilters;
