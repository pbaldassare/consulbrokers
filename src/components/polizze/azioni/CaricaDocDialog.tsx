import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { logAttivita } from "@/lib/logAttivita";
import { sanitizeStorageFileName } from "@/lib/sanitizeFileName";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string | null;
  numeroTitolo?: string | null;
  onUploaded?: () => void;
}

const MAX = 10 * 1024 * 1024;

export function CaricaDocDialog({ open, onOpenChange, titoloId, numeroTitolo, onUploaded }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [files, setFiles] = useState<FileList | null>(null);

  useEffect(() => { if (open) setFiles(null); }, [open]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!titoloId) throw new Error("Titolo non specificato");
      if (!files || files.length === 0) throw new Error("Seleziona almeno un file");
      const arr = Array.from(files);
      for (const f of arr) {
        if (f.size > MAX) throw new Error(`${f.name} supera 10 MB`);
      }
      for (const f of arr) {
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
      return arr.length;
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

        <div className="space-y-3">
          <Label>File (max 10 MB ciascuno)</Label>
          <Input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
          {files && files.length > 0 && (
            <ul className="text-sm text-muted-foreground space-y-1">
              {Array.from(files).map((f) => <li key={f.name}>• {f.name} ({Math.round(f.size / 1024)} KB)</li>)}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>Annulla</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !titoloId || !files?.length}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Carica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
