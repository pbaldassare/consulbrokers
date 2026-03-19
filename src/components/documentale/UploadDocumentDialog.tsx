import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File, description: string, tags: string[]) => void;
  loading?: boolean;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function UploadDocumentDialog({ open, onOpenChange, onUpload, loading }: UploadDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");

  const validateFile = (f: File) => {
    if (f.size > 50 * 1024 * 1024) { setError("File troppo grande (max 50MB)"); return false; }
    if (!ALLOWED_TYPES.includes(f.type)) { setError("Tipo file non supportato. Usa PDF, Word, Excel o immagini."); return false; }
    setError("");
    return true;
  };

  const handleFile = (f: File) => {
    if (validateFile(f)) setFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleSubmit = () => {
    if (!file) return;
    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    onUpload(file, description.trim(), tags);
    setFile(null); setDescription(""); setTagsInput(""); setError("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Carica Documento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            {file ? (
              <p className="text-sm font-medium">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>
            ) : (
              <p className="text-sm text-muted-foreground">Trascina un file o clicca per selezionare</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, Immagini — max 50MB</p>
            <input id="file-upload" type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div>
            <Label>Descrizione</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrizione del documento" maxLength={500} />
          </div>
          <div>
            <Label>Tag (separati da virgola)</Label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="CGA, auto, vita" maxLength={200} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={!file || loading}>{loading ? "Caricamento..." : "Carica"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
