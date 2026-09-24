import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { Input } from "@/components/ui/input";
import { RcaVeicoliTable } from "@/components/rca/RcaVeicoliTable";
import { fetchRcaClientela } from "@/lib/rca/fetchClientela";
import { filterRcaClientelaRows, type RcaClientelaFiltroTipo } from "@/lib/rca/clientela";
import { filterRcaScadenze, sortRcaByScadenza, type FinestraScadenzaRca } from "@/lib/rca/scadenze";

const FILTRI_TIPO: { value: RcaClientelaFiltroTipo; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "auto", label: "Auto" },
  { value: "autocarro", label: "Autocarro" },
];

const FINESTRE: { value: FinestraScadenzaRca; label: string }[] = [
  { value: "scadute", label: "Scadute" },
  { value: "30", label: "30 giorni" },
  { value: "60", label: "60 giorni" },
  { value: "90", label: "90 giorni" },
  { value: "tutte", label: "Tutte" },
];

export default function RcaScadenzePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tipo, setTipo] = useState<RcaClientelaFiltroTipo>("tutti");
  const [finestra, setFinestra] = useState<FinestraScadenzaRca>("30");
  const { page, setPage, pageSize, range } = useServerPagination(25, [debounced, tipo, finestra]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["rca-clientela"],
    queryFn: fetchRcaClientela,
  });

  const filtered = useMemo(() => {
    const byTipo = filterRcaClientelaRows(data, { search: debounced, tipo });
    return sortRcaByScadenza(filterRcaScadenze(byTipo, { finestra, today }));
  }, [data, debounced, tipo, finestra, today]);
  const pageRows = filtered.slice(range.from, range.to + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Scadenze RCA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Coda di rinnovo: prima le scadenze più vicine. Da qui parti con la preventivazione.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca targa, cliente o n° polizza…"
            className="pl-8"
          />
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {FINESTRE.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFinestra(f.value)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                finestra === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {FILTRI_TIPO.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTipo(f.value)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                tipo === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} veicoli</span>
      </div>

      <RcaVeicoliTable
        rows={pageRows}
        isLoading={isLoading}
        today={today}
        emptyText="Nessuna scadenza in questa finestra"
      />

      <ServerPagination
        page={page}
        pageSize={pageSize}
        totalCount={filtered.length}
        onPageChange={setPage}
      />
    </div>
  );
}
