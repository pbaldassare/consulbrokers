import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/SearchableSelect";
import { TIPI_SINISTRO } from "@/lib/tipiSinistro";
import type { SinistriListFilters } from "@/lib/sinistriListSearch";

type ClienteOpt = { id: string; label: string; description?: string };

const STATI = [
  { value: "tutti", label: "Tutti gli stati" },
  { value: "bozza", label: "Bozza" },
  { value: "in_valutazione", label: "in valutazione" },
  { value: "aperto", label: "aperto" },
  { value: "in_lavorazione", label: "in lavorazione" },
  { value: "in_attesa_documenti", label: "in attesa documenti" },
  { value: "in_liquidazione", label: "in liquidazione" },
  { value: "chiuso", label: "chiuso" },
  { value: "respinto", label: "respinto" },
];

type Props = {
  filters: SinistriListFilters;
  onChange: (patch: Partial<SinistriListFilters>) => void;
  onReset: () => void;
  clientiSearch: string;
  onClientiSearch: (q: string) => void;
  clientiOptions: ClienteOpt[];
  clientiLoading: boolean;
  compagnie: { id: string; nome: string }[];
  responsabili: { id: string; nome: string | null; cognome: string | null }[];
};

export function SinistriRicercaForm({
  filters,
  onChange,
  onReset,
  clientiSearch,
  onClientiSearch,
  clientiOptions,
  clientiLoading,
  compagnie,
  responsabili,
}: Props) {
  const clienteOptions = clientiOptions.map((c) => ({
    value: c.id,
    label: c.label,
    description: c.description,
  }));
  if (filters.clienteId && !clienteOptions.some((o) => o.value === filters.clienteId)) {
    clienteOptions.unshift({ value: filters.clienteId, label: filters.clienteLabel || "Cliente selezionato" });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Combina i campi: ogni filtro si aggiunge agli altri (es. cliente + controparte + tipo).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Cliente</Label>
          <SearchableSelect
            options={clienteOptions}
            value={filters.clienteId}
            onValueChange={(id) => {
              const hit = clientiOptions.find((c) => c.id === id);
              onChange({ clienteId: id, clienteLabel: hit?.label || "" });
            }}
            placeholder="Cerca cliente…"
            searchPlaceholder="Digita almeno 2 caratteri…"
            searchValue={clientiSearch}
            onSearchChange={onClientiSearch}
            serverSideSearch
            clearable
            clearLabel="Tutti i clienti"
            emptyText={clientiLoading ? "Ricerca in corso…" : "Nessun cliente trovato."}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Controparte</Label>
          <Input
            value={filters.controparte}
            onChange={(e) => onChange({ controparte: e.target.value })}
            placeholder="Nome controparte…"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <SearchableSelect
            options={TIPI_SINISTRO.map((t) => ({ value: t.value, label: t.label }))}
            value={filters.tipo}
            onValueChange={(tipo) => onChange({ tipo })}
            placeholder="Tutti i tipi"
            searchPlaceholder="Cerca tipo…"
            clearable
            clearLabel="Tutti i tipi"
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">N. sinistro</Label>
          <Input
            value={filters.numero}
            onChange={(e) => onChange({ numero: e.target.value })}
            placeholder="Interno o compagnia…"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">N. polizza</Label>
          <Input
            value={filters.polizza}
            onChange={(e) => onChange({ polizza: e.target.value })}
            placeholder="Numero polizza…"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Stato</Label>
          <SearchableSelect
            options={STATI.filter((s) => s.value !== "tutti")}
            value={filters.stato === "tutti" ? "" : filters.stato}
            onValueChange={(stato) => onChange({ stato: stato || "tutti" })}
            placeholder="Tutti gli stati"
            clearable
            clearLabel="Tutti gli stati"
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Compagnia</Label>
          <SearchableSelect
            options={compagnie.map((c) => ({ value: c.id, label: c.nome }))}
            value={filters.compagniaId === "tutti" ? "" : filters.compagniaId}
            onValueChange={(id) => {
              const nome = compagnie.find((c) => c.id === id)?.nome || "";
              onChange({ compagniaId: id || "tutti", compagniaLabel: nome });
            }}
            placeholder="Tutte le compagnie"
            searchPlaceholder="Cerca compagnia…"
            clearable
            clearLabel="Tutte le compagnie"
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Copertura</Label>
          <SearchableSelect
            options={[
              { value: "con_polizza", label: "Con polizza" },
              { value: "terzi", label: "Sinistro Terzi" },
            ]}
            value={filters.terzi === "tutti" ? "" : filters.terzi}
            onValueChange={(terzi) => onChange({ terzi: terzi || "tutti" })}
            placeholder="Tutti"
            clearable
            clearLabel="Tutti"
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Responsabile interno</Label>
          <SearchableSelect
            options={responsabili.map((r) => ({
              value: r.id,
              label: `${r.cognome || ""} ${r.nome || ""}`.trim(),
            }))}
            value={filters.responsabileId === "tutti" ? "" : filters.responsabileId}
            onValueChange={(id) => {
              const r = responsabili.find((x) => x.id === id);
              onChange({
                responsabileId: id || "tutti",
                responsabileLabel: r ? `${r.cognome || ""} ${r.nome || ""}`.trim() : "",
              });
            }}
            placeholder="Tutti"
            clearable
            clearLabel="Tutti"
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Apertura dal</Label>
          <Input type="date" value={filters.dataDa} onChange={(e) => onChange({ dataDa: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Apertura al</Label>
          <Input type="date" value={filters.dataA} onChange={(e) => onChange({ dataA: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Azzera filtri
        </Button>
      </div>
    </div>
  );
}
