import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Button } from "@/components/ui/button";
import {
  NuovaControparteSinistroDialog,
  type ControparteSinistroRow,
} from "@/components/sinistri/NuovaControparteSinistroDialog";

type Props = {
  valueId: string;
  valueLabel: string;
  onChange: (next: { id: string; denominazione: string }) => void;
  onClear?: () => void;
  disabled?: boolean;
};

function parseRpc(data: unknown): ControparteSinistroRow[] {
  const payload = data as { data?: ControparteSinistroRow[] } | null;
  return payload?.data ?? [];
}

export default function ControparteSinistroSelect({
  valueId,
  valueLabel,
  onChange,
  onClear,
  disabled,
}: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: selectedRow } = useQuery({
    queryKey: ["controparte-sinistro", valueId],
    enabled: Boolean(valueId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controparti_sinistri")
        .select("*")
        .eq("id", valueId)
        .maybeSingle();
      if (error) throw error;
      return data as ControparteSinistroRow | null;
    },
  });

  const { data: searchRows = [], isFetching } = useQuery({
    queryKey: ["controparti-sinistri-search", debounced],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_controparti_sinistri_ranked", {
        p_search: debounced.trim(),
        p_limit: 25,
        p_offset: 0,
      });
      if (error) throw error;
      return parseRpc(data);
    },
  });

  const options = useMemo(() => {
    const map = new Map<string, ControparteSinistroRow>();
    if (selectedRow) map.set(selectedRow.id, selectedRow);
    for (const r of searchRows) map.set(r.id, r);
    if (valueId && valueLabel && !map.has(valueId)) {
      map.set(valueId, {
        id: valueId,
        codice: 0,
        denominazione: valueLabel,
        email: null,
        pec: null,
        telefono: null,
        cellulare: null,
        note: null,
        attivo: true,
      });
    }
    return [...map.values()]
      .sort((a, b) => a.denominazione.localeCompare(b.denominazione, "it"))
      .map((r) => ({
        value: r.id,
        label: r.denominazione,
        description: [r.email, r.telefono].filter(Boolean).join(" · ") || undefined,
        searchText: `${r.codice} ${r.email ?? ""} ${r.pec ?? ""} ${r.telefono ?? ""} ${r.cellulare ?? ""}`,
      }));
  }, [searchRows, selectedRow, valueId, valueLabel]);

  return (
    <div className="space-y-2">
      <SearchableSelect
        options={options}
        value={valueId}
        onValueChange={(id) => {
          if (!id) {
            onClear?.();
            return;
          }
          const row = options.find((o) => o.value === id);
          if (row) onChange({ id, denominazione: row.label });
        }}
        placeholder="Cerca controparte in anagrafica..."
        emptyText={isFetching ? "Ricerca..." : "Nessuna controparte trovata"}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Nome, email, telefono..."
        serverSideSearch
        clearable
        clearLabel="— Nessuna controparte —"
        disabled={disabled}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={disabled}
        onClick={() => setCreateOpen(true)}
      >
        <Plus className="w-4 h-4 mr-2" />
        Crea nuova controparte
      </Button>
      <NuovaControparteSinistroDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        trigger={<span className="hidden" />}
        onSaved={(row) => {
          queryClient.invalidateQueries({ queryKey: ["controparti-sinistri"] });
          queryClient.invalidateQueries({ queryKey: ["controparti-sinistri-search"] });
          onChange({ id: row.id, denominazione: row.denominazione });
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
