import { useState, useRef, useEffect, useMemo } from "react";
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
import { fetchMetadatiInvioMessaCassa, type InvioEmailMessaCassaMeta } from "@/lib/documentiMessaCassa";
import { fetchMetadatiInvioEcCliente, type InvioEmailEcClienteMeta } from "@/lib/documentiEcCliente";
import type { AppendicePolizzaRow } from "@/lib/appendiciPolizza";
import UploadDocStaffDialog from "@/components/clienti/UploadDocStaffDialog";

interface DocumentiTabProps {
  entitaTipo: string;
  entitaId: string;
  /** Se valorizzato, la query legge i documenti di TUTTI gli id elencati (catena polizza+quietanze). L'upload viene comunque salvato sul primo id (madre). */
  entitaIds?: string[];
  /** Documenti su titoli collegati (es. avvisi messa a cassa archiviati sulla polizza madre). */
  titoloIdsForExtraDocs?: string[];
  /** Categorie titolo da includere insieme ai documenti dell'entità principale. */
  extraTitoloCategorie?: string[];
  /** Allegati appendici (storage appendici_polizza) mostrati nella vista polizza madre. */
  appendiciAllegati?: AppendicePolizzaRow[];
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
  titoloIdsForExtraDocs,
  extraTitoloCategorie,
  bucketName,
  readOnly = false,
  typedUpload = false,
  entitaLabel,
  showPreview = true,
  appendiciAllegati,
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
  const extraTitoloKey = (titoloIdsForExtraDocs ?? []).slice().sort().join(",");
  const extraCatKey = (extraTitoloCategorie ?? []).slice().sort().join(",");

