import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX = 20 * 1024 * 1024;

const TIPI_DOCUMENTO = [
  "Quietanza", "Appendice", "Comunicazione compagnia", "Documento identità",
  "Libretto di circolazione", "Verbale", "Perizia", "Visura", "Privacy/GDPR", "Altro",
];

const ENTITA_OPTIONS = [
  { value: "cliente", label: "Generale (anagrafica ente)" },
  { value: "titolo", label: "Su una polizza" },
  { value: "sinistro", label: "Su un sinistro" },
];

const BUCKET_BY_ENTITA: Record<string, string> = {
  cliente: "documenti_clienti",
  titolo: "documenti_titoli",
  sinistro: "documenti_sinistri",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** opzionale: se passato, blocca su questa entità */
  fixedEntita?: { tipo: "cliente" | "titolo" | "sinistro"; id: string };
  /** sempre richiesto: id anagrafica cliente per costruire path */
  clienteAnagraficaId: string;
  onUploaded?: () => void;
}

export default function UploadDocClienteDialog({ open, onOpenChange, fixedEntita, clienteAnagraficaId, onUploaded }: Props) {
  const { user } = useAuth();
  const [entitaTipo, setEntitaTipo] = useState<string>(fixedEntita?.tipo ?? "cliente");
  const [entitaId, setEntitaId] = useState<string>(fixedEntita?.id ?? clienteAnagraficaId);
  const [polizze, setPolizze] = useState<any[]>([]);
  const [sinistri, setSinistri] = useState<any[]>([]);
  const [tipo, setTipo] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const reset = () => {
    setFile(null); setTipo(""); setErr("");
    if (!fixedEntita) {
      setEntitaTipo("cliente");
      setEntitaId(clienteAnagraficaId);
    }
  };

  useEffect(() => {
    if (!open || fixedEntita) return;
    supabase.from("titoli").select("id, numero_titolo, compagnie(nome)").eq("cliente_anagrafica_id", clienteAnagraficaId).order("created_at", { ascending: false }).then(({ data }) => setPolizze(data ?? []));
    supabase.from("sinistri").select("id, numero_sinistro").eq("cliente_anagrafica_id", clienteAnagraficaId).order("created_at", { ascending: false }).then(({ data }) => setSinistri(data ?? []));
  }, [open, clienteAnagraficaId, fixedEntita]);

  useEffect(() => {
    if (fixedEntita) return;
    if (entitaTipo === "cliente") setEntitaId(clienteAnagraficaId);
    else setEntitaId("");
  }, [entitaTipo, clienteAnagraficaId, fixedEntita]);

  const handleFile = (f: File) => {
    if (f.size > MAX) { setErr("File troppo grande (max 20MB)"); return; }
    if (!ALLOWED.includes(f.type)) { setErr("Tipo non supportato. Usa PDF, JPG, PNG."); return; }
    setErr(""); setFile(f);
  };

  const handleUpload = async () => {
    if (!file || !user || !entitaId) return;
    if (!tipo) { setErr("Seleziona la tipologia documento"); return; }
    setBusy(true);
    try {
      const bucket = BUCKET_BY_ENTITA[entitaTipo];
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${clienteAnagraficaId}/${entitaTipo}/${entitaId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("documenti").insert({
        nome_file: file.name,
        path_storage: path,
        bucket_name: bucket,
        entita_tipo: entitaTipo,
        entita_id: entitaId,
        caricato_da: user.id,
        caricato_da_cliente: true,
        visibile_al_cliente: true,
        categoria: tipo,
      });
      if (insErr) {
        await supabase.storage.from(bucket).remove([path]);
        throw insErr;
      }
      toast.success("Documento caricato");
      reset();
      onOpenChange(false);
      onUploaded?.();
    } catch (e: any) {
      toast.error(e.message ?? "Errore caricamento");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Carica documento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!fixedEntita && (
            <>
              <div>
                <Label>Collega a *</Label>
                <SearchableSelect options={ENTITA_OPTIONS} value={entitaTipo} onValueChange={setEntitaTipo} placeholder="Seleziona" />
              </div>
              {entitaTipo === "titolo" && (
                <div>
                  <Label>Polizza *</Label>
                  <SearchableSelect
                    options={polizze.map(p => ({ value: p.id, label: `${p.numero_titolo ?? "—"} · ${(p.compagnie as any)?.nome ?? ""}` }))}
                    value={entitaId}
                    onValueChange={setEntitaId}
                    placeholder="Seleziona polizza"
                  />
                </div>
              )}
              {entitaTipo === "sinistro" && (
                <div>
                  <Label>Sinistro *</Label>
                  <SearchableSelect
                    options={sinistri.map(s => ({ value: s.id, label: s.numero_sinistro ?? s.id }))}
                    value={entitaId}
                    onValueChange={setEntitaId}
                    placeholder="Seleziona sinistro"
                  />
                </div>
              )}
            </>
          )}
          <div>
            <Label>Tipologia documento *</Label>
            <SearchableSelect
              options={TIPI_DOCUMENTO.map(t => ({ value: t, label: t }))}
              value={tipo}
              onValueChange={setTipo}
              placeholder="Seleziona tipologia"
            />
          </div>
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-teal-500 transition-colors"
            onClick={() => document.getElementById("up-doc-cli")?.click()}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            {file ? (
              <p className="text-sm font-medium">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
            ) : (
              <p className="text-sm text-muted-foreground">Clicca per selezionare un file</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG — max 20MB</p>
            <input id="up-doc-cli" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
          <Button onClick={handleUpload} disabled={!file || !tipo || !entitaId || busy} className="bg-teal-700 hover:bg-teal-800">
            {busy ? "Caricamento..." : "Carica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
