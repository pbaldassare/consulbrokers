import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Download, Trash2, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAttivita } from "@/lib/logAttivita";
import PdfPreview from "@/components/PdfPreview";
import { sanitizeStorageFileName } from "@/lib/sanitizeFileName";
import { labelTipoDocumento } from "@/lib/tipiDocumentoCliente";
import UploadDocStaffDialog from "@/components/clienti/UploadDocStaffDialog";

interface DocumentiTabProps {
  entitaTipo: string;
  entitaId: string;
  /** Se valorizzato, la query legge i documenti di TUTTI gli id elencati (catena polizza+quietanze). L'upload viene comunque salvato sul primo id (madre). */
  entitaIds?: string[];
  bucketName?: string;
  readOnly?: boolean;
  /** Upload tipizzato via modale (anagrafica cliente backoffice). */
  typedUpload?: boolean;
  /** Etichetta cliente per titolo modale upload. */
  entitaLabel?: string;
  /** Se false, nasconde anteprima (icona occhio e click su miniatura/nome). */
  showPreview?: boolean;
}


const BUCKET_MAP: Record<string, string> = {
  cliente: "documenti_clienti",
  sinistro: "documenti_sinistri",
  titolo: "documenti_titoli",
  prospect: "documenti_generali",
  trattativa: "documenti_generali",
  rimessa: "documenti_generali",
};

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];

