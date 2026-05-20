import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Upload, FileText, Download, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rapportoId: string | null;
  rapportoNome?: string;
}

const TIPI = [
  { value: "mandato", label: "Mandato" },
  { value: "lettera_incarico", label: "Lettera d'incarico" },
  { value: "convenzione", label: "Convenzione" },
  { value: "polizza_quadro", label: "Polizza quadro" },
  { value: "altro", label: "Altro" },
];

export default function RapportoDocumentiDialog({ open, onOpenChange, rapportoId, rapportoNome }: Props) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [tipo, setTipo] = useState("altro");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteDoc, setDeleteDoc] = useState<any>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["rapporto_documenti", rapportoId],
    queryFn: async () => {
      if (!rapportoId) return [];
      const { data, error } = await supabase
        .from("compagnia_rapporto_documenti")
        .select("*, autore:uploaded_by(nome, cognome)")
        .eq("rapporto_id", rapportoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!rapportoId && open,
  });

  const handleUpload = async (files: FileList) => {
    if (!rapportoId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `compagnia_rapporti/${rapportoId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("documenti_generali").upload(path, file);
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("compagnia_rapporto_documenti").insert({
          rapporto_id: rapportoId,
          nome_file: file.name,
          file_path: path,
          tipo_documento: tipo,
          dimensione_bytes: file.size,
          mime_type: file.type || null,
          uploaded_by: profile?.id,
        });
        if (dbErr) throw dbErr;
      }
      qc.invalidateQueries({ queryKey: ["rapporto_documenti", rapportoId] });
      toast.success("Documento caricato");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async (doc: any) => {
    const { data, error } = await supabase.storage.from("documenti_generali").createSignedUrl(doc.file_path, 300);
    if (error) { toast.error("Errore download"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const renameMut = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("compagnia_rapporto_documenti").update({ nome_file: nome }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rapporto_documenti", rapportoId] });
      setRenamingId(null);
      toast.success("Documento rinominato");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("documenti_generali").remove([doc.file_path]);
      const { error } = await supabase.from("compagnia_rapporto_documenti").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rapporto_documenti", rapportoId] });
      setDeleteDoc(null);
      toast.success("Documento eliminato");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documenti rapporto</DialogTitle>
            {rapportoNome && <DialogDescription>{rapportoNome}</DialogDescription>}
          </DialogHeader>

          <div className="flex items-center gap-2 flex-wrap py-2 border-b">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-48 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPI.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Carica documento
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); }}
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Caricamento...</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nessun documento caricato.</p>
          ) : (
            <div className="space-y-2 py-2">
              {docs.map((d: any, idx: number) => (
                <div
                  key={d.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${idx % 2 === 0 ? "bg-muted/30" : "bg-background"}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      {renamingId === d.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && renameValue.trim()) renameMut.mutate({ id: d.id, nome: renameValue.trim() });
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => renameValue.trim() && renameMut.mutate({ id: d.id, nome: renameValue.trim() })}>
                            <Check className="w-3.5 h-3.5 text-primary" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRenamingId(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium truncate">{d.nome_file}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {TIPI.find((t) => t.value === d.tipo_documento)?.label || d.tipo_documento}
                        {" • "}
                        {d.autore ? `${d.autore.cognome || ""} ${d.autore.nome || ""}`.trim() : "—"}
                        {" • "}
                        {format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: it })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(d)} title="Scarica">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-8 w-8"
                      onClick={() => { setRenamingId(d.id); setRenameValue(d.nome_file); }}
                      title="Rinomina"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-8 w-8"
                      onClick={() => setDeleteDoc(d)}
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDoc} onOpenChange={(v) => !v && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare <strong>{deleteDoc?.nome_file}</strong>. L'azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDoc && deleteMut.mutate(deleteDoc)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
