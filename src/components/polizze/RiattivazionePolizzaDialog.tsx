import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { frazionamentoMesi, frazionamentoToRate } from "@/lib/frazionamento";
import { aggiornaNumeroPolizza } from "@/lib/aggiornaNumeroPolizza";
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

const minISO = (a: string, b: string) => (a < b ? a : b);

const ensureExt = (displayName: string, originalName: string) => {
  const origExt = originalName.includes(".") ? originalName.split(".").pop()!.toLowerCase() : "";
  if (!origExt) return displayName;
  const lower = displayName.toLowerCase();
  return lower.endsWith("." + origExt) ? displayName : `${displayName}.${origExt}`;
};

export const RiattivazionePolizzaDialog = ({ open, onOpenChange, titoloId, numeroPolizza, onDone }: Props) => {
  const queryClient = useQueryClient();
  const todayISO = new Date().toISOString().slice(0, 10);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<PolizzaEditorHandle>(null);

  const [titoloRow, setTitoloRow] = useState<any>(null);
  const [loadingTitolo, setLoadingTitolo] = useState(false);
  const [dataRiattivazione, setDataRiattivazione] = useState(todayISO);
  const [oneri, setOneri] = useState<string>("0");
  const [motivo, setMotivo] = useState("Riattivazione su richiesta cliente");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [nuovoNumero, setNuovoNumero] = useState("");

  useEffect(() => {
    if (!open) return;
    setDataRiattivazione(todayISO);
    setOneri("0");
    setMotivo("Riattivazione su richiesta cliente");
    setFile(null);
    setDisplayName("");
    setNuovoNumero("");
    if (fileRef.current) fileRef.current.value = "";
    // Fetch titolo
    setLoadingTitolo(true);
    supabase
      .from("titoli")
      .select("*")
      .eq("id", titoloId)
      .single()
      .then(({ data }) => {
        setTitoloRow(data);
        setLoadingTitolo(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, titoloId]);

  // Preview rate future
  const preview = useMemo(() => {
    if (!titoloRow) return [] as Array<{ da: string; a: string; importo: number }>;
    const fraz = titoloRow.frazionamento || "Annuale";
    const anni = titoloRow.anni_durata || 1;
    const mesi = frazionamentoMesi(fraz, anni);
    const ratePerAnno = frazionamentoToRate(fraz, anni);
    const importoFirma = Number(titoloRow.premio_lordo || 0);
    const importoRata = ratePerAnno > 0 ? +(importoFirma / ratePerAnno).toFixed(2) : importoFirma;
    const fineCopertura = titoloRow.durata_a || titoloRow.data_scadenza;
    const startBase = titoloRow.garanzia_a;
    if (!fineCopertura || !startBase) return [];
    if (fraz === "Poliennale") return [];
    const out: Array<{ da: string; a: string; importo: number }> = [];
    let cursor = startBase as string;
    let safety = 0;
    while (cursor < fineCopertura && safety < 120) {
      const da = cursor;
      const a = minISO(addMonthsISO(da, mesi), fineCopertura);
      if (da >= a) break;
      out.push({ da, a, importo: importoRata });
      cursor = a;
      safety++;
    }
    return out;
  }, [titoloRow]);

  const oneriNum = Number(oneri.replace(",", ".")) || 0;

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

  const riattivazioneMutation = useMutation({
    mutationFn: async () => {
      if (!dataRiattivazione) throw new Error("Data riattivazione obbligatoria");
      if (!titoloRow) throw new Error("Titolo non caricato");
      if (titoloRow.stato !== "sospeso") throw new Error("La polizza non è sospesa. Solo le polizze sospese possono essere riattivate.");

      // 0. Snapshot pre-evento + applica modifiche inline (date / garanzie)
      const snapshotId = await editorRef.current?.commit("riattivazione");

      // 0bis. Cambio numero polizza (se compagnia ne emette uno nuovo)
      const numeroCambiato = await aggiornaNumeroPolizza({
        titoloId,
        numeroCorrente: titoloRow.numero_titolo,
        numeroNuovo: nuovoNumero,
        causale: "riattivazione",
        motivo,
      });
      const numeroEffettivo = numeroCambiato ? nuovoNumero.trim() : titoloRow.numero_titolo;
      const { error: errUp } = await supabase
        .from("titoli")
        .update({
          stato: "attivo",
          data_riattivazione: dataRiattivazione,
          data_sospensione: null,
          limite_riattivazione: null,
          motivo_sospensione: null,
        } as any)
        .eq("id", titoloId);
      if (errUp) throw errUp;

      // 2. Ricrea quietanze future
      const quietanzeCreate: string[] = [];
      let prevRiga = Number(titoloRow.riga || 0);
      for (const r of preview) {
        const nuovaRiga = prevRiga + 1;
        const ratePerAnno = frazionamentoToRate(titoloRow.frazionamento || "Annuale", titoloRow.anni_durata || 1);
        const { data: ins, error: errIns } = await supabase
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
            durata_da: titoloRow.durata_da,
            durata_a: titoloRow.durata_a,
            anni_durata: titoloRow.anni_durata,
            data_scadenza: titoloRow.data_scadenza,
            frazionamento: titoloRow.frazionamento,
            rate: ratePerAnno,
            garanzia_da: r.da,
            garanzia_a: r.a,
            premio_lordo: r.importo,
            premio_netto_quietanza: titoloRow.premio_netto_quietanza,
            addizionali_quietanza: titoloRow.addizionali_quietanza,
            tasse_quietanza: titoloRow.tasse_quietanza,
            provvigioni_quietanza: titoloRow.provvigioni_quietanza,
            brokeraggio_quietanza: titoloRow.brokeraggio_quietanza,
            riga: nuovaRiga,
            sostituisce_polizza: numeroEffettivo,
            sostituisce_riga: prevRiga,
            stato: "attivo",
            tipo_portafoglio: titoloRow.tipo_portafoglio,
            tipo_mandatario: titoloRow.tipo_mandatario,
          } as any)
          .select("id")
          .single();
        if (errIns) throw errIns;
        quietanzeCreate.push(ins!.id);
        prevRiga = nuovaRiga;
      }

      // 3. Titolo Oneri di Riattivazione (se > 0)
      let titoloOneriId: string | null = null;
      if (oneriNum > 0) {
        const rigaOneri = prevRiga + 1;
        const { data: insOneri, error: errOneri } = await supabase
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
            garanzia_da: dataRiattivazione,
            garanzia_a: dataRiattivazione,
            premio_lordo: oneriNum,
            premio_netto: oneriNum,
            riga: rigaOneri,
            sostituisce_polizza: numeroEffettivo,
            sostituisce_riga: titoloRow.riga,
            stato: "attivo",
            note: "Oneri di riattivazione",
            tipo_portafoglio: titoloRow.tipo_portafoglio,
            tipo_mandatario: titoloRow.tipo_mandatario,
          } as any)
          .select("id")
          .single();
        if (errOneri) throw errOneri;
        titoloOneriId = insOneri!.id;
      }

      // 4. Upload documento opzionale
      let documentoId: string | null = null;
      let documentoNome: string | null = null;
      if (file) {
        const { data: { user } } = await supabase.auth.getUser();
        const finalName = ensureExt((displayName || file.name).trim() || file.name, file.name);
        const safeName = finalName.replace(/[^\w.\-]+/g, "_");
        const path = `titolo/${titoloId}/riattivazione_${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, file);
        if (upErr) throw upErr;
        const { data: docIns, error: docErr } = await supabase.from("documenti").insert({
          nome_file: finalName,
          path_storage: path,
          bucket_name: "documenti_titoli",
          entita_tipo: "titolo",
          entita_id: titoloId,
          caricato_da: user?.id,
        }).select("id").single();
        if (docErr) throw docErr;
        documentoId = docIns?.id || null;
        documentoNome = finalName;
      }

      // 5. Movimento RA
      const descrParts: string[] = ["Riattivazione polizza"];
      if (oneriNum > 0) descrParts.push(`oneri ${oneriNum.toFixed(2)} €`);
      if (motivo) descrParts.push(motivo);
      if (documentoNome) descrParts.push(`allegato: ${documentoNome}`);
      await supabase.from("movimenti_polizza").insert({
        titolo_id: titoloId,
        tipo_documento: "RA",
        data_movimento: dataRiattivazione,
        descrizione: descrParts.join(" — "),
        stato: "attivo",
      } as any);

      // 6. Log attività
      await logAttivita({
        azione: "riattivazione_polizza",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: {
          data_riattivazione: dataRiattivazione,
          oneri: oneriNum,
          motivo,
          quietanze_ricreate: quietanzeCreate,
          titolo_oneri_id: titoloOneriId,
          documento_id: documentoId,
          documento_nome: documentoNome,
          snapshot_id: snapshotId,
          numero_polizza_precedente: numeroCambiato ? titoloRow.numero_titolo : null,
          numero_polizza_nuovo: numeroCambiato ? numeroEffettivo : null,
        },
      });

      return { quietanzeCreate, titoloOneriId, documentoNome };
    },
    onSuccess: ({ quietanzeCreate, titoloOneriId, documentoNome }) => {
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-polizza", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["documenti", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-attive"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-storico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      const parts: string[] = ["Polizza riattivata"];
      if (quietanzeCreate.length > 0) parts.push(`${quietanzeCreate.length} quietanze ricreate`);
      if (titoloOneriId) parts.push("titolo oneri creato");
      if (documentoNome) parts.push(`allegato "${documentoNome}" caricato`);
      toast.success(parts.join(" · "));
      onOpenChange(false);
      onDone?.();
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore durante la riattivazione");
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riattivazione Polizza</DialogTitle>
            <DialogDescription>
              {numeroPolizza ? `Polizza ${numeroPolizza}` : "Riattiva la polizza sospesa"} — modifica date e garanzie se necessario, poi conferma in un unico passaggio.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 py-2">
            <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data-riatt-dlg">Data Riattivazione *</Label>
                <Input id="data-riatt-dlg" type="date" value={dataRiattivazione} onChange={(e) => setDataRiattivazione(e.target.value)} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oneri-dlg">Oneri a carico cliente (€)</Label>
                <Input id="oneri-dlg" type="number" min="0" step="0.01" value={oneri} onChange={(e) => setOneri(e.target.value)} className="tabular-nums" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nuovo-numero-riatt-dlg">Nuovo numero polizza (opzionale)</Label>
              <Input
                id="nuovo-numero-riatt-dlg"
                value={nuovoNumero}
                onChange={(e) => setNuovoNumero(e.target.value)}
                placeholder={numeroPolizza || "Lasciare vuoto se invariato"}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Se la compagnia ha emesso un nuovo numero in fase di riattivazione, inseriscilo qui. Il numero precedente verrà archiviato.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo-riatt-dlg">Motivo</Label>
              <Textarea id="motivo-riatt-dlg" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
            </div>


            <div className="border rounded-md p-3 bg-muted/30">
              <div className="text-sm font-semibold mb-2">Quietanze che verranno ricreate</div>
              {loadingTitolo ? (
                <div className="text-xs text-muted-foreground">Caricamento…</div>
              ) : preview.length === 0 ? (
                <div className="text-xs text-muted-foreground">Nessuna quietanza futura da ricreare (polizza in scadenza o poliennale).</div>
              ) : (
                <ul className="text-xs space-y-1 tabular-nums">
                  {preview.map((r, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>{r.da} → {r.a}</span>
                      <span className="font-medium">{r.importo.toFixed(2)} €</span>
                    </li>
                  ))}
                </ul>
              )}
              {oneriNum > 0 && (
                <div className="text-xs mt-2 pt-2 border-t flex justify-between tabular-nums">
                  <span>+ Titolo Oneri di Riattivazione (da contabilizzare)</span>
                  <span className="font-medium">{oneriNum.toFixed(2)} €</span>
                </div>
              )}
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

            <PolizzaEditorInline ref={editorRef} titoloId={titoloId} />
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={riattivazioneMutation.isPending}>Annulla</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={riattivazioneMutation.isPending || !dataRiattivazione || loadingTitolo}>
              {riattivazioneMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma riattivazione polizza</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>Stai per riattivare la polizza <strong>{numeroPolizza || "—"}</strong>.</div>
                <div>Data riattivazione: <strong>{dataRiattivazione || "—"}</strong></div>
                {nuovoNumero.trim() && nuovoNumero.trim() !== (numeroPolizza || "") && (
                  <div>Nuovo numero polizza: <strong>{nuovoNumero.trim()}</strong> <span className="text-muted-foreground">(precedente archiviato)</span></div>
                )}
                <div>Quietanze future ricreate: <strong>{preview.length}</strong></div>
                {oneriNum > 0 && <div>Oneri cliente: <strong>{oneriNum.toFixed(2)} €</strong> (titolo separato da contabilizzare)</div>}
                {file && <div>Allegato: <strong>{ensureExt((displayName || file.name).trim() || file.name, file.name)}</strong></div>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); riattivazioneMutation.mutate(); }}>
              Conferma riattivazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RiattivazionePolizzaDialog;
