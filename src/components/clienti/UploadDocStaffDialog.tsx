import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { TIPI_DOCUMENTO_CLIENTE_STAFF } from "@/lib/tipiDocumentoCliente";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX = 20 * 1024 * 1024;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clienteId: string;
  clienteLabel?: string;
  bucketName?: string;
  onUploaded?: () => void;
}

export default function UploadDocStaffDialog({
  open,
  onOpenChange,
  clienteId,
  clienteLabel,
  bucketName = "documenti_clienti",
  onUploaded,
}: Props) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [visibileCliente, setVisibileCliente] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const reset = () => {
    setFile(null);
    setTipo("");
    setVisibileCliente(false);
    setErr("");
  };

  const handleFile = (f: File) => {
    if (f.size > MAX) {
      setErr("File troppo grande (max 20 MB)");
      return;
    }
    if (!ALLOWED.includes(f.type)) {
      setErr("Tipo non supportato. Usa PDF, JPG, PNG.");
      return;
    }
    setErr("");
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file || !user || !clienteId) return;
    if (!tipo) {
      setErr("Seleziona la tipologia documento");
      return;
    }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${clienteId}/cliente/${clienteId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from(bucketName)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("documenti").insert({
        nome_file: file.name,
        path_storage: path,
        bucket_name: bucketName,
        entita_tipo: "cliente",
        entita_id: clienteId,
        caricato_da: user.id,
        caricato_da_cliente: false,
        visibile_al_cliente: visibileCliente,
        categoria: tipo,
      });
      if (insErr) {
        await supabase.storage.from(bucketName).remove([path]);
        throw insErr;
      }

      await logAttivita({
        azione: "upload_documento",
        entita_tipo: "cliente",
        entita_id: clienteId,
        dettagli_json: { nome_file: file.name, categoria: tipo, visibile_al_cliente: visibileCliente },
      });

      toast.success("Documento caricato");
      reset();
      onOpenChange(false);
      onUploaded?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore caricamento";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Carica documento{clienteLabel ? ` — ${clienteLabel}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipologia documento *</Label>
            <SearchableSelect
              options={TIPI_DOCUMENTO_CLIENTE_STAFF.map((t) => ({ value: t.value, label: t.label }))}
              value={tipo}
              onValueChange={setTipo}
              placeholder="Seleziona tipologia"
            />
          </div>
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => document.getElementById("up-doc-staff")?.click()}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            {file ? (
              <p className="text-sm font-medium">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Clicca per selezionare un file</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG — max 20 MB</p>
            <input
              id="up-doc-staff"
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
              }}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
            <div>
              <Label htmlFor="visibile-cliente-doc">Visibile al cliente</Label>
              <p className="text-xs text-muted-foreground">Se attivo, compare nel portale cliente</p>
            </div>
            <Switch
              id="visibile-cliente-doc"
              checked={visibileCliente}
              onCheckedChange={setVisibileCliente}
            />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Annulla
          </Button>
          <Button onClick={handleUpload} disabled={!file || !tipo || busy}>
            {busy ? "Caricamento..." : "Carica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
