import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Plus, X, Check, ChevronsUpDown, ListPlus, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useGruppiRamo, useRamiAll } from "@/hooks/useRamiLookup";

interface RamoGroupRow {
  gruppo_ramo_id: string;
  all: boolean;
  ramo_ids: string[];
}

interface Props {
  compagniaRapportoId: string;
  onSaved?: () => void;
}

/**
 * Editor manuale per i Rami e Sottorami abilitati su un compagnia_rapporto.
 * Carica da `compagnia_rapporto_rami` e salva con delete + insert.
 */
export default function RamiAbilitatiEditor({ compagniaRapportoId, onSaved }: Props) {
  const qc = useQueryClient();
  const { data: gruppiRamo = [] } = useGruppiRamo();
  const { data: ramiCatalog = [] } = useRamiAll();

  const [rows, setRows] = useState<RamoGroupRow[]>([]);
  const [dirty, setDirty] = useState(false);

  // Carica righe esistenti
  const { data: existing, isLoading } = useQuery({
    queryKey: ["rami-editor-load", compagniaRapportoId],
    enabled: !!compagniaRapportoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnia_rapporto_rami" as any)
        .select("gruppo_ramo_id, ramo_id")
        .eq("rapporto_id", compagniaRapportoId);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  useEffect(() => {
    if (!existing) return;
    // Raggruppa per gruppo_ramo_id, marcando all=true se almeno una riga ha ramo_id NULL
    const byGruppo = new Map<string, RamoGroupRow>();
    for (const r of existing as any[]) {
      const gid = r.gruppo_ramo_id as string;
      if (!byGruppo.has(gid)) byGruppo.set(gid, { gruppo_ramo_id: gid, all: false, ramo_ids: [] });
      const row = byGruppo.get(gid)!;
      if (r.ramo_id == null) row.all = true;
      else row.ramo_ids.push(r.ramo_id);
    }
    setRows(Array.from(byGruppo.values()));
    setDirty(false);
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validazione: almeno una riga con gruppo selezionato; per le righe non-"all" almeno un sottoramo
      const valid = rows.filter((r) => r.gruppo_ramo_id && (r.all || r.ramo_ids.length > 0));
      if (valid.length === 0) throw new Error("Aggiungi almeno un Ramo con 'Tutti i sottorami' o uno specifico sottoramo");

      // Delete + insert
      const { error: delErr } = await supabase
        .from("compagnia_rapporto_rami" as any)
        .delete()
        .eq("rapporto_id", compagniaRapportoId);
      if (delErr) throw delErr;

      const toInsert: any[] = [];
      for (const r of valid) {
        if (r.all) {
          toInsert.push({ rapporto_id: compagniaRapportoId, gruppo_ramo_id: r.gruppo_ramo_id, ramo_id: null });
        } else {
          for (const rid of r.ramo_ids) {
            toInsert.push({ rapporto_id: compagniaRapportoId, gruppo_ramo_id: r.gruppo_ramo_id, ramo_id: rid });
          }
        }
      }
      if (toInsert.length) {
        const { error: insErr } = await supabase
          .from("compagnia_rapporto_rami" as any)
          .insert(toInsert);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      toast.success("Garanzie abilitate aggiornate");
      qc.invalidateQueries({ queryKey: ["rapporto-rami-abilitati"] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporto_rami"] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporto_rami_all"] });
      qc.invalidateQueries({ queryKey: ["rami-editor-load", compagniaRapportoId] });
      setDirty(false);
      onSaved?.();
    },
    onError: (e: any) => toast.error(e.message || "Errore salvataggio"),
  });

  const update = (next: RamoGroupRow[]) => {
    setRows(next);
    setDirty(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-sm font-medium">Rami e Sottorami abilitati</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (rows.length > 0 && !confirm("Sostituire le righe già presenti con TUTTI i rami?")) return;
              update(
                (gruppiRamo as any[]).map((g) => ({ gruppo_ramo_id: g.value, all: true, ramo_ids: [] })),
              );
            }}
          >
            <ListPlus className="w-3.5 h-3.5 mr-1" /> Tutti i Rami
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => update([...rows, { gruppo_ramo_id: "", all: true, ramo_ids: [] }])}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Aggiungi Ramo
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1" />
            )}
            Salva
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground italic">Caricamento…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nessun Ramo abilitato. Clicca "Aggiungi Ramo" oppure "Tutti i Rami" per iniziare, poi salva.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => {
            const sottoCatalog = (ramiCatalog as any[]).filter((r) => r.gruppo_ramo_id === row.gruppo_ramo_id);
            const selectedLabels = row.ramo_ids
              .map((id) => sottoCatalog.find((rr) => rr.value === id)?.descrizione)
              .filter(Boolean) as string[];
            return (
              <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                <SearchableSelect
                  options={(gruppiRamo as any[]).map((g) => ({ value: g.value, label: g.label }))}
                  value={row.gruppo_ramo_id}
                  onValueChange={(v) =>
                    update(rows.map((r, i) => (i === idx ? { gruppo_ramo_id: v, all: true, ramo_ids: [] } : r)))
                  }
                  placeholder="Ramo..."
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      disabled={!row.gruppo_ramo_id}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate text-left">
                        {!row.gruppo_ramo_id
                          ? "Seleziona prima un Ramo"
                          : row.all
                          ? "Tutti i sottorami"
                          : selectedLabels.length === 0
                          ? "Nessun sottoramo"
                          : selectedLabels.length === 1
                          ? selectedLabels[0]
                          : `${selectedLabels.length} selezionati`}
                      </span>
                      <ChevronsUpDown className="w-4 h-4 opacity-50 ml-2 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Cerca sottoramo..." />
                      <CommandList>
                        <CommandEmpty>Nessun sottoramo trovato.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__all__"
                            onSelect={() =>
                              update(
                                rows.map((r, i) => (i === idx ? { ...r, all: !r.all, ramo_ids: [] } : r)),
                              )
                            }
                          >
                            <Checkbox checked={row.all} className="mr-2" />
                            <span className="font-medium">Tutti i sottorami</span>
                          </CommandItem>
                        </CommandGroup>
                        {!row.all && (
                          <CommandGroup>
                            {sottoCatalog.map((rr: any) => {
                              const checked = row.ramo_ids.includes(rr.value);
                              return (
                                <CommandItem
                                  key={rr.value}
                                  value={`${rr.descrizione} ${rr.codice || ""}`}
                                  onSelect={() =>
                                    update(
                                      rows.map((r, i) =>
                                        i === idx
                                          ? {
                                              ...r,
                                              ramo_ids: checked
                                                ? r.ramo_ids.filter((x) => x !== rr.value)
                                                : [...r.ramo_ids, rr.value],
                                            }
                                          : r,
                                      ),
                                    )
                                  }
                                >
                                  <Checkbox checked={checked} className="mr-2" />
                                  <div className="flex flex-col">
                                    <span>{rr.descrizione}</span>
                                    {rr.codice && (
                                      <span className="text-[11px] text-muted-foreground">{rr.codice}</span>
                                    )}
                                  </div>
                                  {checked && <Check className="w-4 h-4 ml-auto opacity-50" />}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <div className="text-[11px] text-muted-foreground min-w-[60px]">
                  {row.all ? "Tutti" : `${row.ramo_ids.length} sel.`}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => update(rows.filter((_, i) => i !== idx))}
                  title="Rimuovi"
                >
                  <X className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {dirty && (
        <p className="text-[11px] text-amber-600">Modifiche non salvate — clicca "Salva" per applicare.</p>
      )}
    </div>
  );
}
