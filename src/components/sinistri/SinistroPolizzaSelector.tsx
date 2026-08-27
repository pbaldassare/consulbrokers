import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { fetchPolizzeForCliente, type TitoloRow } from "@/lib/polizzeSearch";
import {
  formatPolizzaOptionDescription,
  formatPolizzaProdotto,
} from "@/lib/titoliDisplay";
import { formatEdgeFunctionError } from "@/lib/edgeFunctionError";

interface Props {
  sinistroId: string;
  clienteId: string | null | undefined;
  currentTitoloId?: string | null;
  onSaved: () => void;
  /** Se true, salva subito alla selezione; altrimenti espone solo onChange locale */
  autoSave?: boolean;
  value?: string;
  onValueChange?: (titoloId: string) => void;
  disabled?: boolean;
  showSaveButton?: boolean;
}

export default function SinistroPolizzaSelector({
  sinistroId,
  clienteId,
  currentTitoloId,
  onSaved,
  autoSave = false,
  value,
  onValueChange,
  disabled = false,
  showSaveButton = false,
}: Props) {
  const [polizzeList, setPolizzeList] = useState<TitoloRow[]>([]);
  const [polizzeLoading, setPolizzeLoading] = useState(false);
  const [soloMadri, setSoloMadri] = useState(true);
  const [polizzaSearchText, setPolizzaSearchText] = useState("");
  const [selectedId, setSelectedId] = useState(currentTitoloId ?? "");
  const [saving, setSaving] = useState(false);

  const effectiveValue = value ?? selectedId;

  const loadPolizze = useCallback(async (soloMadriFlag: boolean) => {
    if (!clienteId) {
      setPolizzeList([]);
      return;
    }
    setPolizzeLoading(true);
    try {
      const merged = await fetchPolizzeForCliente(clienteId, { soloMadri: soloMadriFlag });
      setPolizzeList(merged);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore caricamento polizze";
      toast.error(msg);
    } finally {
      setPolizzeLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    setSelectedId(currentTitoloId ?? "");
  }, [currentTitoloId]);

  useEffect(() => {
    loadPolizze(soloMadri);
  }, [loadPolizze, soloMadri]);

  const saveTitolo = async (titoloId: string) => {
    const titoloIdEff =
      titoloId && !titoloId.startsWith("cga:") ? titoloId : null;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("gestione-sinistri", {
        body: {
          azione: "aggiorna",
          sinistro_id: sinistroId,
          user_id: user?.id,
          titolo_id: titoloIdEff,
        },
      });
      if (error || !data?.success) {
        throw new Error(formatEdgeFunctionError(error, data));
      }
      toast.success("Polizza collegata aggiornata");
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore aggiornamento polizza";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = async (val: string) => {
    setSelectedId(val);
    onValueChange?.(val);
    if (autoSave && val !== (currentTitoloId ?? "")) {
      await saveTitolo(val);
    }
  };

  if (!clienteId) {
    return (
      <p className="text-xs text-muted-foreground">
        Nessun cliente collegato: impossibile selezionare una polizza.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs">
          Polizza del cliente {polizzeLoading && <span className="text-muted-foreground">(caricamento…)</span>}
        </Label>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <Checkbox
            checked={soloMadri}
            disabled={disabled || saving}
            onCheckedChange={(c) => setSoloMadri(!!c)}
          />
          <span>{soloMadri ? "Solo madri" : "Tutte le polizze"}</span>
        </label>
      </div>
      {polizzeList.length === 0 && !polizzeLoading ? (
        <p className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
          Nessuna polizza trovata per questo cliente.
        </p>
      ) : (
        <SearchableSelect
          options={polizzeList.map((p) => ({
            value: p.id,
            label: `${p.numero_titolo}${p.sostituisce_polizza ? " (quietanza)" : ""}`,
            description: formatPolizzaOptionDescription(p as Record<string, any>),
            searchText: `${p.numero_titolo} ${formatPolizzaProdotto(p as Record<string, any>)} ${(p as TitoloRow & { stato?: string }).stato || ""}`,
          }))}
          value={effectiveValue}
          onValueChange={handleChange}
          placeholder="Seleziona una polizza…"
          searchValue={polizzaSearchText}
          onSearchChange={setPolizzaSearchText}
          clearable
          clearLabel="— Nessuna polizza —"
          className="w-full"
          disabled={disabled || saving}
        />
      )}
      {showSaveButton && effectiveValue !== (currentTitoloId ?? "") && (
        <Button
          type="button"
          size="sm"
          disabled={saving || disabled}
          onClick={() => saveTitolo(effectiveValue)}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Salva polizza
        </Button>
      )}
    </div>
  );
}
