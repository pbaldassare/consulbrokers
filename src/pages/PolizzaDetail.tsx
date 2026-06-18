import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { ArrowLeft, FileText, Loader2, Pencil, Pause, Play, Replace, XCircle, Ban, Undo2, FilePlus2, ScrollText } from "lucide-react";
import { fmtEuro } from "@/lib/formatCurrency";
import { format } from "date-fns";
import { toast } from "sonner";
import { SospensionePolizzaDialog } from "@/components/polizze/SospensionePolizzaDialog";
import { RiattivazionePolizzaDialog } from "@/components/polizze/RiattivazionePolizzaDialog";
import { SostituzionePolizzaDialog } from "@/components/polizze/SostituzionePolizzaDialog";
import { EstinzionePolizzaDialog } from "@/components/polizze/EstinzionePolizzaDialog";
import { StornoTitoloDialog } from "@/components/polizze/StornoTitoloDialog";
import { annullaPolizza } from "@/lib/annullaPolizza";

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");

const STATO_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  attiva: "default",
  sospesa: "outline",
  annullata: "destructive",
  scaduta: "secondary",
  sostituita: "secondary",
};

const STATO_QUIETANZA: Record<string, { label: string; cls: string }> = {
  da_incassare: { label: "Da incassare", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  incassato: { label: "Incassata", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  sospesa: { label: "Sospesa", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  annullata: { label: "Annullata", cls: "bg-red-100 text-red-800 border-red-300" },
  stornata: { label: "Stornata", cls: "bg-orange-100 text-orange-800 border-orange-300" },
};

export default function PolizzaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [sospensioneOpen, setSospensioneOpen] = useState(false);
  const [riattivazioneOpen, setRiattivazioneOpen] = useState(false);
  const [sostituzioneOpen, setSostituzioneOpen] = useState(false);
  const [estinzioneOpen, setEstinzioneOpen] = useState(false);
  const [stornoOpen, setStornoOpen] = useState(false);
  const [annullaLoading, setAnnullaLoading] = useState(false);

  const { data: polizza, isLoading: loadingP } = useQuery({
    queryKey: ["polizza", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("polizze")
        .select(`
          *,
          clienti:cliente_anagrafica_id (id, nome, cognome, ragione_sociale, codice_fiscale, partita_iva, codice),
          compagnie:compagnia_id (id, nome, codice),
          rami:ramo_id (id, codice, descrizione)
        `)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: quietanze = [], isLoading: loadingQ } = useQuery({
    queryKey: ["polizza-quietanze", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quietanze")
        .select("id, numero_rata, numero_rate_totali, garanzia_da, garanzia_a, data_scadenza, premio_lordo, stato, data_messa_cassa, data_incasso, importo_incassato, titolo_id")
        .eq("polizza_id", id!)
        .order("numero_rata", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["polizza", id] });
    qc.invalidateQueries({ queryKey: ["polizza-quietanze", id] });
  };

  if (loadingP) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Caricamento polizza…
      </div>
    );
  }
  if (!polizza) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Polizza non trovata.</p>
        <Button onClick={() => navigate("/portafoglio/attive")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Torna al portafoglio
        </Button>
      </div>
    );
  }

  const cliente: any = (polizza as any).clienti;
  const compagnia: any = (polizza as any).compagnie;
  const ramo: any = (polizza as any).rami;
  const clienteNome = cliente?.ragione_sociale || [cliente?.cognome, cliente?.nome].filter(Boolean).join(" ") || "—";
  const titoloMadreId: string | null = (polizza as any).titolo_madre_id;
  const stato = polizza.stato as string;
  const locked = ["annullata", "estinta", "sostituita"].includes(stato);
  const numPol = polizza.numero_polizza || "";

  async function handleAnnulla() {
    if (!titoloMadreId) {
      toast.error("Polizza senza titolo collegato: impossibile annullare.");
      return;
    }
    setAnnullaLoading(true);
    const res = await annullaPolizza(titoloMadreId);
    setAnnullaLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Errore durante l'annullamento");
      return;
    }
    toast.success(`Polizza annullata · ${res.quietanzeEliminate ?? 0} quietanze rimosse`);
    refreshAll();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button onClick={() => navigate(-1)} className="hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Indietro
            </button>
            <span>·</span>
            <span>Polizza contratto</span>
          </div>
          <h1 className="text-2xl font-bold">
            {numPol || "—"}{" "}
            <Badge variant={STATO_VARIANT[stato] || "secondary"} className="ml-2 align-middle">
              {stato}
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            {clienteNome} · {compagnia?.nome || "—"} · {ramo?.descrizione || ramo?.codice || "—"}
          </p>
        </div>
        {titoloMadreId && (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/titoli/${titoloMadreId}`}>
              <Pencil className="h-4 w-4 mr-2" /> Apri editing completo
            </Link>
          </Button>
        )}
      </div>

      {/* === BARRA AZIONI === */}
      <Card>
        <CardContent className="py-3 flex flex-wrap gap-2">
          {stato === "sospesa" ? (
            <Button size="sm" onClick={() => setRiattivazioneOpen(true)} disabled={!titoloMadreId}>
              <Play className="h-4 w-4 mr-1" /> Riattiva
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setSospensioneOpen(true)} disabled={locked || !titoloMadreId}>
              <Pause className="h-4 w-4 mr-1" /> Sospendi
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setSostituzioneOpen(true)} disabled={locked || !titoloMadreId}>
            <Replace className="h-4 w-4 mr-1" /> Sostituisci
          </Button>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setEstinzioneOpen(true)} disabled={locked || !titoloMadreId}>
            <XCircle className="h-4 w-4 mr-1" /> Estingui
          </Button>
          <Button size="sm" variant="outline" onClick={() => setStornoOpen(true)} disabled={locked || !titoloMadreId}>
            <Undo2 className="h-4 w-4 mr-1" /> Storno
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(numPol)}&clienteId=${encodeURIComponent(cliente?.id || "")}&titoloId=${encodeURIComponent(titoloMadreId || "")}`)} disabled={!titoloMadreId}>
            <FilePlus2 className="h-4 w-4 mr-1" /> Appendici
          </Button>
          {polizza.regolazione && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/portafoglio/immissione?mode=regolazione&titoloMadreId=${titoloMadreId}&quietanzaRefId=${titoloMadreId}`)} disabled={!titoloMadreId}>
              <ScrollText className="h-4 w-4 mr-1" /> Regolazione
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate(`/portafoglio/doc-precontrattuale?titoloId=${encodeURIComponent(titoloMadreId || "")}&clienteId=${encodeURIComponent(cliente?.id || "")}`)} disabled={!titoloMadreId}>
            <FileText className="h-4 w-4 mr-1" /> Precontrattuale
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={locked || !titoloMadreId || annullaLoading}>
                <Ban className="h-4 w-4 mr-1" /> Annulla polizza
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Conferma annullamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Verranno rimosse tutte le quietanze, provvigioni, rimesse e movimenti collegati a questa polizza.
                  L'operazione è irreversibile. La polizza resterà in stato "annullata" come ancora di log.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleAnnulla}>
                  {annullaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conferma"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Tabs defaultValue="contratto" className="w-full">
        <TabsList>
          <TabsTrigger value="contratto">Contratto</TabsTrigger>
          <TabsTrigger value="quietanze">Quietanze ({quietanze.length})</TabsTrigger>
        </TabsList>

        {/* === CONTRATTO === */}
        <TabsContent value="contratto" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Anagrafica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Cliente" value={clienteNome} />
                <Field label="Codice cliente" value={cliente?.codice} />
                <Field label="C.F. / P.IVA" value={cliente?.codice_fiscale || cliente?.partita_iva} />
                <Field label="Compagnia" value={compagnia?.nome} />
                <Field label="Ramo" value={ramo ? `${ramo.codice} · ${ramo.descrizione}` : "—"} />
                <Field label="Prodotto" value={polizza.prodotto_nome} />
                <Field label="Targa / Telaio" value={polizza.targa_telaio} />
                <Field label="CIG" value={polizza.cig_rif} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Durata & rinnovo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Decorrenza" value={fmtDate(polizza.durata_da)} />
                <Field label="Scadenza" value={fmtDate(polizza.durata_a)} />
                <Field label="Anni durata" value={polizza.anni_durata?.toString()} />
                <Field label="Frazionamento" value={polizza.frazionamento} />
                <Field label="Tacito rinnovo" value={polizza.tacito_rinnovo ? "Sì" : "No"} />
                <Field label="Disdetta (mesi)" value={polizza.disdetta_mesi?.toString()} />
                <Field label="Regolazione" value={polizza.regolazione ? "Sì" : "No"} />
                <Field label="Indicizzata" value={polizza.indicizzata ? "Sì" : "No"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Premio annuo (riferimento)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Premio lordo" value={fmtEuro(polizza.premio_annuo_lordo)} />
                <Field label="Premio netto" value={fmtEuro(polizza.premio_annuo_netto)} />
                <Field label="Tasse" value={fmtEuro(polizza.tasse_annue)} />
                <Field label="Addizionali" value={fmtEuro(polizza.addizionali_annue)} />
                <Field label="SSN" value={fmtEuro(polizza.ssn_annuo)} />
                <Field label="Provv. firma" value={fmtEuro(polizza.provvigioni_annue_firma)} />
                <Field label="Provv. quietanza" value={fmtEuro(polizza.provvigioni_annue_quietanza)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stato contratto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Stato" value={stato} />
                <Field label="Data sospensione" value={fmtDate(polizza.data_sospensione)} />
                <Field label="Data riattivazione" value={fmtDate(polizza.data_riattivazione)} />
                <Field label="Data annullamento" value={fmtDate(polizza.data_annullamento)} />
                <Field label="Motivo annullamento" value={polizza.motivo_annullamento} />
                <Field label="Tipo portafoglio" value={polizza.tipo_portafoglio} />
                <Field label="Vincolo" value={polizza.vincolo} />
                {polizza.note && (
                  <div className="pt-2 border-t mt-2">
                    <div className="text-xs text-muted-foreground mb-1">Note</div>
                    <div className="whitespace-pre-wrap">{polizza.note}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === QUIETANZE === */}
        <TabsContent value="quietanze" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {loadingQ ? (
                <div className="p-6 text-center text-muted-foreground">Caricamento quietanze…</div>
              ) : quietanze.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Nessuna quietanza generata</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rata</TableHead>
                      <TableHead>Decorrenza</TableHead>
                      <TableHead>Scadenza</TableHead>
                      <TableHead className="text-right">Premio lordo</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Messa a cassa</TableHead>
                      <TableHead>Incassata</TableHead>
                      <TableHead className="text-right">Incassato</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quietanze.map((q: any) => {
                      const st = STATO_QUIETANZA[q.stato] || { label: q.stato, cls: "" };
                      return (
                        <TableRow key={q.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/quietanze/${q.id}`)}>
                          <TableCell className="font-medium">
                            {q.numero_rata}{q.numero_rate_totali ? ` / ${q.numero_rate_totali}` : ""}
                          </TableCell>
                          <TableCell>{fmtDate(q.garanzia_da)}</TableCell>
                          <TableCell>{fmtDate(q.garanzia_a || q.data_scadenza)}</TableCell>
                          <TableCell className="text-right">{fmtEuro(q.premio_lordo)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                          </TableCell>
                          <TableCell>{fmtDate(q.data_messa_cassa)}</TableCell>
                          <TableCell>{fmtDate(q.data_incasso)}</TableCell>
                          <TableCell className="text-right">{q.importo_incassato != null ? fmtEuro(q.importo_incassato) : "—"}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {q.titolo_id && (
                              <Button size="sm" variant="ghost" asChild>
                                <Link to={`/titoli/${q.titolo_id}`}>
                                  <FileText className="h-3 w-3" />
                                </Link>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {titoloMadreId && (
        <>
          <SospensionePolizzaDialog open={sospensioneOpen} onOpenChange={setSospensioneOpen} titoloId={titoloMadreId} numeroPolizza={numPol} onDone={refreshAll} />
          <RiattivazionePolizzaDialog open={riattivazioneOpen} onOpenChange={setRiattivazioneOpen} titoloId={titoloMadreId} numeroPolizza={numPol} onDone={refreshAll} />
          <SostituzionePolizzaDialog open={sostituzioneOpen} onOpenChange={setSostituzioneOpen} titoloId={titoloMadreId} numeroPolizza={numPol} onDone={refreshAll} />
          <EstinzionePolizzaDialog open={estinzioneOpen} onOpenChange={setEstinzioneOpen} titoloId={titoloMadreId} numeroPolizza={numPol} onDone={refreshAll} />
          <StornoTitoloDialog open={stornoOpen} onOpenChange={setStornoOpen} titoloId={titoloMadreId} numeroPolizza={numPol} onDone={refreshAll} />
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || value === 0 ? value : "—"}</span>
    </div>
  );
}
