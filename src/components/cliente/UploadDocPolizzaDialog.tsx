import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { SearchableSelect } from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isDocumentUploadTooLarge, MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const TIPI_DOCUMENTO = [
  "Quietanza",
  "Appendice",
  "Comunicazione compagnia",
  "Documento identità",
  "Libretto di circolazione",
  "Verbale",
  "Perizia",
  "Altro",
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  titoloId: string;
  clienteAnagraficaId: string;
  onUploaded?: () => void;
}

export default function UploadDocPolizzaDialog({ open, onOpenChange, titoloId, clienteAnagraficaId, onUploaded }: Props) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const reset = () => { setFile(null); setTipo(""); setErr(""); };

  const handleFile = (f: File) => {
    if (isDocumentUploadTooLarge(f.size)) { setErr(`File troppo grande (max ${MAX_DOCUMENT_UPLOAD_MB} MB)`); return; }
    if (!ALLOWED.includes(f.type)) { setErr("Tipo non supportato. Usa PDF, JPG, PNG."); return; }
    setErr(""); setFile(f);
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    if (!tipo) { setErr("Seleziona la tipologia documento"); return; }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${clienteAnagraficaId}/${titoloId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("documenti").insert({
        nome_file: file.name,
        path_storage: path,
        bucket_name: "documenti_titoli",
        entita_tipo: "titolo",
        entita_id: titoloId,
        caricato_da: user.id,
        caricato_da_cliente: true,
        visibile_al_cliente: true,
        categoria: tipo,
      });
      if (insErr) throw insErr;

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
      <DialogContent>
        <DialogHeader><DialogTitle>Carica documento per la polizza</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipologia documento *</Label>
            <SearchableSelect
              options={TIPI_DOCUMENTO.map(t => ({ value: t, label: t }))}
              value={tipo}
              onValueChange={setTipo}
              placeholder="Seleziona tipologia"
            />
          </div>
          <FileDropzone
            inputId="up-doc-pol"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            selectedFiles={file ? [file] : undefined}
            onFilesSelected={(files) => handleFile(files[0])}
            hint={`PDF, JPG, PNG — max ${MAX_DOCUMENT_UPLOAD_MB} MB`}
            className="hover:border-teal-500"
          />
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
          <Button onClick={handleUpload} disabled={!file || !tipo || busy} className="bg-teal-700 hover:bg-teal-800">
            {busy ? "Caricamento..." : "Carica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
