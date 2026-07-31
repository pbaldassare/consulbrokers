import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { logAttivita } from "@/lib/logAttivita";
import { sanitizeStorageFileName } from "@/lib/sanitizeFileName";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { MAX_DOCUMENT_UPLOAD_BYTES, MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string | null;
  numeroTitolo?: string | null;
  onUploaded?: () => void;
}


export function CaricaDocDialog({ open, onOpenChange, titoloId, numeroTitolo, onUploaded }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => { if (open) setFiles([]); }, [open]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!titoloId) throw new Error("Titolo non specificato");
      if (files.length === 0) throw new Error("Seleziona almeno un file");
      for (const f of files) {
        if (f.size > MAX_DOCUMENT_UPLOAD_BYTES) throw new Error(`${f.name} supera ${MAX_DOCUMENT_UPLOAD_MB} MB`);
      }
      for (const f of files) {
        const path = `titolo/${titoloId}/${Date.now()}_${sanitizeStorageFileName(f.name)}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, f);
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("documenti").insert({
          nome_file: f.name,
          path_storage: path,
          bucket_name: "documenti_titoli",
          entita_tipo: "titolo",
          entita_id: titoloId,
          caricato_da: user?.id || null,
        });
        if (insErr) throw insErr;
        await logAttivita({
          azione: "upload_documento",
          entita_tipo: "titolo",
          entita_id: titoloId,
          dettagli_json: { nome_file: f.name },
        });
      }
      return files.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} documento/i caricato/i`);
      qc.invalidateQueries({ queryKey: ["documenti", "titolo"] });
      qc.invalidateQueries({ queryKey: ["gestione-polizze"] });
      onUploaded?.();
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Errore upload"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Carica documenti — Polizza {numeroTitolo || ""}</DialogTitle>
          <DialogDescription>I file vengono salvati nel bucket <code>documenti_titoli</code> e collegati alla polizza.</DialogDescription>
        </DialogHeader>

        <FileDropzone
          multiple
          selectedFiles={files.length > 0 ? files : undefined}
          onFilesSelected={setFiles}
          hint={`Max ${MAX_DOCUMENT_UPLOAD_MB} MB per file. Puoi selezionare più file.`}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>Annulla</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !titoloId || files.length === 0}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Carica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
