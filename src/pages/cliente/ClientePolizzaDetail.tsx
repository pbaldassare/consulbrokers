import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Shield, Building2, Calendar, CreditCard, FileText, Upload, User, Eye, Trash2, AlertTriangle, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import UploadDocPolizzaDialog from "@/components/cliente/UploadDocPolizzaDialog";
import DocPreviewDialog from "@/components/cliente/DocPreviewDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fmtEuro as fmt } from "@/lib/formatCurrency";

const statoBadge: Record<string, string> = {
  attivo: "bg-emerald-100 text-emerald-800",
  scaduto: "bg-red-100 text-red-800",
  sospeso: "bg-yellow-100 text-yellow-800",
  incassato: "bg-blue-100 text-blue-800",
};


const fmtDate = (d: string | null) => d ? format(new Date(d), "dd MMM yyyy", { locale: it }) : "—";

const ClientePolizzaDetail = () => {
  const { id } = useParams();
  const [titolo, setTitolo] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [sinistri, setSinistri] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [deleteDoc, setDeleteDoc] = useState<any>(null);

  const refreshDocs = async () => {
    if (!id) return;
    const { data } = await supabase.from("documenti").select("*").eq("entita_tipo", "titolo").eq("entita_id", id).order("created_at", { ascending: false });
    setDocs(data ?? []);
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("titoli").select("*, compagnie(nome), rami(descrizione)").eq("id", id).maybeSingle(),
      supabase.from("documenti").select("*").eq("entita_tipo", "titolo").eq("entita_id", id).order("created_at", { ascending: false }),
      supabase.from("sinistri").select("id, numero_sinistro, stato, data_evento, ramo_sinistro").eq("titolo_id", id).order("data_apertura", { ascending: false }),
    ]).then(([tRes, dRes, sRes]) => {
      setTitolo(tRes.data);
      setDocs(dRes.data ?? []);
      setSinistri(sRes.data ?? []);
      setLoading(false);
    });
  }, [id]);

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from(doc.bucket_name).createSignedUrl(doc.path_storage, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (!titolo) return <p className="text-muted-foreground">Polizza non trovata.</p>;

  const rows = [
    { label: "Agenzia", value: titolo.compagnie?.nome, icon: Building2 },
    { label: "Ramo", value: titolo.rami?.descrizione, icon: Shield },
    { label: "Decorrenza", value: fmtDate(titolo.durata_da), icon: Calendar },
    { label: "Scadenza", value: fmtDate(titolo.data_scadenza), icon: Calendar },
    { label: "Periodicità", value: titolo.periodicita, icon: Calendar },
    { label: "Premio Netto", value: titolo.premio_netto ? fmt(titolo.premio_netto) : "—", icon: CreditCard },
    { label: "Tasse", value: titolo.tasse ? fmt(titolo.tasse) : "—", icon: CreditCard },
    { label: "Premio Lordo", value: titolo.premio_lordo ? fmt(titolo.premio_lordo) : "—", icon: CreditCard },
    { label: "Data Incasso", value: fmtDate(titolo.data_incasso), icon: Calendar },
  ];

  return (
    <div className="space-y-5">
      <Link to="/cliente/polizze">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"><ArrowLeft className="h-4 w-4" />Torna alle polizze</Button>
      </Link>

      {/* Header */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Polizza</p>
              <h2 className="text-2xl font-bold text-foreground">{titolo.numero_titolo}</h2>
              <p className="text-sm text-teal-700 font-medium mt-1">{titolo.rami?.descrizione ?? "—"}</p>
            </div>
            <Badge className={`text-sm px-4 py-1.5 ${statoBadge[titolo.stato] ?? "bg-muted"}`}>{titolo.stato?.toUpperCase()}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Dati Polizza */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-teal-600" />Dati Polizza</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map(r => (
              <div key={r.label} className="flex items-start gap-3 py-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <r.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className="text-sm font-semibold text-foreground">{r.value || "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Copertura */}
      {titolo.descrizione_polizza && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-teal-600" />Descrizione Copertura</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed">{titolo.descrizione_polizza}</p>
          </CardContent>
        </Card>
      )}

      {/* Documenti */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Documenti allegati</CardTitle>
          {titolo.cliente_anagrafica_id && (
            <Button size="sm" className="bg-teal-700 hover:bg-teal-800 gap-1.5" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Carica documento
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun documento disponibile.</p>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.nome_file}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {d.categoria && <Badge variant="secondary" className="text-[10px]">{d.categoria}</Badge>}
                      {d.caricato_da_cliente && (
                        <Badge className="bg-teal-100 text-teal-800 text-[10px] gap-1"><User className="h-3 w-3" />Caricato da te</Badge>
                      )}
                      {d.created_at && (
                        <span className="text-[10px] text-muted-foreground">{format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: it })}</span>
                      )}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sinistri collegati */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" /> Sinistri collegati
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sinistri.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun sinistro collegato a questa polizza.</p>
          ) : (
            <div className="space-y-2">
              {sinistri.map((s) => (
                <Link
                  key={s.id}
                  to={`/cliente/sinistri/${s.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded border hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">{s.ramo_sinistro || "—"}</Badge>
                    <span className="font-medium truncate">{s.numero_sinistro || "—"}</span>
                    <span className="text-xs text-muted-foreground">{s.stato?.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    {s.data_evento && <span>{format(new Date(s.data_evento), "dd/MM/yyyy")}</span>}
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
            <AlertDialogAction
              onClick={async () => {
                if (!deleteDoc) return;
                try {
                  await supabase.storage.from(deleteDoc.bucket_name).remove([deleteDoc.path_storage]);
                  const { error } = await supabase.from("documenti").delete().eq("id", deleteDoc.id);
                  if (error) throw error;
                  toast.success("Documento eliminato");
                  setDeleteDoc(null);
                  refreshDocs();
                } catch (e: any) {
                  toast.error(e.message ?? "Errore eliminazione");
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {titolo.cliente_anagrafica_id && (
        <UploadDocPolizzaDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          titoloId={titolo.id}
          clienteAnagraficaId={titolo.cliente_anagrafica_id}
          onUploaded={refreshDocs}
        />
      )}
    </div>
  );
};

export default ClientePolizzaDetail;
