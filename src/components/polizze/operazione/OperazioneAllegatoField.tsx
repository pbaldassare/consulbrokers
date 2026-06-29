import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface Props {
  file: File | null;
  displayName: string;
  onFileChange: (file: File | null, displayName: string) => void;
  onDisplayNameChange: (name: string) => void;
  label?: string;
  id?: string;
}

export function OperazioneAllegatoField({
  file,
  displayName,
  onFileChange,
  onDisplayNameChange,
  label = "Documento allegato (opzionale)",
  id = "operazione-allegato",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      toast.error("Il file supera il limite di 10 MB");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    onFileChange(f, f.name);
  };

  const removeFile = () => {
    onFileChange(null, "");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-1.5 border-t pt-3">
      <Label htmlFor={id}>{label}</Label>
      <input ref={fileRef} id={id} type="file" className="hidden" onChange={handleFileSelected} />
      {!file ? (
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Paperclip className="w-4 h-4 mr-1" /> Seleziona file
        </Button>
      ) : (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
          <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            placeholder="Nome del documento"
            className="h-8 text-sm"
          />
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={removeFile} title="Rimuovi">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Max 10 MB. Il nome è modificabile; l&apos;estensione viene preservata.</p>
    </div>
  );
}

export const ensureAllegatoExt = (displayName: string, originalName: string) => {
  const origExt = originalName.includes(".") ? originalName.split(".").pop()!.toLowerCase() : "";
  if (!origExt) return displayName;
  const lower = displayName.toLowerCase();
  return lower.endsWith("." + origExt) ? displayName : `${displayName}.${origExt}`;
};
