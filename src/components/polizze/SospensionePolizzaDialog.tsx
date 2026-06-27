import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { aggiornaNumeroPolizza } from "@/lib/aggiornaNumeroPolizza";
import {
  buildQuietanzeSnapshot,
  resolveTitoloMadreId,
  selectQuietanzeToFreeze,
} from "@/lib/sospensioneQuietanze";
import { PolizzaEditorInline, type PolizzaEditorHandle } from "./PolizzaEditorInline";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string;
  numeroPolizza?: string;
  onDone?: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const addMonthsISO = (iso: string, months: number) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

const ensureExt = (displayName: string, originalName: string) => {
  const origExt = originalName.includes(".") ? originalName.split(".").pop()!.toLowerCase() : "";
  if (!origExt) return displayName;
  const lower = displayName.toLowerCase();
  return lower.endsWith("." + origExt) ? displayName : `${displayName}.${origExt}`;
};

export const SospensionePolizzaDialog = ({ open, onOpenChange, titoloId, numeroPolizza, onDone }: Props) => {
  const queryClient = useQueryClient();
  const todayISO = new Date().toISOString().slice(0, 10);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<PolizzaEditorHandle>(null);

  const [dataSospensione, setDataSospensione] = useState(todayISO);
  const [limiteRiattivazione, setLimiteRiattivazione] = useState(addMonthsISO(todayISO, 10));
  const [limiteManual, setLimiteManual] = useState(false);
  const [motivo, setMotivo] = useState("Sospensione su richiesta cliente");
  const [oneriSospensione, setOneriSospensione] = useState<string>("0");
  const [nuovoNumeroPolizza, setNuovoNumeroPolizza] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [madreIdForEdit, setMadreIdForEdit] = useState(titoloId);

  const oneriNum = Number((oneriSospensione || "0").replace(",", ".")) || 0;

  useEffect(() => {
    if (open) {
      setDataSospensione(todayISO);
      setLimiteRiattivazione(addMonthsISO(todayISO, 10));
      setLimiteManual(false);
      setMotivo("Sospensione su richiesta cliente");
      setOneriSospensione("0");
      setNuovoNumeroPolizza(numeroPolizza || "");
      setFile(null);
      setDisplayName("");
      if (fileRef.current) fileRef.current.value = "";
      resolveTitoloMadreId(supabase, titoloId).then(setMadreIdForEdit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, titoloId]);

  useEffect(() => {
    if (!limiteManual && dataSospensione) {
      setLimiteRiattivazione(addMonthsISO(dataSospensione, 10));
    }
  }, [dataSospensione, limiteManual]);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      toast.error("Il file supera il limite di 10 MB");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFile(f);
    setDisplayName(f.name);
  };

  const removeFile = () => {
    setFile(null);
    setDisplayName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const sospensioneMutation = useMutation({
    mutationFn: async () => {
      if (!dataSospensione) throw new Error("Data sospensione obbligatoria");
      if (!titoloId) throw new Error("Specificare una polizza");

      const madreId = await resolveTitoloMadreId(supabase, titoloId);

      // 0. Snapshot pre-evento + applica modifiche inline (date / garanzie)
      const snapshotId = await editorRef.current?.commit("sospensione");

      const { data: titoloRow, error: errFetch } = await supabase
        .from("titoli")
        .select("id, numero_titolo, riga, cliente_id, cliente_anagrafica_id, compagnia_id, compagnia_rapporto_id, codice_rapporto, ramo_id, prodotto_id, prodotto_nome, ufficio_id, ae_anagrafica_id, anagrafica_commerciale_id, commerciale_id, percentuale_commerciale, percentuale_riparto, tipo_portafoglio, tipo_mandatario")
        .eq("id", madreId)
        .single();
      if (errFetch) throw errFetch;

      // 1. Congela quietanze future + in corso (non elimina)
      let quietanzeCongelate: string[] = [];
      let quietanzeSnapshot: ReturnType<typeof buildQuietanzeSnapshot> | null = null;
      if (titoloRow?.numero_titolo && titoloRow.riga != null) {
        const { data: allRows } = await supabase
          .from("titoli")
          .select("id, riga, garanzia_da, garanzia_a, premio_lordo, stato, data_messa_cassa, sostituisce_polizza, is_oneri_sospensione, is_oneri_riattivazione")
          .eq("numero_titolo", titoloRow.numero_titolo)
          .not("sostituisce_polizza", "is", null);
        const candidates = (allRows || []).filter(
          (r: any) => !r.is_oneri_sospensione && !r.is_oneri_riattivazione,
        );
        const toFreeze = selectQuietanzeToFreeze(
          candidates,
          Number(titoloRow.riga),
          dataSospensione,
        );
        if (toFreeze.length > 0) {
          quietanzeSnapshot = buildQuietanzeSnapshot(dataSospensione, toFreeze);
          quietanzeCongelate = toFreeze.map((r) => r.id);
          const { error: errFreeze } = await supabase
            .from("titoli")
            .update({ stato: "sospeso" } as any)
            .in("id", quietanzeCongelate);
          if (errFreeze) throw errFreeze;
        }
      }

      // 2. Update stato polizza madre + snapshot
      const { error: errUp } = await supabase
        .from("titoli")
        .update({
          stato: "sospeso",
          data_sospensione: dataSospensione,
          limite_riattivazione: limiteRiattivazione || null,
          motivo_sospensione: motivo || null,
          quietanze_sospensione_snapshot: quietanzeSnapshot as any,
        } as any)
        .eq("id", madreId);
      if (errUp) throw errUp;

      // 2b. Nuovo numero polizza (se la compagnia ne emette uno diverso)
      const numeroCambiato = await aggiornaNumeroPolizza({
        titoloId: madreId,
        numeroCorrente: titoloRow.numero_titolo,
        numeroNuovo: nuovoNumeroPolizza,
        causale: "sospensione",
        motivo: motivo || null,
      });

      // 3. Upload documento (opzionale)
      let documentoId: string | null = null;
      let documentoNome: string | null = null;
      if (file) {
        const { data: { user } } = await supabase.auth.getUser();
        const finalName = ensureExt((displayName || file.name).trim() || file.name, file.name);
        const safeName = finalName.replace(/[^\w.\-]+/g, "_");
        const path = `titolo/${madreId}/sospensione_${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, file);
        if (upErr) throw upErr;
        const { data: docIns, error: docErr } = await supabase.from("documenti").insert({
          nome_file: finalName,
          path_storage: path,
          bucket_name: "documenti_titoli",
          entita_tipo: "titolo",
          entita_id: madreId,
          caricato_da: user?.id,
        }).select("id").single();
        if (docErr) throw docErr;
        documentoId = docIns?.id || null;
        documentoNome = finalName;
      }

      // 4. Titolo di Sospensione (sempre creato, anche con importo 0)
      const numeroEffettivo = (nuovoNumeroPolizza && nuovoNumeroPolizza !== titoloRow.numero_titolo)
        ? nuovoNumeroPolizza
        : titoloRow.numero_titolo;
      const { data: maxRigaRow } = await supabase
        .from("titoli")
        .select("riga")
        .eq("numero_titolo", numeroEffettivo)
        .order("riga", { ascending: false })
        .limit(1)
        .maybeSingle();
      const rigaSosp = ((maxRigaRow?.riga as number | undefined) ?? titoloRow.riga ?? 0) + 1;

      const { data: insSosp, error: errSosp } = await supabase
        .from("titoli")
        .insert({
          numero_titolo: numeroEffettivo,
          cliente_id: titoloRow.cliente_id,
          cliente_anagrafica_id: titoloRow.cliente_anagrafica_id,
          compagnia_id: titoloRow.compagnia_id,
          compagnia_rapporto_id: titoloRow.compagnia_rapporto_id,
          codice_rapporto: titoloRow.codice_rapporto,
          ramo_id: titoloRow.ramo_id,
          prodotto_id: titoloRow.prodotto_id,
          prodotto_nome: titoloRow.prodotto_nome,
          ufficio_id: titoloRow.ufficio_id,
          ae_anagrafica_id: titoloRow.ae_anagrafica_id,
          anagrafica_commerciale_id: titoloRow.anagrafica_commerciale_id,
          commerciale_id: titoloRow.commerciale_id,
          percentuale_commerciale: titoloRow.percentuale_commerciale,
          percentuale_riparto: titoloRow.percentuale_riparto,
          garanzia_da: dataSospensione,
          garanzia_a: dataSospensione,
          data_decorrenza: dataSospensione,
          data_scadenza: dataSospensione,
          frazionamento: "Unica",
          premio_lordo: oneriNum,
          premio_netto: oneriNum,
          riga: rigaSosp,
          sostituisce_polizza: numeroEffettivo,
          sostituisce_riga: titoloRow.riga,
          stato: "attivo",
          note: `Sospensione polizza${motivo ? ": " + motivo : ""}`,
          is_oneri_sospensione: true,
          tipo_portafoglio: titoloRow.tipo_portafoglio,
          tipo_mandatario: titoloRow.tipo_mandatario,
        } as any)
        .select("id")
        .single();
      if (errSosp) throw errSosp;
      const titoloSospensioneId = insSosp!.id;

      // 5. Movimento SO (collegato al nuovo titolo SO)
      await supabase.from("movimenti_polizza").insert({
        titolo_id: titoloSospensioneId,
        tipo_documento: "SO",
        data_movimento: dataSospensione,
        descrizione: `Sospensione polizza${motivo ? ": " + motivo : ""}${oneriNum > 0 ? ` (oneri ${oneriNum.toFixed(2)} €)` : ""}${documentoNome ? ` (allegato: ${documentoNome})` : ""}`,
        stato: "sospeso",
      } as any);

      // 6. Log attività
      await logAttivita({
        azione: "sospensione_polizza",
        entita_tipo: "titolo",
        entita_id: madreId,
        dettagli_json: {
          data_sospensione: dataSospensione,
          limite_riattivazione: limiteRiattivazione,
          motivo,
          oneri_sospensione: oneriNum,
          titolo_sospensione_id: titoloSospensioneId,
          quietanze_congelate: quietanzeCongelate,
          documento_id: documentoId,
          documento_nome: documentoNome,
          snapshot_id: snapshotId,
          numero_polizza_cambiato: numeroCambiato,
          numero_polizza_nuovo: numeroCambiato ? nuovoNumeroPolizza : null,
        },
      });

      return { quietanzeCongelate, documentoNome, numeroCambiato, titoloSospensioneId, oneriNum };
    },
    onSuccess: ({ quietanzeCongelate, documentoNome, numeroCambiato, oneriNum: o }) => {
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-polizza", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["documenti", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-attive"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-storico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      queryClient.invalidateQueries({ queryKey: ["titoli-numeri-storici", titoloId] });
      const parts: string[] = ["Polizza sospesa"];
      parts.push(`titolo sospensione creato (€ ${o.toFixed(2)})`);
      if (numeroCambiato) parts.push(`nuovo numero polizza ${nuovoNumeroPolizza}`);
      if (quietanzeCongelate.length > 0) parts.push(`${quietanzeCongelate.length} quietanze congelate`);
      if (documentoNome) parts.push(`allegato "${documentoNome}" caricato`);
      toast.success(parts.join(" · "));
      onOpenChange(false);
      onDone?.();
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore durante la sospensione");
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sospensione Polizza</DialogTitle>
            <DialogDescription>
              {numeroPolizza ? `Polizza ${numeroPolizza}` : "Sospendi la polizza corrente"} — modifica date e garanzie se necessario, poi conferma in un unico passaggio.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 py-2">
            {/* Colonna SX: evento */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="data-sosp-dlg">Data Sospensione *</Label>
                  <Input id="data-sosp-dlg" type="date" value={dataSospensione} onChange={(e) => setDataSospensione(e.target.value)} className="tabular-nums" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="limite-riatt-dlg">Limite Riattivazione</Label>
                  <Input id="limite-riatt-dlg" type="date" value={limiteRiattivazione} onChange={(e) => { setLimiteRiattivazione(e.target.value); setLimiteManual(true); }} className="tabular-nums" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="motivo-sosp-dlg">Motivo</Label>
                <Textarea id="motivo-sosp-dlg" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo della sospensione (opzionale)" rows={3} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="oneri-sosp-dlg">Oneri di sospensione (€)</Label>
                <Input id="oneri-sosp-dlg" type="number" min="0" step="0.01" value={oneriSospensione} onChange={(e) => setOneriSospensione(e.target.value)} className="tabular-nums" />
                <p className="text-xs text-muted-foreground">Verrà comunque creato un titolo di sospensione, anche se l'importo è 0 €, così appare in Carico del Mese ed estratti conto.</p>
              </div>

              <div className="space-y-1.5 border-t pt-3">
                <Label htmlFor="sosp-nuovo-numero">Nuovo numero polizza (opzionale)</Label>
                <Input id="sosp-nuovo-numero" value={nuovoNumeroPolizza} onChange={(e) => setNuovoNumeroPolizza(e.target.value)} placeholder={numeroPolizza || "Lascia vuoto per mantenere il numero attuale"} className="font-mono" />
                <p className="text-xs text-muted-foreground">Se la compagnia emette un nuovo numero, inseriscilo. Attuale: <span className="font-mono">{numeroPolizza || "—"}</span>. Il vecchio sarà archiviato.</p>
              </div>

              <div className="space-y-1.5 border-t pt-3">
                <Label>Documento allegato (opzionale)</Label>
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelected} />
                {!file ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Paperclip className="w-4 h-4 mr-1" /> Seleziona file
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
                    <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nome del documento"
                      className="h-8 text-sm"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={removeFile} title="Rimuovi">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Max 10 MB. Il nome è modificabile; l'estensione viene preservata.</p>
              </div>
            </div>

            {/* Colonna DX: snapshot polizza modificabile */}
            <PolizzaEditorInline ref={editorRef} titoloId={madreIdForEdit} />
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={sospensioneMutation.isPending}>Annulla</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={sospensioneMutation.isPending || !dataSospensione}>
              {sospensioneMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma sospensione polizza</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>Stai per sospendere la polizza <strong>{numeroPolizza || "—"}</strong>.</div>
                <div>Data sospensione: <strong>{dataSospensione || "—"}</strong></div>
                <div>Limite riattivazione: <strong>{limiteRiattivazione || "—"}</strong></div>
                {file && <div>Allegato: <strong>{ensureExt((displayName || file.name).trim() || file.name, file.name)}</strong></div>}
                <div className="text-destructive">Attenzione: le quietanze future e quella in corso verranno congelate (stato sospeso) e non saranno incassabili fino alla riattivazione.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmOpen(false); sospensioneMutation.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Conferma sospensione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SospensionePolizzaDialog;
