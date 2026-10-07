import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  TitoloImportiPremiBlock,
  type TitoloImportiPremiBlockHandle,
  type TitoloImportiPremiDisplayTotals,
} from "@/components/polizze/TitoloImportiPremiBlock";
import { aeCoincideConProduttore } from "@/lib/ruoliAnagrafica";
import { fmtEuro } from "@/lib/formatCurrency";
import { eliminaNuovaQuietanza } from "@/lib/copiaDatiQuietanzaDb";

type Split = { anagrafica_commerciale_id: string | null; commerciale_user_id: string | null; percentuale: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Secondo passo di "Nuova quietanza": la quietanza esiste già (copiata dalla madre)
 * e qui si modificano garanzie, accessori, tasse, provvigioni e produttori come nella scheda della quietanza.
 * "Annulla" elimina la quietanza appena creata.
 */
export function NuovaQuietanzaDettaglio({
  quietanzaId,
  madreId,
  onSalvata,
  onAnnullata,
}: {
  quietanzaId: string;
  madreId: string;
  onSalvata: () => void;
  onAnnullata: () => void;
}) {
  const premiRef = useRef<TitoloImportiPremiBlockHandle>(null);
  const [draft, setDraft] = useState(false);
  const [totali, setTotali] = useState<TitoloImportiPremiDisplayTotals | null>(null);
  const [splits, setSplits] = useState<Split[] | null>(null);
  const splitIniziali = useRef("");
  const [busy, setBusy] = useState(false);

  const { data: t } = useQuery({
    queryKey: ["nuova-quietanza", quietanzaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("id, numero_titolo, addizionali, addizionali_quietanza, provvigioni_firma, provvigioni_quietanza, ae_anagrafica_id, ae_nome, percentuale_ae, ramo:rami!titoli_ramo_id_fkey(descrizione, gruppo_ramo_id)")
        .eq("id", quietanzaId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Stessa query (e cache) della scheda titolo
  const { data: anagraficheComm = [] } = useQuery({
    queryKey: ["anagrafiche-commerciali"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, ragione_sociale, cognome, nome, percentuale_base, tipo")
        .eq("attivo", true)
        .overlaps("ruoli", ["corrispondente", "account_executive", "executive", "produttore_sede"])
        .order("ragione_sociale");
      return (data || []).map((a) => ({
        value: a.id,
        label: a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim(),
        percentuale_base: a.percentuale_base ?? 0,
      }));
    },
  });

  useEffect(() => {
    let attivo = true;
    supabase
      .from("titoli_split_commerciali")
      .select("anagrafica_commerciale_id, commerciale_user_id, percentuale")
      .eq("titolo_id", quietanzaId)
      .order("ordine")
      .then(({ data }) => {
        if (!attivo) return;
        const rows = (data || []).map((s) => ({ ...s, percentuale: Number(s.percentuale) || 0 }));
        splitIniziali.current = JSON.stringify(rows);
        setSplits(rows);
      });
    return () => {
      attivo = false;
    };
  }, [quietanzaId]);

  const provvigioni = totali?.quietanza.provvigioni ?? (Number(t?.provvigioni_quietanza) || 0);
  const righe = splits ?? [];
  const aePerc =
    t?.ae_anagrafica_id && !aeCoincideConProduttore(t.ae_anagrafica_id, righe.map((s) => s.anagrafica_commerciale_id))
      ? Number(t.percentuale_ae) || 0
      : 0;
  const sommaPerc = righe.reduce((s, r) => s + (Number(r.percentuale) || 0), 0) + aePerc;
  const setRiga = (i: number, patch: Partial<Split>) =>
    setSplits((p) => (p || []).map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const salva = async () => {
    const puliti = righe.filter((s) => s.anagrafica_commerciale_id && s.percentuale > 0);
    if (sommaPerc > 100.001) return toast.error(`Le percentuali dei produttori superano il 100% (${round2(sommaPerc)}%).`);
    if (new Set(puliti.map((s) => s.anagrafica_commerciale_id)).size !== puliti.length) {
      return toast.error("Produttore inserito due volte.");
    }
    setBusy(true);
    try {
      if (draft) await premiRef.current?.saveDraft();

      if (JSON.stringify(righe) !== splitIniziali.current) {
        const del = await supabase.from("titoli_split_commerciali").delete().eq("titolo_id", quietanzaId);
        if (del.error) throw del.error;
        if (puliti.length) {
          const ins = await supabase.from("titoli_split_commerciali").insert(
            puliti.map((s, ordine) => ({ ...s, titolo_id: quietanzaId, ordine })),
          );
          if (ins.error) throw ins.error;
        }
        const p = puliti[0];
        const upd = await supabase
          .from("titoli")
          .update({
            anagrafica_commerciale_id: p?.anagrafica_commerciale_id ?? null,
            commerciale_id: p?.commerciale_user_id ?? null,
            percentuale_commerciale: p?.percentuale ?? null,
            produttore_nome: anagraficheComm.find((a) => a.value === p?.anagrafica_commerciale_id)?.label ?? null,
            // Diverso dalla madre: non riallinearlo ai prossimi aggiornamenti della polizza
            split_personalizzato: true,
          })
          .eq("id", quietanzaId);
        if (upd.error) throw upd.error;
      }
      toast.success("Quietanza creata");
      onSalvata();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore nel salvataggio della quietanza");
    } finally {
      setBusy(false);
    }
  };

  const annulla = async () => {
    setBusy(true);
    try {
      await eliminaNuovaQuietanza(quietanzaId);
      toast.info("Creazione annullata");
      onAnnullata();
    } catch (e) {
      toast.error("Non è stato possibile annullare: elimina la quietanza dalla sua scheda", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  // Callback stabile: il blocco premi la richiama a ogni cambio della funzione (con una nuova a ogni render = ciclo infinito)
  const onTotali = useCallback((tot: TitoloImportiPremiDisplayTotals) => {
    setTotali(tot);
    // Il blocco carica le righe solo fuori dalla modalità modifica: si attiva dopo il caricamento
    if (tot.quietanza.hasRows) setDraft(true);
  }, []);

  if (!t || !splits) {
    return (
      <p className="flex items-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparazione della quietanza…
      </p>
    );
  }
  const ramo = t.ramo as { descrizione?: string | null; gruppo_ramo_id?: string | null } | null;

  return (
    <>
      <div className="min-w-0 space-y-6">
        <section className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold">Garanzie, accessori e provvigioni</h3>
          <TitoloImportiPremiBlock
            ref={premiRef}
            titoloId={quietanzaId}
            gruppoRamoId={ramo?.gruppo_ramo_id || null}
            ramoDescrizione={ramo?.descrizione || null}
            isLocked={false}
            draftMode={draft}
            showQuietanza
            hideFirma
            fallbackPremiTitoloId={madreId}
            addizionaliFirma={t.addizionali}
            addizionaliQuietanza={t.addizionali_quietanza}
            provvigioniFirma={t.provvigioni_firma}
            provvigioniQuietanza={t.provvigioni_quietanza}
            onDisplayTotalsChange={onTotali}
          />
          {!draft && (
            <Button size="sm" variant="outline" onClick={() => setDraft(true)}>
              Inserisci garanzie
            </Button>
          )}
        </section>

        <section className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold">Produttori</h3>
          <p className="text-xs text-muted-foreground">
            Provvigioni della rata: <strong>{fmtEuro(provvigioni)}</strong>. La % è la quota di provvigione di ciascun produttore.
          </p>
          {righe.map((r, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-md border p-2">
              <div className="col-span-12 md:col-span-6">
                <Label className="text-[11px]">Produttore</Label>
                <SearchableSelect
                  options={anagraficheComm}
                  value={r.anagrafica_commerciale_id || ""}
                  onValueChange={(v) => {
                    const a = anagraficheComm.find((x) => x.value === v);
                    setRiga(i, { anagrafica_commerciale_id: v || null, percentuale: r.percentuale > 0 ? r.percentuale : Number(a?.percentuale_base) || 0 });
                  }}
                  placeholder="Seleziona produttore..."
                />
              </div>
              <div className="col-span-5 md:col-span-2">
                <Label className="text-[11px]">% provvigione</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={r.percentuale}
                  onChange={(e) => setRiga(i, { percentuale: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="col-span-5 md:col-span-3">
                <Label className="text-[11px]">Importo provvigione</Label>
                <p className="flex h-10 items-center text-sm font-medium">{fmtEuro(round2((provvigioni * r.percentuale) / 100))}</p>
              </div>
              <div className="col-span-2 md:col-span-1 flex justify-end">
                <Button size="icon" variant="ghost" aria-label="Rimuovi produttore" onClick={() => setSplits(righe.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {t.ae_nome && aePerc > 0 && (
            <p className="text-xs text-muted-foreground">
              Account Executive (dalla polizza): {t.ae_nome} · {aePerc}% · {fmtEuro(round2((provvigioni * aePerc) / 100))}
            </p>
          )}
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setSplits([...righe, { anagrafica_commerciale_id: null, commerciale_user_id: null, percentuale: 0 }])}
            >
              <Plus className="h-4 w-4" /> Aggiungi produttore
            </Button>
            <span className={`text-xs ${sommaPerc > 100.001 ? "text-destructive" : "text-muted-foreground"}`}>
              Consulbrokers: {round2(Math.max(0, 100 - sommaPerc))}% · {fmtEuro(round2((provvigioni * Math.max(0, 100 - sommaPerc)) / 100))}
            </span>
          </div>
        </section>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={annulla} disabled={busy}>Annulla</Button>
        <Button onClick={salva} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salva quietanza
        </Button>
      </DialogFooter>
    </>
  );
}
