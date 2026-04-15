import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, FileText, Percent, Clock, ExternalLink, ChevronDown, Calendar, Shield, DollarSign, RefreshCw, LayoutGrid, List, Users, ShieldCheck, StickyNote, Car, UserCheck, CheckSquare, Copy, ArrowRightLeft, XCircle, Download, Eye, Trash2, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/SearchableSelect";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const fmt = (v: any) => v ?? "—";
const fmtDate = (v: string | null) => v ? format(new Date(v), "dd/MM/yyyy", { locale: it }) : "—";
const fmtEuro = (v: number | null) => v != null ? `€ ${v.toFixed(2)}` : "—";
const fmtBool = (v: boolean | null) => v ? "Sì" : "No";

const FieldRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between py-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-mono text-right">{value}</span>
  </div>
);

const SectionCollapsible = ({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 px-4 py-2.5 bg-primary/5 border border-border rounded-t-lg hover:bg-primary/10 transition-colors">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold uppercase text-primary">{title}</span>
          <ChevronDown className={`w-4 h-4 ml-auto text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-t-0 border-border rounded-b-lg p-4">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const TitoloDetail = () => {
  // v2 - regolazione editabile
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: titolo, isLoading } = useQuery({
    queryKey: ["titolo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("*, prodotti(nome_prodotto, compagnie(nome)), uffici(nome_ufficio), produttore:profiles!titoli_produttore_id_fkey(nome, cognome, ruolo), cliente:profiles!titoli_cliente_id_fkey(nome, cognome), cliente_anagrafica:clienti!titoli_cliente_anagrafica_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale, attivita, gruppo_statistico, gruppo_finanziario_id, gruppi_finanziari(nome)), compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome, codice), ramo:rami!titoli_ramo_id_fkey(id, codice, descrizione), commerciale:profiles!titoli_commerciale_id_fkey(nome, cognome, ruolo)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: movimentiPolizza = [] } = useQuery({
    queryKey: ["movimenti-polizza", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimenti_polizza")
        .select("*")
        .eq("titolo_id", id!)
        .order("riga", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: veicolo } = useQuery({
    queryKey: ["veicolo-polizza", id],
    queryFn: async () => {
      const { data } = await supabase.from("veicoli_polizza").select("*").eq("titolo_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: premiGaranzia = [] } = useQuery({
    queryKey: ["premi-garanzia", id],
    queryFn: async () => {
      const { data } = await supabase.from("premi_garanzia_polizza").select("*").eq("titolo_id", id!).order("ordine");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: conducente } = useQuery({
    queryKey: ["conducente-polizza", id],
    queryFn: async () => {
      const { data } = await supabase.from("conducenti_polizza").select("*").eq("titolo_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: provvigioni = [] } = useQuery({
    queryKey: ["provvigioni", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provvigioni_generate")
        .select("*, profiles(nome, cognome)")
        .eq("titolo_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: riparto = [] } = useQuery({
    queryKey: ["riparto", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dettaglio_riparto")
        .select("*, compagnie(nome, codice)")
        .eq("titolo_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: appendiciPolizza = [] } = useQuery({
    queryKey: ["appendici-polizza", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appendici_polizza")
        .select("*")
        .eq("titolo_id", id!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // --- Regolazione edit state ---
  const [editingReg, setEditingReg] = useState(false);
  const [regForm, setRegForm] = useState({
    regolazione: false, periodicita: "", tipo_scadenza: "",
    giorni_presentazione: 0, tipo_lettera_regolazione: "", libro_matricola: "",
  });

  // --- Commerciale edit state ---
  const [editingComm, setEditingComm] = useState(false);
  const [commForm, setCommForm] = useState({ anagrafica_commerciale_id: "" as string | null, percentuale_commerciale: 100 });

  const { data: anagraficheComm = [] } = useQuery({
    queryKey: ["anagrafiche-commerciali"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali" as any)
        .select("id, ragione_sociale, cognome, nome, percentuale_base, tipo")
        .eq("attivo", true)
        .in("tipo", ["corrispondente", "account_executive", "executive", "produttore_sede"])
        .order("ragione_sociale");
      return (data || []).map((a: any) => ({
        value: a.id,
        label: a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim(),
        percentuale_base: a.percentuale_base ?? 0,
      }));
    },
    enabled: editingComm,
  });

  const startEditComm = () => {
    if (titolo) {
      setCommForm({
        anagrafica_commerciale_id: (titolo as any).anagrafica_commerciale_id ?? null,
        percentuale_commerciale: titolo.percentuale_commerciale ?? 100,
      });
    }
    setEditingComm(true);
  };

  const saveCommMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("titoli")
        .update({
          anagrafica_commerciale_id: commForm.anagrafica_commerciale_id || null,
          percentuale_commerciale: commForm.percentuale_commerciale,
        } as any)
        .eq("id", id!);
      if (error) throw error;
      // Ricalcola provvigioni se incassato
      if (titolo?.stato === "incassato") {
        await supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: id } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni", id] });
      toast.success("Commerciale aggiornato");
      setEditingComm(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEditReg = () => {
    if (titolo) {
      setRegForm({
        regolazione: titolo.regolazione ?? false,
        periodicita: titolo.periodicita ?? "",
        tipo_scadenza: titolo.tipo_scadenza ?? "",
        giorni_presentazione: titolo.giorni_presentazione ?? 0,
        tipo_lettera_regolazione: titolo.tipo_lettera_regolazione ?? "",
        libro_matricola: titolo.libro_matricola ?? "",
      });
    }
    setEditingReg(true);
  };

  const saveRegMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("titoli")
        .update({
          regolazione: regForm.regolazione,
          periodicita: regForm.periodicita || null,
          tipo_scadenza: regForm.tipo_scadenza || null,
          giorni_presentazione: regForm.giorni_presentazione,
          tipo_lettera_regolazione: regForm.tipo_lettera_regolazione || null,
          libro_matricola: regForm.libro_matricola || null,
        })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      toast.success("Regolazione aggiornata");
      setEditingReg(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const periodicitaOpts = [
    { value: "annuale", label: "Annuale" },
    { value: "semestrale", label: "Semestrale" },
    { value: "trimestrale", label: "Trimestrale" },
    { value: "mensile", label: "Mensile" },
  ];
  const tipoScadenzaOpts = [
    { value: "no_scadenza", label: "No scadenza" },
    { value: "a_scadenza", label: "A scadenza" },
  ];
  const tipoLetteraOpts = [
    { value: "standard", label: "Standard" },
    { value: "personalizzata", label: "Personalizzata" },
    { value: "nessuna", label: "Nessuna" },
  ];

  const changeStatoMutation = useMutation({
    mutationFn: async (nuovoStato: string) => {
      const vecchioStato = titolo?.stato;
      const today = new Date().toISOString().slice(0, 10);
      const updatePayload: any = { stato: nuovoStato, updated_at: new Date().toISOString() };
      if (nuovoStato === "incassato") {
        updatePayload.data_messa_cassa = today;
        updatePayload.data_pagamento = today;
        updatePayload.data_decorrenza_rinnovo = today;
      } else if (nuovoStato === "attivo" && vecchioStato === "incassato") {
        updatePayload.data_messa_cassa = null;
        updatePayload.data_pagamento = null;
        updatePayload.data_decorrenza_rinnovo = null;
      }
      const { error } = await supabase.from("titoli").update(updatePayload).eq("id", id!);
      if (error) throw error;
      if (user) {
        await logAttivita({ azione: "cambio_stato_titolo", entita_tipo: "titolo", entita_id: id!, dettagli_json: { stato_precedente: vecchioStato, nuovo_stato: nuovoStato } });
      }
      if (nuovoStato === "incassato") {
        await supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: id } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni", id] });
      toast.success("Stato aggiornato");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const updateDateMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string | null }) => {
      const { error } = await supabase.from("titoli").update({ [field]: value || null, updated_at: new Date().toISOString() } as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      toast.success("Data aggiornata");
    },
    onError: () => toast.error("Errore aggiornamento data"),
  });

  if (isLoading) return <p className="text-muted-foreground p-8">Caricamento...</p>;
  if (!titolo) return <p className="text-destructive p-8">Titolo non trovato</p>;

  const t = titolo as any;

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/titoli")}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Polizza {t.numero_titolo || t.id.slice(0, 8)}</h1>
          <p className="text-muted-foreground text-sm">{t.prodotti?.nome_prodotto} — {(t.compagnia_diretta as any)?.nome || t.prodotti?.compagnie?.nome || "N/D"}</p>
        </div>
        <Badge variant={t.stato === "incassato" ? "default" : t.stato === "stornato" ? "destructive" : "secondary"} className="ml-auto text-sm">
          {t.stato}
        </Badge>
      </div>

      {/* Operazioni — nascosto per polizze storico */}
      {!(t.stato === "scaduto" || t.stato === "sospeso" || (t.stato === "attivo" && t.garanzia_a && new Date(t.garanzia_a) < new Date())) && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Operazioni</CardTitle></CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/sospensione?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
              <Clock className="w-4 h-4 mr-1" /> Sospensione
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/riattivazione?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
              <CheckSquare className="w-4 h-4 mr-1" /> Riattivazione
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/duplicazione?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
              <Copy className="w-4 h-4 mr-1" /> Duplicazione
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
              <FileText className="w-4 h-4 mr-1" /> Appendici
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/portafoglio/storno?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
              <ArrowRightLeft className="w-4 h-4 mr-1" /> Storno
            </Button>
            <Button variant="outline" size="sm" onClick={() => document.getElementById("regolazione-section")?.scrollIntoView({ behavior: "smooth" })}>
              <RefreshCw className="w-4 h-4 mr-1" /> Regolazione
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10">
                  <XCircle className="w-4 h-4 mr-1" /> Annullamento
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Conferma Annullamento</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sei sicuro di voler annullare la polizza {t.numero_titolo}? Questa azione è irreversibile.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={() => changeStatoMutation.mutate("annullato")} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Conferma Annullamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* MESSA A CASSA */}
      {(t.stato === "attivo" || t.stato === "incassato") && (
        <Card className={t.stato === "incassato" ? "border-yellow-400 bg-yellow-50" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Messa a Cassa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              {t.stato === "incassato" ? (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Data Messa a Cassa</label>
                    <Input type="date" className="mt-1" value={t.data_messa_cassa || ""} onChange={(e) => updateDateMutation.mutate({ field: "data_messa_cassa", value: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Data Pagamento</label>
                    <Input type="date" className="mt-1" value={t.data_pagamento || ""} onChange={(e) => updateDateMutation.mutate({ field: "data_pagamento", value: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Data Decorrenza Rinnovo</label>
                    <Input type="date" className="mt-1" value={t.data_decorrenza_rinnovo || ""} onChange={(e) => updateDateMutation.mutate({ field: "data_decorrenza_rinnovo", value: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <FieldRow label="Data Messa a Cassa" value="—" />
                  <FieldRow label="Data Pagamento" value="—" />
                  <FieldRow label="Data Decorrenza Rinnovo" value="—" />
                </>
              )}
            </div>
            {t.stato === "attivo" && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => changeStatoMutation.mutate("incassato")} disabled={changeStatoMutation.isPending}>
                <CheckSquare className="w-4 h-4 mr-1" /> Metti a Cassa
              </Button>
            )}
            {t.stato === "incassato" && (
              <Button variant="outline" size="sm" className="text-orange-600 border-orange-400 hover:bg-orange-50" onClick={() => changeStatoMutation.mutate("attivo")} disabled={changeStatoMutation.isPending}>
                <XCircle className="w-4 h-4 mr-1" /> Annulla Incasso
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* CONTRATTO */}
      <SectionCollapsible title="Contratto" icon={FileText}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
          <FieldRow label="Compagnia" value={
            <span>{(t.compagnia_diretta as any)?.codice || ""} - {(t.compagnia_diretta as any)?.nome || t.prodotti?.compagnie?.nome || "—"}</span>
          } />
          <FieldRow label="Ramo" value={`${(t.ramo as any)?.codice || ""} ${(t.ramo as any)?.descrizione || "—"}`} />
          <FieldRow label="Prodotto" value={fmt(t.prodotti?.nome_prodotto)} />
          <FieldRow label="Specialist" value={fmt(t.specialist)} />
          <FieldRow label="Tipo Portafoglio" value={fmt(t.tipo_portafoglio)} />
          <FieldRow label="Numero Polizza" value={fmt(t.numero_titolo)} />
          <FieldRow label="Riga" value={fmt(t.riga)} />
          <FieldRow label="Appendice" value={fmt(t.appendice)} />
          {t.cliente_anagrafica && (
            <>
              <div className="col-span-2 flex justify-between py-1">
                <span className="text-xs text-muted-foreground">Cliente</span>
                <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate(`/archivi/clienti/${(t.cliente_anagrafica as any).id}`)}>
                  {(t.cliente_anagrafica as any).tipo_cliente === "privato"
                    ? `${(t.cliente_anagrafica as any).cognome || ""} ${(t.cliente_anagrafica as any).nome || ""}`.trim()
                    : (t.cliente_anagrafica as any).ragione_sociale || "—"}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
              <FieldRow label="Attività" value={fmt((t.cliente_anagrafica as any).attivita)} />
              <FieldRow label="Gr. Finanziario" value={fmt((t.cliente_anagrafica as any).gruppi_finanziari?.nome)} />
              <FieldRow label="Gr. Statistico" value={fmt((t.cliente_anagrafica as any).gruppo_statistico)} />
            </>
          )}
          <FieldRow label="Produttore" value={t.produttore ? `${(t.produttore as any).nome} ${(t.produttore as any).cognome}` : "—"} />
          <FieldRow label="Ufficio" value={fmt(t.uffici?.nome_ufficio)} />
          <FieldRow label="CIG/Rif." value={fmt(t.cig_rif)} />
          <FieldRow label="Vincolo" value={fmt(t.vincolo)} />
          <FieldRow label="Targa/Telaio" value={fmt(t.targa_telaio)} />
          {t.descrizione_polizza && <div className="col-span-full"><FieldRow label="Descrizione" value={t.descrizione_polizza} /></div>}
        </div>
      </SectionCollapsible>

      {/* PERIODO */}
      <SectionCollapsible title="Periodo" icon={Calendar}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
          <FieldRow label="Durata Da" value={fmtDate(t.durata_da)} />
          <FieldRow label="Durata A" value={fmtDate(t.durata_a)} />
          <FieldRow label="Anni Durata" value={fmt(t.anni_durata)} />
          <FieldRow label="Rate" value={fmt(t.rate)} />
          <FieldRow label="Garanzia Da" value={fmtDate(t.garanzia_da)} />
          <FieldRow label="Garanzia A" value={fmtDate(t.garanzia_a)} />
          <FieldRow label="Data Competenza" value={fmtDate(t.data_competenza)} />
          <FieldRow label="Data Scadenza" value={fmtDate(t.data_scadenza)} />
          <FieldRow label="Limite Mora" value={fmtDate(t.limite_mora)} />
          <FieldRow label="GG Mora" value={fmt(t.mora_giorni)} />
          <FieldRow label="Tipo Rinnovo" value={fmt(t.tipo_rinnovo)} />
          <FieldRow label="Disdetta (mesi)" value={fmt(t.disdetta_mesi)} />
        </div>
      </SectionCollapsible>

      {/* REGOLAZIONE */}
      <SectionCollapsible title="Regolazione" icon={Shield} defaultOpen={false}>
        <div className="flex justify-end mb-2 gap-2">
          {!editingReg ? (
            <Button variant="ghost" size="sm" onClick={startEditReg}>
              <Pencil className="w-4 h-4 mr-1" /> Modifica
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditingReg(false)}>Annulla</Button>
              <Button size="sm" onClick={() => saveRegMutation.mutate()} disabled={saveRegMutation.isPending}>
                {saveRegMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </>
          )}
        </div>

        {!editingReg ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            <FieldRow label="Regolazione" value={fmtBool(t.regolazione)} />
            <FieldRow label="Periodicità" value={fmt(t.periodicita)} />
            <FieldRow label="Tipo Scadenza" value={fmt(t.tipo_scadenza)} />
            <FieldRow label="GG Presentazione" value={fmt(t.giorni_presentazione)} />
            <FieldRow label="Tipo Lettera" value={fmt(t.tipo_lettera_regolazione)} />
            <FieldRow label="Libro Matricola" value={fmt(t.libro_matricola)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="reg-check"
                checked={regForm.regolazione}
                onCheckedChange={(v) => setRegForm(p => ({ ...p, regolazione: !!v }))}
              />
              <Label htmlFor="reg-check">Regolazione attiva</Label>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Periodicità</Label>
              <SearchableSelect
                options={periodicitaOpts}
                value={regForm.periodicita}
                onValueChange={(v) => setRegForm(p => ({ ...p, periodicita: v }))}
                placeholder="Seleziona periodicità"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo Scadenza</Label>
              <SearchableSelect
                options={tipoScadenzaOpts}
                value={regForm.tipo_scadenza}
                onValueChange={(v) => setRegForm(p => ({ ...p, tipo_scadenza: v }))}
                placeholder="Seleziona tipo scadenza"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">GG Presentazione</Label>
              <Input
                type="number"
                value={regForm.giorni_presentazione}
                onChange={(e) => setRegForm(p => ({ ...p, giorni_presentazione: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo Lettera</Label>
              <SearchableSelect
                options={tipoLetteraOpts}
                value={regForm.tipo_lettera_regolazione}
                onValueChange={(v) => setRegForm(p => ({ ...p, tipo_lettera_regolazione: v }))}
                placeholder="Seleziona tipo lettera"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Libro Matricola</Label>
              <RadioGroup
                value={regForm.libro_matricola}
                onValueChange={(v) => setRegForm(p => ({ ...p, libro_matricola: v }))}
                className="flex gap-4 mt-1"
              >
                {["no", "auto", "altro"].map(v => (
                  <div key={v} className="flex items-center gap-1">
                    <RadioGroupItem value={v} id={`lm-${v}`} />
                    <Label htmlFor={`lm-${v}`} className="text-sm capitalize">{v}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        )}
      </SectionCollapsible>

      {/* COMMERCIALE & SPLIT */}
      <SectionCollapsible title="Commerciale & Provvigioni" icon={Percent}>
        {editingComm ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Commerciale</Label>
                <SearchableSelect
                  options={[{ value: "__none__", label: "— Nessuno (Sede) —" }, ...anagraficheComm]}
                  value={commForm.anagrafica_commerciale_id || "__none__"}
                  onValueChange={(v) => {
                    const sel = anagraficheComm.find((a: any) => a.value === v);
                    setCommForm({
                      anagrafica_commerciale_id: v === "__none__" ? null : v,
                      percentuale_commerciale: sel ? sel.percentuale_base || 100 : 100,
                    });
                  }}
                  placeholder="Seleziona commerciale..."
                />
              </div>
              <div>
                <Label className="text-xs">% Commerciale</Label>
                <Input
                  type="number" min={0} max={100}
                  value={commForm.percentuale_commerciale}
                  onChange={(e) => setCommForm({ ...commForm, percentuale_commerciale: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveCommMutation.mutate()} disabled={saveCommMutation.isPending}>
                {saveCommMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingComm(false)}>Annulla</Button>
            </div>
          </div>
        ) : (
          <>
            {(() => {
              const percComm = t.percentuale_commerciale ?? 100;
              const provvQ = t.provvigioni_quietanza;
              const commName = t.produttore_nome || (t.commerciale ? `${(t.commerciale as any).nome} ${(t.commerciale as any).cognome}` : "Sede");
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                  <FieldRow label="Commerciale" value={commName} />
                  <FieldRow label="% Commerciale" value={`${percComm}%`} />
                  {provvQ != null && provvQ > 0 && (
                    <>
                      <FieldRow label="Provv. Commerciale" value={fmtEuro(provvQ * percComm / 100)} />
                      <FieldRow label="Provv. Consul" value={fmtEuro(provvQ * (100 - percComm) / 100)} />
                    </>
                  )}
                </div>
              );
            })()}
            <Button size="sm" variant="outline" className="mt-3" onClick={startEditComm}>
              <Pencil className="w-3 h-3 mr-1" /> Modifica
            </Button>
          </>
        )}
      </SectionCollapsible>

      {/* IMPORTI */}
      <SectionCollapsible title="Importi" icon={DollarSign}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Firma</h4>
            <div className="space-y-0">
              <FieldRow label="Premio Netto" value={fmtEuro(t.premio_netto)} />
              <FieldRow label="Addizionali" value={fmtEuro(t.addizionali)} />
              <FieldRow label="Tasse" value={fmtEuro(t.tasse)} />
              <FieldRow label="Premio Lordo" value={fmtEuro(t.premio_lordo)} />
              <FieldRow label="Provvigioni" value={fmtEuro(t.provvigioni_firma)} />
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Quietanza</h4>
            <div className="space-y-0">
              <FieldRow label="Premio Netto" value={fmtEuro(t.premio_netto_quietanza)} />
              <FieldRow label="Addizionali" value={fmtEuro(t.addizionali_quietanza)} />
              <FieldRow label="Tasse" value={fmtEuro(t.tasse_quietanza)} />
              <FieldRow label="Totale" value={fmtEuro(t.premio_netto_quietanza != null && t.addizionali_quietanza != null && t.tasse_quietanza != null ? t.premio_netto_quietanza + t.addizionali_quietanza + t.tasse_quietanza : null)} />
              <FieldRow label="Provvigioni" value={fmtEuro(t.provvigioni_quietanza)} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 mt-3 pt-3 border-t">
          <FieldRow label="Valuta" value={fmt(t.valuta)} />
          <FieldRow label="Cambio" value={fmt(t.cambio)} />
          <FieldRow label="Indicizzata" value={fmtBool(t.indicizzata)} />
          <FieldRow label="Rimborso" value={fmtBool(t.rimborso)} />
          <FieldRow label="Pag. Diretto Comp." value={fmtBool(t.pag_diretto_compagnia)} />
          <FieldRow label="Formato Elettronico" value={fmtBool(t.formato_elettronico)} />
          <FieldRow label="Incassato" value={fmtEuro(t.importo_incassato)} />
          <FieldRow label="Data Incasso" value={fmtDate(t.data_incasso)} />
        </div>
      </SectionCollapsible>

      {/* SOSTITUZIONI / STORNI */}
      {(t.sostituisce_polizza || t.storno_polizza) && (
        <SectionCollapsible title="Sostituzioni / Storni" icon={RefreshCw} defaultOpen={false}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
            <FieldRow label="Sostituisce Polizza" value={fmt(t.sostituisce_polizza)} />
            <FieldRow label="Riga" value={fmt(t.sostituisce_riga)} />
            <FieldRow label="Appendice" value={fmt(t.sostituisce_appendice)} />
            <FieldRow label="Storno Polizza" value={fmt(t.storno_polizza)} />
            <FieldRow label="Riga" value={fmt(t.storno_riga)} />
            <FieldRow label="Appendice" value={fmt(t.storno_appendice)} />
          </div>
        </SectionCollapsible>
      )}

      {/* DETTAGLIO RIPARTO */}
      <SectionCollapsible title="Dettaglio Riparto" icon={LayoutGrid} defaultOpen={false}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compagnia</TableHead>
              <TableHead className="text-right">Quota %</TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead className="text-right">Add.</TableHead>
              <TableHead className="text-right">Tasse</TableHead>
              <TableHead className="text-right">Totale</TableHead>
              <TableHead className="text-right">Provv. Netto</TableHead>
              <TableHead>Pag.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(riparto as any[]).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.compagnie?.nome || "—"}</TableCell>
                <TableCell className="text-right font-mono">{r.quota_percentuale}%</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.netto)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.addizionali)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.tasse)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.totale)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.provv_netto)}</TableCell>
                <TableCell>{r.tipo_pagamento || "—"}</TableCell>
              </TableRow>
            ))}
            {riparto.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nessun riparto</TableCell></TableRow>}
          </TableBody>
        </Table>
      </SectionCollapsible>

      {/* DETTAGLIO MOVIMENTI */}
      <SectionCollapsible title="Dettaglio Movimenti" icon={List}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rg</TableHead>
                <TableHead className="w-16">App</TableHead>
                <TableHead>Data Mov.</TableHead>
                <TableHead>Effetto</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Rinnovo</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Val</TableHead>
                <TableHead className="text-right">Premio</TableHead>
                <TableHead className="text-right">Provv.</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-12">Inc</TableHead>
                <TableHead>Copertura</TableHead>
                <TableHead>Incasso</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(movimentiPolizza as any[]).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.riga}</TableCell>
                  <TableCell className="font-mono text-xs">{m.appendice}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_movimento)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_effetto)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_scadenza)}</TableCell>
                  <TableCell className="text-xs">{fmt(m.tipo_rinnovo)}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{fmt(m.descrizione)}</TableCell>
                  <TableCell className="text-xs">{m.valuta || "EUR"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtEuro(m.premio)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtEuro(m.provvigioni)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{m.tipo}</Badge></TableCell>
                  <TableCell className="text-center">{m.incassato ? "✓" : ""}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_copertura)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(m.data_incasso)}</TableCell>
                  <TableCell><Badge variant={m.stato === "attivo" ? "default" : "secondary"} className="text-[10px]">{m.stato}</Badge></TableCell>
                </TableRow>
              ))}
              {movimentiPolizza.length === 0 && (
                <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground">Nessun movimento registrato</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCollapsible>

      {/* === SEZIONI RCA AUTO === */}
      {(veicolo as any) && (
        <SectionCollapsible title="Dati Veicolo" icon={Car}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            <FieldRow label="Settore" value={fmt((veicolo as any).settore)} />
            <FieldRow label="Tipo" value={fmt((veicolo as any).tipo_veicolo)} />
            <FieldRow label="Uso" value={fmt((veicolo as any).uso)} />
            <FieldRow label="Targa" value={fmt((veicolo as any).targa)} />
            <FieldRow label="Marca" value={fmt((veicolo as any).marca)} />
            <FieldRow label="Modello" value={fmt((veicolo as any).modello)} />
            <FieldRow label="Versione" value={fmt((veicolo as any).versione)} />
            <FieldRow label="Veicolo" value={fmt((veicolo as any).veicolo_descrizione)} />
            <FieldRow label="Telaio" value={fmt((veicolo as any).telaio)} />
            <FieldRow label="Immatricolazione" value={fmtDate((veicolo as any).data_immatricolazione)} />
            <FieldRow label="Anno Acquisto" value={fmt((veicolo as any).anno_acquisto)} />
            <FieldRow label="Prov. Circolazione" value={fmt((veicolo as any).provincia_circolazione)} />
            <FieldRow label="Classe B/M" value={fmt((veicolo as any).classe_bm)} />
            <FieldRow label="Massimale 1" value={fmtEuro((veicolo as any).massimale_1)} />
            <FieldRow label="Massimale 2" value={fmtEuro((veicolo as any).massimale_2)} />
            <FieldRow label="Massimale 3" value={fmtEuro((veicolo as any).massimale_3)} />
            <FieldRow label="Peius" value={fmtBool((veicolo as any).peius)} />
            <FieldRow label="Franchigia" value={fmtEuro((veicolo as any).franchigia)} />
            <FieldRow label="Temporanea" value={fmtBool((veicolo as any).temporanea)} />
            <FieldRow label="Carico/Scarico" value={fmtBool((veicolo as any).carico_scarico)} />
            <FieldRow label="CV" value={fmt((veicolo as any).cv)} />
            <FieldRow label="KW" value={fmt((veicolo as any).kw)} />
            <FieldRow label="CC" value={fmt((veicolo as any).cc)} />
            <FieldRow label="Posti" value={fmt((veicolo as any).posti)} />
            <FieldRow label="Peso Mot." value={fmt((veicolo as any).peso_motrice)} />
            <FieldRow label="Peso Rim." value={fmt((veicolo as any).peso_rimorchio)} />
            <FieldRow label="Peso Tot." value={fmt((veicolo as any).peso_totale)} />
            <FieldRow label="Tipologia Guida" value={fmt((veicolo as any).tipologia_guida)} />
            <FieldRow label="Alimentazione" value={fmt((veicolo as any).tipo_alimentazione)} />
          </div>
        </SectionCollapsible>
      )}

      {(premiGaranzia as any[]).length > 0 && (
        <SectionCollapsible title="Premi per Garanzia" icon={ShieldCheck}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Garanzia</TableHead>
                <TableHead className="text-right">Capitale</TableHead>
                <TableHead className="text-right">Tasso</TableHead>
                <TableHead className="text-right">Firma</TableHead>
                <TableHead className="text-right">Rata</TableHead>
                <TableHead className="text-right">Annuo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(premiGaranzia as any[]).map((pg: any) => (
                <TableRow key={pg.id}>
                  <TableCell className="font-medium">{pg.garanzia}</TableCell>
                  <TableCell className="text-right font-mono">{fmtEuro(pg.capitale)}</TableCell>
                  <TableCell className="text-right font-mono">{pg.tasso ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{fmtEuro(pg.firma)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtEuro(pg.rata)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtEuro(pg.annuo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCollapsible>
      )}

      {(conducente as any) && (
        <SectionCollapsible title="Dati Conducente" icon={UserCheck}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            <FieldRow label="Nome" value={fmt((conducente as any).nome)} />
            <FieldRow label="Cognome" value={fmt((conducente as any).cognome)} />
            <FieldRow label="Indirizzo" value={fmt((conducente as any).indirizzo)} />
            <FieldRow label="CAP" value={fmt((conducente as any).cap)} />
            <FieldRow label="Città" value={fmt((conducente as any).citta)} />
            <FieldRow label="Provincia" value={fmt((conducente as any).provincia)} />
            <FieldRow label="Data Nascita" value={fmtDate((conducente as any).data_nascita)} />
            <FieldRow label="Tipo Patente" value={fmt((conducente as any).tipo_patente)} />
            <FieldRow label="Rilascio Patente" value={fmtDate((conducente as any).data_rilascio_patente)} />
            {(conducente as any).note && <div className="col-span-full"><FieldRow label="Note" value={(conducente as any).note} /></div>}
          </div>
        </SectionCollapsible>
      )}

      {t.note && (
        <Card>
          <CardContent className="pt-4">
            <span className="text-xs text-muted-foreground">Note:</span>
            <p className="text-sm mt-1">{t.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="movimenti">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="movimenti"><List className="w-4 h-4 mr-1" />Movimenti ({movimentiPolizza.length})</TabsTrigger>
          <TabsTrigger value="provvigioni"><Percent className="w-4 h-4 mr-1" />Provvigioni ({provvigioni.length})</TabsTrigger>
          <TabsTrigger value="appendici"><FileText className="w-4 h-4 mr-1" />Appendici ({appendiciPolizza.length})</TabsTrigger>
          <TabsTrigger value="garanzie"><ShieldCheck className="w-4 h-4 mr-1" />Garanzie</TabsTrigger>
          <TabsTrigger value="familiari"><Users className="w-4 h-4 mr-1" />Familiari</TabsTrigger>
          <TabsTrigger value="note"><StickyNote className="w-4 h-4 mr-1" />Note</TabsTrigger>
          <TabsTrigger value="documenti"><FileText className="w-4 h-4 mr-1" />Documenti</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="timeline"><Clock className="w-4 h-4 mr-1" />Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="movimenti">
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              I movimenti sono visualizzati nella sezione sopra. Questa tab potrà contenere funzionalità di gestione avanzata (aggiunta rinnovi, appendici, storni).
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="provvigioni">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beneficiario</TableHead>
                    <TableHead>Percentuale</TableHead>
                    <TableHead>Importo €</TableHead>
                    <TableHead>Calcolata il</TableHead>
                    <TableHead>Pagata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {provvigioni.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.profiles ? `${p.profiles.nome} ${p.profiles.cognome}` : "—"}</TableCell>
                      <TableCell className="font-mono">{p.percentuale}%</TableCell>
                      <TableCell className="font-mono">€ {p.importo_provvigione?.toFixed(2)}</TableCell>
                      <TableCell>{p.calcolata_il ? format(new Date(p.calcolata_il), "dd/MM/yyyy HH:mm", { locale: it }) : "—"}</TableCell>
                      <TableCell><Badge variant={p.pagata ? "default" : "secondary"}>{p.pagata ? "Sì" : "No"}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {provvigioni.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nessuna provvigione generata</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="appendici">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Appendici registrate per questa polizza</p>
                <Button size="sm" onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
                  <FileText className="w-4 h-4 mr-1" /> Nuova Appendice
                </Button>
              </div>
              {appendiciPolizza.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nessuna appendice registrata.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">N°</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Effetto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Oggetto</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="w-28">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(appendiciPolizza as any[]).map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono font-bold">{a.numero_appendice}</TableCell>
                        <TableCell className="text-sm">{a.data_appendice ? format(new Date(a.data_appendice), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                        <TableCell className="text-sm">{a.data_effetto ? format(new Date(a.data_effetto), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{a.tipo}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{a.oggetto || "—"}</TableCell>
                        <TableCell className="text-sm">{a.nome_file || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Modifica" onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}&appendiceId=${a.id}`)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {a.testo && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizza testo" onClick={() => {
                                const w = window.open("", "_blank");
                                if (w) { w.document.write(`<pre style="white-space:pre-wrap;font-family:sans-serif;padding:2rem">${a.testo}</pre>`); }
                              }}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {a.file_path && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Download" onClick={async () => {
                                const { data, error } = await supabase.storage.from("documenti_titoli").download(a.file_path);
                                if (error || !data) return;
                                const url = URL.createObjectURL(data);
                                const link = document.createElement("a");
                                link.href = url; link.download = a.nome_file || "file"; link.click();
                                URL.revokeObjectURL(url);
                              }}>
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="garanzie">
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">Sezione Garanzie — in fase di sviluppo. Qui verranno mostrate le coperture e garanzie della polizza.</CardContent></Card>
        </TabsContent>
        <TabsContent value="familiari">
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">Sezione Familiari — in fase di sviluppo. Qui verranno mostrati assicurati e beneficiari collegati alla polizza.</CardContent></Card>
        </TabsContent>
        <TabsContent value="note">
          <Card><CardContent className="pt-6"><p className="text-sm whitespace-pre-wrap">{t.note || "Nessuna nota."}</p></CardContent></Card>
        </TabsContent>
        <TabsContent value="documenti">
          <Card><CardContent className="pt-6"><DocumentiTab entitaTipo="titolo" entitaId={id!} bucketName="documenti_titoli" /></CardContent></Card>
        </TabsContent>
        <TabsContent value="chat">
          <Card><CardContent className="pt-6"><ChatTab entitaTipo="titolo" entitaId={id!} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="timeline">
          <Card><CardContent className="pt-6"><TimelineTab entitaTipo="titolo" entitaId={id!} /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TitoloDetail;
