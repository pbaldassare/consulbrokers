import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Upload, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

interface Polizza {
  id: string;
  numero_titolo: string | null;
  ramo_descrizione?: string | null;
  ufficio_id?: string | null;
  cliente_anagrafica_id: string;
}

export const NuovaDenunciaSinistroDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [polizze, setPolizze] = useState<Polizza[]>([]);

  // step 1
  const [titoloId, setTitoloId] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [luogo, setLuogo] = useState("");
  const [cittaSinistro, setCittaSinistro] = useState("");
  // step 2
  const [dinamica, setDinamica] = useState("");
  const [controparte, setControparte] = useState("");
  const [targa, setTarga] = useState("");
  // step 3
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTitoloId(""); setDataEvento(""); setLuogo(""); setCittaSinistro("");
    setDinamica(""); setControparte(""); setTarga(""); setFiles([]);
    (async () => {
      const { data: cIds } = await supabase.rpc("get_my_cliente_ids");
      if (!cIds?.length) return;
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, ufficio_id, cliente_anagrafica_id, rami(descrizione)")
        .in("cliente_anagrafica_id", cIds.map((c: any) => c))
        .eq("stato", "attivo");
      setPolizze((data ?? []).map((t: any) => ({
        ...t,
        ramo_descrizione: t.rami?.descrizione,
      })));
    })();
  }, [open]);

  const polizzaSelezionata = polizze.find(p => p.id === titoloId);

  const submit = async () => {
    if (!user || !polizzaSelezionata) return;
    setSaving(true);
    try {
      const numero = `WEB-${Date.now().toString().slice(-8)}`;
      const { data: sin, error } = await supabase
        .from("sinistri")
        .insert({
          numero_sinistro: numero,
          stato: "aperto",
          aperto_da_cliente: true,
          titolo_id: polizzaSelezionata.id,
          cliente_anagrafica_id: polizzaSelezionata.cliente_anagrafica_id,
          ufficio_id: polizzaSelezionata.ufficio_id,
          ramo_sinistro: polizzaSelezionata.ramo_descrizione,
          data_evento: dataEvento || null,
          data_apertura: new Date().toISOString().slice(0, 10),
          data_denuncia: new Date().toISOString().slice(0, 10),
          luogo_sinistro: luogo || null,
          citta_sinistro: cittaSinistro || null,
          dinamica: dinamica || null,
          controparte: controparte || null,
          targa_veicolo: targa || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Upload allegati
      for (const f of files) {
        const path = `${sin.id}/${Date.now()}_${f.name}`;
        const { error: uErr } = await supabase.storage
          .from("documenti_sinistri")
          .upload(path, f);
        if (uErr) {
          toast.error(`Errore upload ${f.name}: ${uErr.message}`);
          continue;
        }
        await supabase.from("documenti").insert({
          entita_tipo: "sinistro",
          entita_id: sin.id,
          nome_file: f.name,
          path_storage: path,
          bucket_name: "documenti_sinistri",
          caricato_da: user.id,
          caricato_da_cliente: true,
          visibile_al_cliente: true,
          categoria: "denuncia_cliente",
        });
      }

      toast.success("Denuncia inviata all'agenzia");
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || "Errore durante l'invio");
    } finally {
      setSaving(false);
    }
  };

  const canNext1 = titoloId && dataEvento;
  const canNext2 = dinamica.trim().length > 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apri nuovo sinistro — Step {step}/3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div>
              <Label>Polizza coinvolta *</Label>
              <Select value={titoloId} onValueChange={setTitoloId}>
                <SelectTrigger><SelectValue placeholder="Seleziona polizza" /></SelectTrigger>
                <SelectContent>
                  {polizze.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.numero_titolo} {p.ramo_descrizione ? `— ${p.ramo_descrizione}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data evento *</Label>
                <Input type="date" value={dataEvento} onChange={e => setDataEvento(e.target.value)} />
              </div>
              <div>
                <Label>Città</Label>
                <Input value={cittaSinistro} onChange={e => setCittaSinistro(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Luogo / indirizzo</Label>
              <Input value={luogo} onChange={e => setLuogo(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <Label>Dinamica del sinistro *</Label>
              <Textarea rows={5} value={dinamica} onChange={e => setDinamica(e.target.value)} placeholder="Descrivi cosa è successo..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Controparte (se presente)</Label>
                <Input value={controparte} onChange={e => setControparte(e.target.value)} />
              </div>
              <div>
                <Label>Targa veicolo (RCA)</Label>
                <Input value={targa} onChange={e => setTarga(e.target.value.toUpperCase())} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label>Allegati (foto, denuncia, perizia...)</Label>
            <Input type="file" multiple onChange={e => setFiles(Array.from(e.target.files ?? []))} />
            {files.length > 0 && (
              <ul className="text-sm space-y-1 bg-muted/50 rounded p-2">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="truncate">{f.name}</span>
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="text-xs text-muted-foreground p-3 bg-muted/40 rounded">
              <strong>Riepilogo:</strong> {polizzaSelezionata?.numero_titolo} — {dataEvento} — {cittaSinistro || luogo}
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <Button variant="outline" onClick={step === 1 ? () => onOpenChange(false) : () => setStep(step - 1)} disabled={saving}>
            {step === 1 ? "Annulla" : <><ChevronLeft className="h-4 w-4 mr-1" />Indietro</>}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}>
              Avanti <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={saving}>
              <Upload className="h-4 w-4 mr-1" />
              {saving ? "Invio..." : "Invia denuncia"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NuovaDenunciaSinistroDialog;
