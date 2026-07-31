import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { isDocumentUploadTooLarge, MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";

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
  const [error, setError] = useState("");

  const validateFile = (f: File) => {
    if (isDocumentUploadTooLarge(f.size)) { setError(`File troppo grande (max ${MAX_DOCUMENT_UPLOAD_MB} MB)`); return false; }
    if (!ALLOWED_TYPES.includes(f.type)) { setError("Tipo file non supportato. Usa PDF, Word, Excel o immagini."); return false; }
    setError("");
    return true;
  };

  const handleFile = (f: File) => {
    if (validateFile(f)) setFile(f);
  };

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
          <FileDropzone
            inputId="file-upload"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
            selectedFiles={file ? [file] : undefined}
            onFilesSelected={(files) => handleFile(files[0])}
            hint={`PDF, Word, Excel, Immagini — max ${MAX_DOCUMENT_UPLOAD_MB} MB`}
          />
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
