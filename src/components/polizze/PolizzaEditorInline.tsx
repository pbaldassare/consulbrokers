import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";

export type PolizzaEditorHandle = {
  /** Salva snapshot pre-evento + applica le modifiche live. Ritorna l'id dello snapshot. */
  commit: (tipoEvento: "sospensione" | "riattivazione" | "sostituzione" | "estinzione") => Promise<string | null>;
  /** True se la polizza è bloccata (incassato + scaduto da >7gg): garanzie read-only */
  isLocked: () => boolean;
};

interface Props {
  titoloId: string;
  /** Mostra blocco "Parametri oggetto" (solo Sostituzione) */
  showOggetto?: boolean;
}

type GaranziaRow = {
  id?: string;
  garanzia: string;
  codice_garanzia: string | null;
  firma: number;
  rata: number;
  imposta_provinciale: number;
  ssn: number;
  lordo_calcolato: number;
  is_rca_principale: boolean;
  ordine: number;
  _dirty?: boolean;
  _new?: boolean;
};

export const PolizzaEditorInline = forwardRef<PolizzaEditorHandle, Props>(({ titoloId, showOggetto = false }, ref) => {
  const [loading, setLoading] = useState(true);
  const [titolo, setTitolo] = useState<any>(null);
  const [veicolo, setVeicolo] = useState<any>(null);
  const [garanzie, setGaranzie] = useState<GaranziaRow[]>([]);
  const [originalGaranzie, setOriginalGaranzie] = useState<GaranziaRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [originalTitolo, setOriginalTitolo] = useState<any>(null);
  const [originalVeicolo, setOriginalVeicolo] = useState<any>(null);

  // Carica dati
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: g }, { data: v }] = await Promise.all([
        supabase.from("titoli").select("*").eq("id", titoloId).maybeSingle(),
        supabase.from("premi_garanzia_polizza").select("*").eq("titolo_id", titoloId).order("ordine"),
        supabase.from("veicoli_polizza").select("*").eq("titolo_id", titoloId).maybeSingle(),
      ]);
      if (cancelled) return;
      setTitolo(t);
      setOriginalTitolo(t);
      setVeicolo(v);
      setOriginalVeicolo(v);
      const rows: GaranziaRow[] = (g || []).map((r: any) => ({
        id: r.id,
        garanzia: r.garanzia || "",
        codice_garanzia: r.codice_garanzia,
        firma: Number(r.firma || 0),
        rata: Number(r.rata || 0),
        imposta_provinciale: Number(r.imposta_provinciale || 0),
        ssn: Number(r.ssn || 0),
        lordo_calcolato: Number(r.lordo_calcolato || 0),
        is_rca_principale: !!r.is_rca_principale,
        ordine: Number(r.ordine || 0),
      }));
      setGaranzie(rows);
      setOriginalGaranzie(rows);
      setDeletedIds([]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [titoloId]);

  // Lock: garanzia_a > 7 gg fa AND stato=incassato
  const isLocked = () => {
    if (!titolo) return false;
    if (titolo.stato !== "incassato") return false;
    if (!titolo.garanzia_a) return false;
    const ga = new Date(titolo.garanzia_a + "T00:00:00").getTime();
    return ga < Date.now() - 7 * 24 * 3600 * 1000;
  };

  const updateGar = (idx: number, patch: Partial<GaranziaRow>) => {
    setGaranzie(prev => prev.map((g, i) => i === idx ? { ...g, ...patch, _dirty: true } : g));
  };
  const addGar = () => {
    setGaranzie(prev => [...prev, {
      garanzia: "", codice_garanzia: null, firma: 0, rata: 0,
      imposta_provinciale: 0, ssn: 0, lordo_calcolato: 0,
      is_rca_principale: false, ordine: prev.length + 1, _new: true, _dirty: true,
    }]);
  };
  const removeGar = (idx: number) => {
    setGaranzie(prev => {
      const row = prev[idx];
      if (row.id) setDeletedIds(d => [...d, row.id!]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const totaleLordo = garanzie.reduce((s, g) => s + Number(g.lordo_calcolato || 0), 0);

  useImperativeHandle(ref, () => ({
    isLocked,
    commit: async (tipoEvento) => {
      if (!titolo) throw new Error("Polizza non caricata");
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Snapshot pre-evento
      const payload = {
        titolo: originalTitolo,
        garanzie: originalGaranzie,
        veicolo: originalVeicolo,
      };
      const { data: snap, error: snapErr } = await supabase
        .from("titoli_eventi_snapshot")
        .insert({
          titolo_id: titoloId,
          tipo_evento: tipoEvento,
          payload_jsonb: payload as any,
          created_by: user?.id || null,
        } as any)
        .select("id")
        .single();
      if (snapErr) throw snapErr;

      // 2. Applica modifiche titolo (date + premio_lordo se cambiato)
      const titoloPatch: any = {};
      if (titolo.garanzia_da !== originalTitolo.garanzia_da) titoloPatch.garanzia_da = titolo.garanzia_da;
      if (titolo.garanzia_a !== originalTitolo.garanzia_a) titoloPatch.garanzia_a = titolo.garanzia_a;
      if (titolo.data_scadenza !== originalTitolo.data_scadenza) titoloPatch.data_scadenza = titolo.data_scadenza;
      if (titolo.descrizione_polizza !== originalTitolo.descrizione_polizza) titoloPatch.descrizione_polizza = titolo.descrizione_polizza;
      // Ricalcola premio_lordo da somma garanzie se garanzie sono state modificate
      const garanzieChanged = garanzie.some(g => g._dirty || g._new) || deletedIds.length > 0;
      if (garanzieChanged && !isLocked()) {
        titoloPatch.premio_lordo = totaleLordo;
      }
      if (Object.keys(titoloPatch).length > 0) {
        const { error } = await supabase.from("titoli").update(titoloPatch).eq("id", titoloId);
        if (error) throw error;
      }

      // 3. Applica garanzie (skip se locked)
      if (!isLocked()) {
        if (deletedIds.length > 0) {
          const { error } = await supabase.from("premi_garanzia_polizza").delete().in("id", deletedIds);
          if (error) throw error;
        }
        const toUpsert = garanzie.filter(g => g._dirty || g._new).map(g => ({
          id: g.id,
          titolo_id: titoloId,
          garanzia: g.garanzia,
          codice_garanzia: g.codice_garanzia,
          firma: g.firma,
          rata: g.rata,
          imposta_provinciale: g.imposta_provinciale,
          ssn: g.ssn,
          lordo_calcolato: g.lordo_calcolato,
          is_rca_principale: g.is_rca_principale,
          ordine: g.ordine,
          tipo_premio: "rata",
        }));
        if (toUpsert.length > 0) {
          const { error } = await supabase.from("premi_garanzia_polizza").upsert(toUpsert as any);
          if (error) throw error;
        }
      } else if (garanzieChanged) {
        toast.warning("Premi non modificabili (polizza chiusa/incassata): le modifiche alle garanzie sono state ignorate.");
      }

      // 4. Veicolo (solo se sostituzione + cambi reali)
      if (showOggetto && veicolo?.id && originalVeicolo) {
        const veicPatch: any = {};
        ["targa", "marca", "modello", "telaio"].forEach(k => {
          if (veicolo[k] !== originalVeicolo[k]) veicPatch[k] = veicolo[k] || null;
        });
        if (Object.keys(veicPatch).length > 0) {
          const { error } = await supabase.from("veicoli_polizza").update(veicPatch).eq("id", veicolo.id);
          if (error) throw error;
        }
      }

      return snap?.id || null;
    },
  }), [titolo, originalTitolo, garanzie, originalGaranzie, deletedIds, veicolo, originalVeicolo, showOggetto, titoloId, totaleLordo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 border rounded-md bg-muted/30">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!titolo) {
    return <div className="text-sm text-muted-foreground border rounded-md p-3">Polizza non trovata</div>;
  }

  const locked = isLocked();

  return (
    <div className="border rounded-md p-3 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Snapshot polizza (modificabile)</div>
        {locked && (
          <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
            <Lock className="w-3 h-3" /> Premi bloccati (chiusa/incassata)
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Effetto</Label>
          <Input
            type="date"
            value={titolo.garanzia_da || ""}
            onChange={(e) => setTitolo({ ...titolo, garanzia_da: e.target.value })}
            className="h-8 text-sm tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Scadenza copertura</Label>
          <Input
            type="date"
            value={titolo.garanzia_a || ""}
            onChange={(e) => setTitolo({ ...titolo, garanzia_a: e.target.value })}
            className="h-8 text-sm tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Scadenza polizza</Label>
          <Input
            type="date"
            value={titolo.data_scadenza || ""}
            onChange={(e) => setTitolo({ ...titolo, data_scadenza: e.target.value })}
            className="h-8 text-sm tabular-nums"
          />
        </div>
      </div>

      {showOggetto && (
        <div className="space-y-2 border-t pt-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Oggetto assicurato</div>
          {veicolo ? (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Targa" value={veicolo.targa || ""}
                onChange={(e) => setVeicolo({ ...veicolo, targa: e.target.value.toUpperCase() })}
                className="h-8 text-sm" />
              <Input placeholder="Telaio" value={veicolo.telaio || ""}
                onChange={(e) => setVeicolo({ ...veicolo, telaio: e.target.value.toUpperCase() })}
                className="h-8 text-sm" />
              <Input placeholder="Marca" value={veicolo.marca || ""}
                onChange={(e) => setVeicolo({ ...veicolo, marca: e.target.value })}
                className="h-8 text-sm" />
              <Input placeholder="Modello" value={veicolo.modello || ""}
                onChange={(e) => setVeicolo({ ...veicolo, modello: e.target.value })}
                className="h-8 text-sm" />
            </div>
          ) : (
            <Input placeholder="Descrizione oggetto"
              value={titolo.descrizione_polizza || ""}
              onChange={(e) => setTitolo({ ...titolo, descrizione_polizza: e.target.value })}
              className="h-8 text-sm" />
          )}
        </div>
      )}

      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Garanzie</div>
          {!locked && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addGar}>
              <Plus className="w-3 h-3 mr-1" /> Aggiungi
            </Button>
          )}
        </div>
        {garanzie.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-2">Nessuna garanzia</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left font-medium py-1 pr-2">Garanzia</th>
                  <th className="text-right font-medium py-1 px-1">Firma</th>
                  <th className="text-right font-medium py-1 px-1">Rata</th>
                  <th className="text-right font-medium py-1 px-1">Imp.Prov.</th>
                  <th className="text-right font-medium py-1 px-1">SSN</th>
                  <th className="text-right font-medium py-1 px-1">Lordo</th>
                  {!locked && <th className="w-8"></th>}
                </tr>
              </thead>
              <tbody>
                {garanzie.map((g, idx) => (
                  <tr key={g.id || `new-${idx}`} className="border-b last:border-0">
                    <td className="py-1 pr-2">
                      <Input value={g.garanzia} disabled={locked}
                        onChange={(e) => updateGar(idx, { garanzia: e.target.value })}
                        className="h-7 text-xs" />
                    </td>
                    {(["firma","rata","imposta_provinciale","ssn","lordo_calcolato"] as const).map(k => (
                      <td key={k} className="py-1 px-1">
                        <Input type="number" step="0.01" value={g[k] as number} disabled={locked}
                          onChange={(e) => updateGar(idx, { [k]: Number(e.target.value) || 0 } as any)}
                          className="h-7 text-xs text-right tabular-nums w-24" />
                      </td>
                    ))}
                    {!locked && (
                      <td className="py-1">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => removeGar(idx)} title="Rimuovi">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td colSpan={5} className="text-right pt-2 pr-2">Totale lordo:</td>
                  <td className="text-right pt-2 px-1 tabular-nums">
                    {totaleLordo.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </td>
                  {!locked && <td></td>}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});

PolizzaEditorInline.displayName = "PolizzaEditorInline";