  const { data: documenti } = useQuery({
    queryKey: ["documenti", entitaTipo, idsKey, extraTitoloKey, extraCatKey],
    queryFn: async () => {
      const { data: main } = await supabase
        .from("documenti")
        .select("*, profiles:caricato_da(nome, cognome)")
        .eq("entita_tipo", entitaTipo)
        .in("entita_id", idsForRead)
        .order("created_at", { ascending: false });

      let extra: any[] = [];
      if (titoloIdsForExtraDocs?.length && extraTitoloCategorie?.length) {
        const { data: titoloDocs } = await supabase
          .from("documenti")
          .select("*, profiles:caricato_da(nome, cognome)")
          .eq("entita_tipo", "titolo")
          .in("entita_id", titoloIdsForExtraDocs)
          .in("categoria", extraTitoloCategorie)
          .order("created_at", { ascending: false });
        extra = titoloDocs ?? [];
      }

      const seen = new Set<string>();
      const merged: any[] = [];
      for (const doc of [...(main ?? []), ...extra]) {
        const key = doc.path_storage || doc.id;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(doc);
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return merged;
    },
  });

  const avvisoIds = useMemo(
    () => (documenti ?? []).filter((d: any) => d.categoria === "notifica_messa_cassa").map((d: any) => d.id as string),
    [documenti],
  );

  const ecEmailIds = useMemo(
    () => (documenti ?? []).filter((d: any) => d.categoria === "ec_cliente_email").map((d: any) => d.id as string),
    [documenti],
  );

  const { data: invioEmailByDocId = new Map<string, InvioEmailMessaCassaMeta>() } = useQuery({
    queryKey: ["documenti-invio-email", avvisoIds.join(",")],
    enabled: avvisoIds.length > 0,
    queryFn: () => fetchMetadatiInvioMessaCassa(avvisoIds),
  });

  const { data: invioEcByDocId = new Map<string, InvioEmailEcClienteMeta>() } = useQuery({
    queryKey: ["documenti-invio-ec-cliente", ecEmailIds.join(",")],
    enabled: ecEmailIds.length > 0,
    queryFn: () => fetchMetadatiInvioEcCliente(ecEmailIds),
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
      qc.invalidateQueries({ queryKey: ["documenti", entitaTipo] });

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
    qc.invalidateQueries({ queryKey: ["documenti", entitaTipo] });
  };

  const handleDelete = async (doc: any) => {
    await supabase.storage.from(doc.bucket_name).remove([doc.path_storage]);
    await supabase.from("documenti").delete().eq("id", doc.id);
    toast.success("Documento eliminato");
    qc.invalidateQueries({ queryKey: ["documenti", entitaTipo] });
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

  const handleDownloadAppendice = async (a: AppendicePolizzaRow) => {
    if (!a.file_path || !a.nome_file) return;
    const { data, error } = await supabase.storage.from("documenti_titoli").download(a.file_path);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const el = document.createElement("a");
    el.href = url;
    el.download = a.nome_file;
    el.click();
    URL.revokeObjectURL(url);
  };

  const openPreviewAppendice = async (a: AppendicePolizzaRow) => {
    if (!a.file_path || !a.nome_file) return;
    const pseudo = {
      id: `appendice-${a.id}`,
      nome_file: a.nome_file,
      bucket_name: "documenti_titoli",
      path_storage: a.file_path,
    };
    await openPreview(pseudo);
  };

  const appendiceRows = appendiciAllegati ?? [];
  const hasRows = (documenti?.length ?? 0) > 0 || appendiceRows.length > 0;
  const previewExt = previewDoc?.nome_file?.split(".")?.pop()?.toLowerCase() || "";
  const previewIsImage = IMAGE_EXTENSIONS.includes(previewExt);

  const showTipologia = typedUpload || documenti?.some((d: any) => d.categoria) || (appendiciAllegati?.length ?? 0) > 0;
  const showInvioEmail = documenti?.some((d: any) => d.categoria === "notifica_messa_cassa" || d.categoria === "ec_cliente_email");
  const colSpan = (showTipologia ? 1 : 0) + (showInvioEmail ? 1 : 0) + 6;

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
                onUploaded={() => qc.invalidateQueries({ queryKey: ["documenti", entitaTipo] })}
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
            {showInvioEmail && <TableHead>Invio email</TableHead>}
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
              {showInvioEmail && (
                <TableCell className="text-xs max-w-[240px]">
                  {doc.categoria === "notifica_messa_cassa" ? (() => {
                    const meta = invioEmailByDocId.get(doc.id);
                    if (!meta) return <span className="text-muted-foreground">—</span>;
                    return (
                      <div className="space-y-0.5">
                        <div className="truncate" title={meta.destinatario ?? undefined}>
                          <span className="text-muted-foreground">A: </span>{meta.destinatario || "—"}
                        </div>
                        <div className="truncate text-muted-foreground" title={meta.oggetto ?? undefined}>
                          {meta.oggetto || "—"}
                        </div>
                        {meta.inviato_il && (
                          <div className="text-muted-foreground">
                            {format(new Date(meta.inviato_il), "dd/MM/yyyy HH:mm")}
                          </div>
                        )}
                      </div>
                    );
                  })() : doc.categoria === "ec_cliente_email" ? (() => {
                    const meta = invioEcByDocId.get(doc.id);
                    if (!meta) return <span className="text-muted-foreground">—</span>;
                    return (
                      <div className="space-y-0.5">
                        <div className="truncate" title={meta.destinatario ?? undefined}>
                          <span className="text-muted-foreground">A: </span>{meta.destinatario || "—"}
                        </div>
                        <div className="truncate text-muted-foreground" title={meta.oggetto ?? undefined}>
                          {meta.oggetto || "—"}
                        </div>
                        {meta.inviato_il && (
                          <div className="text-muted-foreground">
                            {format(new Date(meta.inviato_il), "dd/MM/yyyy HH:mm")}
                          </div>
                        )}
                      </div>
                    );
                  })() : "—"}
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
          {appendiceRows.map((a) => (
            <TableRow key={`appendice-${a.id}`}>
              <TableCell>
                <DocumentThumbnail
                  bucketName="documenti_titoli"
                  pathStorage={a.file_path!}
                  nomeFile={a.nome_file!}
                  clickable={showPreview}
                  onClick={showPreview ? () => void openPreviewAppendice(a) : undefined}
                />
              </TableCell>
              <TableCell
                className={`font-medium ${showPreview ? "cursor-pointer hover:underline" : ""}`}
                onClick={showPreview ? () => void openPreviewAppendice(a) : undefined}
              >
                {a.nome_file}
              </TableCell>
              {showTipologia && (
                <TableCell>
                  <Badge variant="secondary" className="font-normal">
                    Appendice {a.numero_appendice}{a.tipo ? ` (${String(a.tipo).toUpperCase()})` : ""}
                  </Badge>
                </TableCell>
              )}
              {showInvioEmail && <TableCell className="text-muted-foreground text-xs">—</TableCell>}
              <TableCell className="text-muted-foreground text-xs">Sistema</TableCell>
              <TableCell>{a.created_at ? format(new Date(a.created_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
              <TableCell><Switch checked={false} disabled /></TableCell>
              <TableCell className="flex gap-1">
                {showPreview && (
                  <Button size="icon" variant="ghost" onClick={() => void openPreviewAppendice(a)}><Eye className="h-4 w-4" /></Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => void handleDownloadAppendice(a)}><Download className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {!hasRows && <TableRow><TableCell colSpan={colSpan} className="text-center py-6 text-muted-foreground">Nessun documento</TableCell></TableRow>}
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
