import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Download, Eye, FileText, Trash2, Upload, User, X } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { SearchableSelect } from "@/components/SearchableSelect";
import UploadDocClienteDialog from "@/components/cliente/UploadDocClienteDialog";
import DocPreviewDialog from "@/components/cliente/DocPreviewDialog";
import { toast } from "sonner";

const ENTITA_LABEL: Record<string, { label: string; color: string }> = {
  cliente: { label: "Generale", color: "bg-slate-100 text-slate-800" },
  titolo: { label: "Polizza", color: "bg-emerald-100 text-emerald-800" },
  sinistro: { label: "Sinistro", color: "bg-red-100 text-red-800" },
};

const ClienteDocumenti = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [deleteDoc, setDeleteDoc] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [filtroEntita, setFiltroEntita] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: ids } = await supabase.rpc("get_my_cliente_ids");
    const myIds: string[] = (ids ?? []) as any;
    if (!myIds.length) { setClienteId(null); setDocs([]); setLoading(false); return; }
    setClienteId(myIds[0]);

    const [{ data: tit }, { data: sin }] = await Promise.all([
      supabase.from("titoli").select("id, numero_titolo").in("cliente_anagrafica_id", myIds),
      supabase.from("sinistri").select("id, numero_sinistro").in("cliente_anagrafica_id", myIds),
    ]);
    const titoliIds = (tit ?? []).map(t => t.id);
    const sinistriIds = (sin ?? []).map(s => s.id);
    const titoliMap = new Map((tit ?? []).map(t => [t.id, t.numero_titolo]));
    const sinistriMap = new Map((sin ?? []).map(s => [s.id, s.numero_sinistro]));

    // RLS già limita; costruiamo OR per entità del cliente
    const { data } = await supabase
      .from("documenti")
      .select("*")
      .or([
        `and(entita_tipo.eq.cliente,entita_id.in.(${myIds.join(",")}))`,
        titoliIds.length ? `and(entita_tipo.eq.titolo,entita_id.in.(${titoliIds.join(",")}))` : null,
        sinistriIds.length ? `and(entita_tipo.eq.sinistro,entita_id.in.(${sinistriIds.join(",")}))` : null,
      ].filter(Boolean).join(","))
      .order("created_at", { ascending: false });

    const enriched = (data ?? []).map(d => ({
      ...d,
      entita_label: d.entita_tipo === "titolo" ? titoliMap.get(d.entita_id) : d.entita_tipo === "sinistro" ? sinistriMap.get(d.entita_id) : null,
    }));
    setDocs(enriched);
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
      if (filtroEntita && d.entita_tipo !== filtroEntita) return false;
      if (filtroTipo && d.categoria !== filtroTipo) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${d.nome_file ?? ""} ${d.categoria ?? ""} ${d.entita_label ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docs, filtroEntita, filtroTipo, search]);

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

  const filtriAttivi = search || filtroEntita || filtroTipo;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-foreground">I tuoi Documenti</h1>
        {clienteId && (
          <Button onClick={() => setUploadOpen(true)} className="bg-teal-700 hover:bg-teal-800 gap-1.5">
            <Upload className="h-4 w-4" /> Carica documento
          </Button>
        )}
      </div>

      {/* Filtri */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="Cerca per nome / categoria" value={search} onChange={(e) => setSearch(e.target.value)} />
            <SearchableSelect
              options={[
                { value: "", label: "Tutte le entità" },
                { value: "cliente", label: "Generali (ente)" },
                { value: "titolo", label: "Polizze" },
                { value: "sinistro", label: "Sinistri" },
              ]}
              value={filtroEntita}
              onValueChange={setFiltroEntita}
              placeholder="Entità"
            />
            <SearchableSelect options={tipiOptions} value={filtroTipo} onValueChange={setFiltroTipo} placeholder="Tipologia" />
            {filtriAttivi && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFiltroEntita(""); setFiltroTipo(""); }} className="gap-1.5 self-center">
                <X className="h-4 w-4" /> Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun documento trovato.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {filtered.map((d, idx) => {
              const ent = ENTITA_LABEL[d.entita_tipo] ?? { label: d.entita_tipo, color: "bg-muted" };
              return (
                <div key={d.id} className={`flex items-center justify-between px-4 py-3 border-b border-border last:border-0 gap-3 ${idx % 2 === 0 ? "bg-white" : "bg-muted/30"}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-teal-700 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.nome_file}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={`text-[10px] ${ent.color}`}>
                          {ent.label}{d.entita_label ? ` · ${d.entita_label}` : ""}
                        </Badge>
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
              );
            })}
          </CardContent>
        </Card>
      )}

      {clienteId && (
        <UploadDocClienteDialog open={uploadOpen} onOpenChange={setUploadOpen} clienteAnagraficaId={clienteId} onUploaded={load} />
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
