import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Download, Eye, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import DocPreviewDialog from "@/components/cliente/DocPreviewDialog";
import { ensureFileExtension, fileBaseNameWithoutExt } from "@/lib/sanitizeFileName";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  sinistroId: string;
}

export const SinistroDocumentiCliente = ({ sinistroId }: Props) => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [deleteDoc, setDeleteDoc] = useState<any>(null);

  const load = async () => {
    const { data } = await supabase
      .from("documenti")
      .select("id, nome_file, path_storage, bucket_name, created_at, caricato_da_cliente, categoria")
      .eq("entita_tipo", "sinistro")
      .eq("entita_id", sinistroId)
      .eq("visibile_al_cliente", true)
      .order("created_at", { ascending: false });
    setDocs(data ?? []);
  };

  useEffect(() => { load(); }, [sinistroId]);

  const upload = async () => {
    if (!file || !user) return;
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error("Inserisci un nome per il documento");
      return;
    }
    const nomeFile = ensureFileExtension(trimmed, file.name);
    setUploading(true);
    try {
      const path = `${sinistroId}/${Date.now()}_${file.name}`;
      const { error: sErr } = await supabase.storage.from("documenti_sinistri").upload(path, file);
      if (sErr) throw sErr;
      const { error: dErr } = await supabase.from("documenti").insert({
        entita_tipo: "sinistro",
        entita_id: sinistroId,
        nome_file: nomeFile,
        path_storage: path,
        bucket_name: "documenti_sinistri",
        caricato_da: user.id,
        caricato_da_cliente: true,
        visibile_al_cliente: true,
        categoria: "allegato_cliente",
      });
      if (dErr) throw dErr;
      toast.success("Documento caricato");
      setFile(null);
      setDisplayName("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Errore upload");
    } finally {
      setUploading(false);
    }
  };

  const download = async (d: any) => {
    const { data, error } = await supabase.storage.from(d.bucket_name).createSignedUrl(d.path_storage, 60);
    if (error || !data) { toast.error("Impossibile scaricare"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const confirmDelete = async () => {
    if (!deleteDoc) return;
    try {
      await supabase.storage.from(deleteDoc.bucket_name).remove([deleteDoc.path_storage]);
      const { error } = await supabase.from("documenti").delete().eq("id", deleteDoc.id);
      if (error) throw error;
      toast.success("Documento eliminato");
      setDeleteDoc(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Errore eliminazione");
    }
  };

  return (
    <div className="border-t pt-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <FileText className="h-3 w-3" /> Documenti del sinistro
      </p>
      {docs.length === 0 && <p className="text-xs text-muted-foreground">Nessun documento</p>}
      <ul className="space-y-1">
        {docs.map(d => (
          <li key={d.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1 gap-2">
            <span className="truncate flex-1 flex items-center gap-2">
              <span className="truncate">{d.nome_file}</span>
              {d.caricato_da_cliente && (
                <span className="text-[10px] text-teal-700 inline-flex items-center gap-0.5 shrink-0">
                  <User className="h-3 w-3" />tuo
                </span>
              )}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(d)} title="Anteprima">
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => download(d)} title="Scarica">
                <Download className="h-3.5 w-3.5" />
              </Button>
              {d.caricato_da_cliente && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteDoc(d)}
                  title="Elimina"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-2 pt-1">
        <Input
          type="file"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setDisplayName(f ? fileBaseNameWithoutExt(f.name) : "");
          }}
          className="text-xs"
        />
        {file && (
          <div className="space-y-1">
            <Label htmlFor="nome-doc-sinistro-cliente" className="text-xs">Nome documento</Label>
            <Input
              id="nome-doc-sinistro-cliente"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nome del documento"
              className="text-xs h-8"
            />
          </div>
        )}
        <Button size="sm" onClick={upload} disabled={!file || uploading}>
          <Upload className="h-3.5 w-3.5 mr-1" />
          {uploading ? "..." : "Carica"}
        </Button>
      </div>

      <DocPreviewDialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)} doc={previewDoc} />

      <AlertDialog open={!!deleteDoc} onOpenChange={(o) => !o && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare <strong>{deleteDoc?.nome_file}</strong>. L'operazione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SinistroDocumentiCliente;
