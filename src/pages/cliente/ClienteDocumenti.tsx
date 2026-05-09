import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Eye, FileText, Trash2, Upload, User, X } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { SearchableSelect } from "@/components/SearchableSelect";
import UploadDocClienteDialog from "@/components/cliente/UploadDocClienteDialog";
import DocPreviewDialog from "@/components/cliente/DocPreviewDialog";
import { toast } from "sonner";

const ClienteDocumenti = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [deleteDoc, setDeleteDoc] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: ids } = await supabase.rpc("get_my_cliente_ids");
    const myIds: string[] = (ids ?? []) as any;
    if (!myIds.length) { setClienteId(null); setDocs([]); setLoading(false); return; }
    setClienteId(myIds[0]);

    const { data } = await supabase
      .from("documenti")
      .select("*")
      .eq("entita_tipo", "cliente")
      .in("entita_id", myIds)
      .order("created_at", { ascending: false });

    setDocs(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const tipiOptions = useMemo(() => {
    const set = new Set<string>();
    docs.forEach(d => { if (d.categoria) set.add(d.categoria); });
    return [{ value: "", label: "Tutte le tipologie" }, ...Array.from(set).sort().map(t => ({ value: t, label: t }))];
  }, [docs]);

  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (filtroTipo && d.categoria !== filtroTipo) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${d.nome_file ?? ""} ${d.categoria ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docs, filtroTipo, search]);

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from(doc.bucket_name).createSignedUrl(doc.path_storage, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const confirmDelete = async () => {
    if (!deleteDoc) return;
    try {
      const { error: sErr } = await supabase.storage.from(deleteDoc.bucket_name).remove([deleteDoc.path_storage]);
      if (sErr) throw sErr;
      const { error: dErr } = await supabase.from("documenti").delete().eq("id", deleteDoc.id);
      if (dErr) throw dErr;
      toast.success("Documento eliminato");
      setDeleteDoc(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Errore eliminazione");
    }
  };

  const filtriAttivi = search || filtroTipo;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Documentazione Ente</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Documenti generali collegati alla tua anagrafica</p>
        </div>
        {clienteId && (
          <Button onClick={() => setUploadOpen(true)} className="bg-teal-700 hover:bg-teal-800 gap-1.5">
            <Upload className="h-4 w-4" /> Carica documento
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Cerca per nome / categoria" value={search} onChange={(e) => setSearch(e.target.value)} />
            <SearchableSelect options={tipiOptions} value={filtroTipo} onValueChange={setFiltroTipo} placeholder="Tipologia" />
            {filtriAttivi && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFiltroTipo(""); }} className="gap-1.5 self-center">
                <X className="h-4 w-4" /> Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun documento dell'ente trovato.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {filtered.map((d, idx) => (
              <div key={d.id} className={`flex items-center justify-between px-4 py-3 border-b border-border last:border-0 gap-3 ${idx % 2 === 0 ? "bg-white" : "bg-muted/30"}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-teal-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.nome_file}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {d.categoria && <Badge variant="secondary" className="text-[10px]">{d.categoria}</Badge>}
                      {d.caricato_da_cliente && (
                        <Badge className="bg-teal-100 text-teal-800 text-[10px] gap-1"><User className="h-3 w-3" />Caricato da te</Badge>
                      )}
                      {d.created_at && (
                        <span className="text-[10px] text-muted-foreground">{format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: it })}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(d)} title="Anteprima"><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(d)} title="Scarica"><Download className="h-4 w-4" /></Button>
                  {d.caricato_da_cliente && (
                    <Button variant="ghost" size="sm" onClick={() => setDeleteDoc(d)} title="Elimina" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {clienteId && (
        <UploadDocClienteDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          clienteAnagraficaId={clienteId}
          fixedEntita={{ tipo: "cliente", id: clienteId }}
          onUploaded={load}
        />
      )}
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
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClienteDocumenti;