function DocumentThumbnail({ bucketName, pathStorage, nomeFile, onClick, clickable }: { bucketName: string; pathStorage: string; nomeFile: string; onClick?: () => void; clickable?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const ext = nomeFile.split(".").pop()?.toLowerCase() || "";
  const isImage = IMAGE_EXTENSIONS.includes(ext);
  const isPdf = ext === "pdf";

  useEffect(() => {
    if (!isImage) return;
    let revoke: string | null = null;
    supabase.storage.from(bucketName).download(pathStorage).then(({ data }) => {
      if (data) {
        const blobUrl = URL.createObjectURL(data);
        revoke = blobUrl;
        setUrl(blobUrl);
      }
    });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [bucketName, pathStorage, isImage]);

  const base = clickable ? "cursor-pointer hover:opacity-80 transition-opacity" : "";

  if (isImage && url) {
    return <img src={url} alt={nomeFile} className={`w-10 h-10 rounded object-cover border border-border ${base}`} onClick={clickable ? onClick : undefined} />;
  }
  if (isPdf) {
    return <FileText className={`h-8 w-8 text-red-500 ${base}`} onClick={clickable ? onClick : undefined} />;
  }
  return <FileText className={`h-8 w-8 text-muted-foreground ${base}`} onClick={clickable ? onClick : undefined} />;
}

export default function DocumentiTab({
  entitaTipo,
  entitaId,
  entitaIds,
  bucketName,
  readOnly = false,
  typedUpload = false,
  entitaLabel,
  showPreview = true,
}: DocumentiTabProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPdfData, setPreviewPdfData] = useState<Uint8Array | null>(null);
  const bucket = bucketName || BUCKET_MAP[entitaTipo] || "documenti_generali";

  // Catena di id su cui leggere (es. polizza madre + tutte le quietanze). Fallback: solo entitaId.
  const idsForRead = (entitaIds && entitaIds.length > 0) ? entitaIds : [entitaId];
  // Upload viene sempre attribuito al primo id (per i titoli = madre della catena, stabile).
  const uploadEntitaId = (entitaIds && entitaIds.length > 0) ? entitaIds[0] : entitaId;
  const idsKey = [...idsForRead].sort().join(",");

  const { data: documenti } = useQuery({
    queryKey: ["documenti", entitaTipo, idsKey],
    queryFn: async () => {
      const { data } = await supabase
        .from("documenti")
        .select("*, profiles:caricato_da(nome, cognome)")
        .eq("entita_tipo", entitaTipo)
        .in("entita_id", idsForRead)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });


  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Il file supera il limite di 10 MB");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${entitaTipo}/${uploadEntitaId}/${Date.now()}_${sanitizeStorageFileName(file.name)}`;
      const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, file);
      if (uploadErr) throw uploadErr;
      const { error: insertErr } = await supabase.from("documenti").insert({
        nome_file: file.name,
        path_storage: path,
        bucket_name: bucket,
        entita_tipo: entitaTipo,
        entita_id: uploadEntitaId,
        caricato_da: user?.id,
      });
      if (insertErr) throw insertErr;
      await logAttivita({ azione: "upload_documento", entita_tipo: entitaTipo, entita_id: uploadEntitaId, dettagli_json: { nome_file: file.name } });
      toast.success("Documento caricato");
      qc.invalidateQueries({ queryKey: ["documenti", entitaTipo, idsKey] });

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async (doc: any) => {
    const { data, error } = await supabase.storage.from(doc.bucket_name).download(doc.path_storage);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.nome_file;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleVisibilita = async (doc: any) => {
    await supabase.from("documenti").update({ visibile_al_cliente: !doc.visibile_al_cliente }).eq("id", doc.id);
    qc.invalidateQueries({ queryKey: ["documenti", entitaTipo, idsKey] });
  };

  const handleDelete = async (doc: any) => {
    await supabase.storage.from(doc.bucket_name).remove([doc.path_storage]);
    await supabase.from("documenti").delete().eq("id", doc.id);
    toast.success("Documento eliminato");
    qc.invalidateQueries({ queryKey: ["documenti", entitaTipo, idsKey] });
  };

  const openPreview = async (doc: any) => {
    const ext = doc.nome_file.split(".").pop()?.toLowerCase() || "";
    const isImage = IMAGE_EXTENSIONS.includes(ext);
    const isPdf = ext === "pdf";

    if (!isImage && !isPdf) {
      handleDownload(doc);
      return;
    }

    const { data, error } = await supabase.storage.from(doc.bucket_name).download(doc.path_storage);
    if (error) { toast.error(error.message); return; }
    if (isPdf) {
      const buf = new Uint8Array(await data.arrayBuffer());
      setPreviewPdfData(buf);
      setPreviewUrl(null);
    } else {
      const blobUrl = URL.createObjectURL(data);
      setPreviewUrl(blobUrl);
      setPreviewPdfData(null);
    }
    setPreviewDoc(doc);
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewPdfData(null);
    setPreviewDoc(null);
  };

  const previewExt = previewDoc?.nome_file?.split(".")?.pop()?.toLowerCase() || "";
  const previewIsImage = IMAGE_EXTENSIONS.includes(previewExt);

  const showTipologia = typedUpload || documenti?.some((d: any) => d.categoria);
  const colSpan = showTipologia ? 7 : 6;

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          {typedUpload ? (
            <>
              <Button size="sm" onClick={() => setUploadDialogOpen(true)} disabled={uploading}>
                <Upload className="h-4 w-4 mr-1" /> Carica Documento
              </Button>
              <UploadDocStaffDialog
                open={uploadDialogOpen}
                onOpenChange={setUploadDialogOpen}
                clienteId={uploadEntitaId}
                clienteLabel={entitaLabel}
                bucketName={bucket}
                onUploaded={() => qc.invalidateQueries({ queryKey: ["documenti", entitaTipo, idsKey] })}
              />
            </>
          ) : (
            <>
              <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4 mr-1" /> {uploading ? "Caricamento..." : "Carica Documento"}
              </Button>
            </>
          )}
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16"></TableHead>
            <TableHead>Nome File</TableHead>
            {showTipologia && <TableHead>Tipologia</TableHead>}
            <TableHead>Caricato da</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Visibile al cliente</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documenti?.map((doc: any) => (
            <TableRow key={doc.id}>
              <TableCell>
                <DocumentThumbnail
                  bucketName={doc.bucket_name}
                  pathStorage={doc.path_storage}
                  nomeFile={doc.nome_file}
                  clickable={showPreview}
                  onClick={showPreview ? () => openPreview(doc) : undefined}
                />
              </TableCell>
              <TableCell
                className={`font-medium ${showPreview ? "cursor-pointer hover:underline" : ""}`}
                onClick={showPreview ? () => openPreview(doc) : undefined}
              >
                {doc.nome_file}
              </TableCell>
              {showTipologia && (
                <TableCell>
                  {doc.categoria ? (
                    <Badge variant="secondary" className="font-normal">{labelTipoDocumento(doc.categoria)}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              )}
              <TableCell>{doc.profiles ? `${doc.profiles.nome} ${doc.profiles.cognome}` : "—"}</TableCell>
              <TableCell>{format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
              <TableCell>
                <Switch checked={doc.visibile_al_cliente} onCheckedChange={() => toggleVisibilita(doc)} disabled={readOnly} />
              </TableCell>
              <TableCell className="flex gap-1">
                {showPreview && (
                  <Button size="icon" variant="ghost" onClick={() => openPreview(doc)}><Eye className="h-4 w-4" /></Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => handleDownload(doc)}><Download className="h-4 w-4" /></Button>
                {!readOnly && <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(doc)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
          {!documenti?.length && <TableRow><TableCell colSpan={colSpan} className="text-center py-6 text-muted-foreground">Nessun documento</TableCell></TableRow>}
        </TableBody>
      </Table>

      {/* Dialog conferma eliminazione */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare "{deleteTarget?.nome_file}"? L'azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteTarget); setDeleteTarget(null); }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog anteprima documento */}
      {showPreview && (
        <Dialog open={!!previewDoc} onOpenChange={(open) => !open && closePreview()}>
          <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="truncate">{previewDoc?.nome_file}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              {previewIsImage && previewUrl && (
                <div className="flex items-center justify-center h-full overflow-auto bg-muted/40 p-3">
                  <img src={previewUrl} alt={previewDoc?.nome_file} className="max-w-full max-h-full object-contain rounded" />
                </div>
              )}
              {!previewIsImage && previewPdfData && (
                <PdfPreview data={previewPdfData} fileName={previewDoc?.nome_file} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
