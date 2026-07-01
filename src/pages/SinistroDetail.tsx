import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, CheckCircle, AlertTriangle, MapPin, User as UserIcon, FileText, Building2, Bell } from "lucide-react";
import { useTabParam } from "@/hooks/useTabParam";

const SINISTRO_TABS_BASE = ["dati", "checklist", "eventi", "prescrizioni", "documenti", "chat", "timeline"] as const;
import AiDocumentScanner from "@/components/AiDocumentScanner";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAttivita } from "@/lib/logAttivita";
import { formatTipoSinistro } from "@/lib/tipiSinistro";
import SinistroDatiPraticaPanel from "@/components/sinistri/SinistroDatiPraticaPanel";
import SinistroPrescrizioniPanel from "@/components/sinistri/SinistroPrescrizioniPanel";
import SinistroReminderPanel from "@/components/sinistri/SinistroReminderPanel";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";

const statiSinistro = ["in_valutazione", "aperto", "in_lavorazione", "in_attesa_documenti", "in_liquidazione", "chiuso", "respinto"];
const statoBadge: Record<string, string> = {
  in_valutazione: "bg-amber-100 text-amber-800",
  aperto: "bg-blue-100 text-blue-800",
  in_lavorazione: "bg-yellow-100 text-yellow-800",
  in_attesa_documenti: "bg-orange-100 text-orange-800",
  in_liquidazione: "bg-purple-100 text-purple-800",
  chiuso: "bg-green-100 text-green-800",
  respinto: "bg-red-100 text-red-800",
};
const eventoStatoBadge: Record<string, string> = {
  attivo: "bg-blue-100 text-blue-800",
  completato: "bg-green-100 text-green-800",
  scaduto: "bg-red-100 text-red-800",
};

export default function SinistroDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, hasPermission, user } = useAuth();
  const canManage = isAdmin || hasPermission("sinistri");
  const [checklistDialog, setChecklistDialog] = useState(false);
  const [eventoDialog, setEventoDialog] = useState(false);
  const [newChecklist, setNewChecklist] = useState({ descrizione: "", obbligatorio: true });
  const [newEvento, setNewEvento] = useState({ tipo_evento: "", data_scadenza: "", note: "" });
  const [statoTarget, setStatoTarget] = useState<string>("");
  const [statoNote, setStatoNote] = useState<string>("");

  const { data: sinistro } = useQuery({
    queryKey: ["sinistro", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sinistri")
        .select("*, compagnie(nome), profiles!sinistri_responsabile_id_fkey(nome, cognome), liquidatore:anagrafiche_professionali!sinistri_liquidatore_id_fkey(nome, cognome, ragione_sociale), titoli(numero_titolo), clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente, codice_fiscale, partita_iva)")
        .eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const canSeeReminder = isAdmin || (!!user?.id && sinistro?.aperto_da_user_id === user.id);
  const tabList = useMemo(() => {
    const tabs = [...SINISTRO_TABS_BASE];
    if (canSeeReminder) {
      const idx = tabs.indexOf("prescrizioni");
      tabs.splice(idx + 1, 0, "reminder");
    }
    return tabs as readonly string[];
  }, [canSeeReminder]);
  const [activeTab, setActiveTab] = useTabParam(tabList as any, "dati");

  const { data: checklist } = useQuery({
    queryKey: ["sinistro-checklist", id],
    queryFn: async () => {
      const { data } = await supabase.from("sinistro_checklist").select("*").eq("sinistro_id", id!).order("created_at");
      return data || [];
    },
  });

  const { data: eventi } = useQuery({
    queryKey: ["sinistro-eventi", id],
    queryFn: async () => {
      const { data } = await supabase.from("sinistro_eventi").select("*").eq("sinistro_id", id!).order("data_scadenza");
      return data || [];
    },
  });

  const { data: prescrizioni } = useQuery({
    queryKey: ["sinistro-prescrizioni", id],
    queryFn: async () => {
      const { data } = await supabase.from("sinistro_prescrizioni").select("id, stato").eq("sinistro_id", id!);
      return data || [];
    },
  });

  const prescrizioniAttive = prescrizioni?.filter((p: { stato: string }) => p.stato === "bozza" || p.stato === "inviata").length ?? 0;

  // Timeline is now rendered by TimelineTab component

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sinistro", id] });
    qc.invalidateQueries({ queryKey: ["sinistro-checklist", id] });
    qc.invalidateQueries({ queryKey: ["sinistro-eventi", id] });
    qc.invalidateQueries({ queryKey: ["sinistro-prescrizioni", id] });
    qc.invalidateQueries({ queryKey: ["sinistro-reminder", id] });
    qc.invalidateQueries({ queryKey: ["timeline", "sinistro", id] });
  };

  // Realtime: aggiorna dettaglio sinistro, checklist ed eventi su qualsiasi change
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`sinistro-rt-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sinistri", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["sinistro", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "sinistro_checklist", filter: `sinistro_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["sinistro-checklist", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "sinistro_eventi", filter: `sinistro_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["sinistro-eventi", id] });
          qc.invalidateQueries({ queryKey: ["timeline", "sinistro", id] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const toggleChecklist = async (item: any) => {
    await supabase.from("sinistro_checklist").update({ completato: !item.completato }).eq("id", item.id);
    invalidate();
  };

  const addChecklist = async () => {
    await supabase.from("sinistro_checklist").insert({ sinistro_id: id, ...newChecklist });
    setChecklistDialog(false);
    setNewChecklist({ descrizione: "", obbligatorio: true });
    invalidate();
  };

  const addEvento = async () => {
    await supabase.from("sinistro_eventi").insert({ sinistro_id: id, ...newEvento });
    setEventoDialog(false);
    setNewEvento({ tipo_evento: "", data_scadenza: "", note: "" });
    invalidate();
  };

  const completaEvento = async (eventoId: string) => {
    await supabase.from("sinistro_eventi").update({ stato: "completato" }).eq("id", eventoId);
    invalidate();
  };

  const cambiaStato = async (nuovo: string, note?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("gestione-sinistri", {
        body: { azione: "cambia_stato", sinistro_id: id, nuovo_stato: nuovo, user_id: user?.id, note: note || undefined },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      toast.success(`Stato aggiornato a "${nuovo.replace(/_/g, " ")}"`);
      setStatoTarget("");
      setStatoNote("");
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!sinistro) return null;

  const isChiuso = sinistro.stato === "chiuso" || sinistro.stato === "respinto";

  const clienteNome = sinistro.clienti
    ? sinistro.clienti.tipo_cliente === "azienda"
      ? sinistro.clienti.ragione_sociale
      : `${sinistro.clienti.cognome || ""} ${sinistro.clienti.nome || ""}`.trim()
    : "—";

  // Contesto AI per gli scanner di sinistro: include CF/P.IVA del cliente
  // collegato così l'AI sa a chi appartengono perizie e referti.
  const sinistroAiContext = {
    entityType: "sinistro" as const,
    scopeHint: `Sinistro ${sinistro.numero_sinistro ?? id} — ${clienteNome}`,
    expectedCF: sinistro.clienti?.codice_fiscale ?? null,
    expectedPIVA: sinistro.clienti?.partita_iva ?? null,
  };

  return (
    <div className="space-y-6">
      {/* Header coerente con design system */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sinistri")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">Sinistro {sinistro.numero_sinistro || "—"}</h1>
          <p className="text-sm text-muted-foreground truncate">
            {formatTipoSinistro(sinistro)}
            {sinistro.compagnie?.nome ? ` · ${sinistro.compagnie.nome}` : ""}
          </p>
        </div>
        <Badge className={`text-sm px-3 py-1 ${statoBadge[sinistro.stato]}`}>{sinistro.stato.replace(/_/g, " ")}</Badge>
      </div>

      {/* Collegamenti (cliccabili) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          className={sinistro.cliente_anagrafica_id ? "cursor-pointer hover:bg-accent/40 transition-colors" : ""}
          onClick={() => sinistro.cliente_anagrafica_id && navigate(`/archivi/clienti/${sinistro.cliente_anagrafica_id}`)}
        >
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><UserIcon className="h-3 w-3" /> Cliente</p>
            <p className="font-semibold truncate">{clienteNome}</p>
          </CardContent>
        </Card>
        <Card
          className={sinistro.titolo_id ? "cursor-pointer hover:bg-accent/40 transition-colors" : ""}
          onClick={() => sinistro.titolo_id && navigate(`/titoli/${sinistro.titolo_id}`)}
        >
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> Polizza</p>
            <p className="font-semibold truncate">{sinistro.titoli?.numero_titolo || "—"}</p>
          </CardContent>
        </Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Data Evento</p><p className="font-semibold">{sinistro.data_evento ? format(new Date(sinistro.data_evento), "dd/MM/yyyy") : "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Responsabile</p><p className="font-semibold truncate">{sinistro.profiles ? `${sinistro.profiles.nome} ${sinistro.profiles.cognome}` : "—"}</p></CardContent></Card>
      </div>

      {/* Financial Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-l-4" style={{ borderLeftColor: "#64748b" }}><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Costo Preventivato</p><p className="font-semibold font-mono">€ {(sinistro.costo_preventivato || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card className="border-l-4" style={{ borderLeftColor: "#64748b" }}><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Costo Effettivo</p><p className="font-semibold font-mono">€ {(sinistro.costo_effettivo || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card className="border-l-4" style={{ borderLeftColor: "#0284c7" }}><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Franchigia</p><p className="font-semibold font-mono">€ {(sinistro.franchigia || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card className="border-l-4" style={{ borderLeftColor: "#059669" }}><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Liquidato</p><p className="font-semibold font-mono text-emerald-700">€ {(sinistro.importo_liquidato || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card className="border-l-4" style={{ borderLeftColor: "#ea580c" }}><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Riserva</p><p className="font-semibold font-mono text-orange-600">€ {(sinistro.importo_riserva || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p></CardContent></Card>
      </div>

      {/* Detail Cards — riepilogo rapido */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(sinistro.luogo_sinistro || sinistro.indirizzo_sinistro || sinistro.citta_sinistro) && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Luogo Sinistro</p>
              <p className="font-semibold">{sinistro.indirizzo_sinistro || sinistro.luogo_sinistro || "—"}</p>
              <p className="text-sm text-muted-foreground">{[sinistro.cap_sinistro, sinistro.citta_sinistro, sinistro.provincia_sinistro ? `(${sinistro.provincia_sinistro})` : null].filter(Boolean).join(" ")}</p>
            </CardContent>
          </Card>
        )}
        {(sinistro.controparte || sinistro.targa_veicolo) && (
          <Card>
            <CardContent className="pt-4">
              {sinistro.controparte && <p className="text-sm"><span className="text-muted-foreground">Controparte:</span> <span className="font-semibold">{sinistro.controparte}</span></p>}
              {sinistro.targa_veicolo && <p className="text-sm mt-1"><span className="text-muted-foreground">Targa:</span> <span className="font-semibold">{sinistro.targa_veicolo}</span></p>}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Checklist + Events + Prescrizioni summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Checklist</p><p className="font-semibold">{checklist?.filter((c: any) => c.completato).length}/{checklist?.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Eventi Attivi</p><p className="font-semibold">{eventi?.filter((e: any) => e.stato === "attivo").length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Prescrizioni attive</p><p className="font-semibold">{prescrizioniAttive}</p></CardContent></Card>
      </div>

      {/* Cambio stato — admin sempre; altri gestori solo se pratica non chiusa */}
      {((canManage && !isChiuso) || isAdmin) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Gestione Stato Pratica</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isChiuso && isAdmin && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Pratica {sinistro.stato}: la riapertura/modifica è consentita solo agli amministratori.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3 items-end">
              <div>
                <Label className="text-xs">Nuovo stato</Label>
                <Select value={statoTarget} onValueChange={setStatoTarget}>
                  <SelectTrigger><SelectValue placeholder="Seleziona stato" /></SelectTrigger>
                  <SelectContent>
                    {statiSinistro.filter(s => s !== sinistro.stato).map(s => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Note (opzionale)</Label>
                <Input value={statoNote} onChange={e => setStatoNote(e.target.value)} placeholder="Motivazione cambio stato…" />
              </div>
              <Button disabled={!statoTarget} onClick={() => cambiaStato(statoTarget, statoNote)}>Aggiorna stato</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ogni cambio stato viene registrato nella timeline e nel log attività.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dati">Dati Pratica</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="eventi">Eventi</TabsTrigger>
          <TabsTrigger value="prescrizioni">Prescrizioni</TabsTrigger>
          {canSeeReminder && (
            <TabsTrigger value="reminder" className="gap-1">
              <Bell className="h-3.5 w-3.5" /> I miei reminder
            </TabsTrigger>
          )}
          <TabsTrigger value="documenti">Documenti</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="timeline">Log Attività</TabsTrigger>
        </TabsList>

        <TabsContent value="dati" className="space-y-4">
          <SinistroDatiPraticaPanel
            sinistro={sinistro}
            canEdit={canManage}
            onSaved={invalidate}
          />
          {sinistro.note_perito && (
            <Card>
              <CardHeader><CardTitle className="text-base">Note Perito / Report SIR</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{sinistro.note_perito.startsWith("[SIR_REPORT]") ? "Bozza report SIR salvata (apri Report SIR per modificare)" : sinistro.note_perito}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="checklist" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={checklistDialog} onOpenChange={setChecklistDialog}>
              <DialogTrigger asChild><Button size="sm" disabled={isChiuso}><Plus className="h-4 w-4 mr-1" /> Aggiungi</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuova Checklist</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Descrizione</Label><Input value={newChecklist.descrizione} onChange={e => setNewChecklist({ ...newChecklist, descrizione: e.target.value })} /></div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={newChecklist.obbligatorio} onCheckedChange={v => setNewChecklist({ ...newChecklist, obbligatorio: !!v })} />
                    <Label>Obbligatorio</Label>
                  </div>
                  <Button onClick={addChecklist} className="w-full">Aggiungi</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-2">
            {checklist?.map((item: any) => (
              <div key={item.id} className={`flex items-center gap-3 p-3 border rounded-lg ${item.completato ? "bg-muted/50" : ""}`}>
                <Checkbox checked={item.completato} onCheckedChange={() => toggleChecklist(item)} disabled={isChiuso} />
                <span className={item.completato ? "line-through text-muted-foreground" : ""}>{item.descrizione}</span>
                {item.obbligatorio && <Badge variant="outline" className="ml-auto text-xs">Obbligatorio</Badge>}
              </div>
            ))}
            {!checklist?.length && <p className="text-center text-muted-foreground py-4">Nessun elemento</p>}
          </div>
        </TabsContent>

        <TabsContent value="eventi" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={eventoDialog} onOpenChange={setEventoDialog}>
              <DialogTrigger asChild><Button size="sm" disabled={isChiuso}><Plus className="h-4 w-4 mr-1" /> Aggiungi Evento</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuovo Evento</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Tipo Evento</Label>
                    <Select value={newEvento.tipo_evento} onValueChange={v => setNewEvento({ ...newEvento, tipo_evento: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attesa_documento">Attesa Documento</SelectItem>
                        <SelectItem value="perizia">Perizia</SelectItem>
                        <SelectItem value="sollecito">Sollecito</SelectItem>
                        <SelectItem value="altro">Altro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Scadenza</Label><Input type="date" value={newEvento.data_scadenza} onChange={e => setNewEvento({ ...newEvento, data_scadenza: e.target.value })} /></div>
                  <div><Label>Note</Label><Input value={newEvento.note} onChange={e => setNewEvento({ ...newEvento, note: e.target.value })} /></div>
                  <Button onClick={addEvento} className="w-full">Aggiungi</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Note</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventi?.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="capitalize">{e.tipo_evento.replace(/_/g, " ")}</TableCell>
                  <TableCell>{format(new Date(e.data_scadenza), "dd/MM/yyyy")}</TableCell>
                  <TableCell><Badge className={eventoStatoBadge[e.stato]}>{e.stato}</Badge></TableCell>
                  <TableCell>{e.note || "—"}</TableCell>
                  <TableCell>
                    {e.stato === "attivo" && (
                      <Button size="sm" variant="outline" onClick={() => completaEvento(e.id)}><CheckCircle className="h-4 w-4 mr-1" /> Completa</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!eventi?.length && <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nessun evento</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="prescrizioni" className="space-y-4">
          <SinistroPrescrizioniPanel sinistroId={id!} disabled={isChiuso && !isAdmin} />
        </TabsContent>

        {canSeeReminder && user && (
          <TabsContent value="reminder" className="space-y-4">
            <SinistroReminderPanel
              sinistroId={id!}
              apertoDaUserId={sinistro.aperto_da_user_id ?? null}
              currentUserId={user.id}
              disabled={isChiuso && !isAdmin}
            />
          </TabsContent>
        )}

        <TabsContent value="documenti" className="space-y-4">
          {/* AI Scanner per perizie e referti medici */}
          {!isChiuso && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scansione AI Documenti Sinistro</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <AiDocumentScanner
                    documentType="perizia"
                    entityContext={sinistroAiContext}
                    onFileReady={async (file) => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        const path = `sinistro/${id}/${Date.now()}_${file.name}`;
                        const { error: uploadErr } = await supabase.storage.from("documenti_sinistri").upload(path, file);
                        if (uploadErr) throw uploadErr;
                        await supabase.from("documenti").insert({
                          nome_file: file.name,
                          path_storage: path,
                          bucket_name: "documenti_sinistri",
                          entita_tipo: "sinistro",
                          entita_id: id!,
                          caricato_da: user?.id,
                          categoria: "perizia",
                        });
                        toast.success("Perizia salvata nei documenti");
                        qc.invalidateQueries({ queryKey: ["documenti", "sinistro", id] });
                      } catch (err: any) {
                        toast.error("Errore salvataggio: " + err.message);
                      }
                    }}
                    onExtracted={() => {}}
                  />
                  <AiDocumentScanner
                    documentType="referto_medico"
                    entityContext={sinistroAiContext}
                    onFileReady={async (file) => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        const path = `sinistro/${id}/${Date.now()}_${file.name}`;
                        const { error: uploadErr } = await supabase.storage.from("documenti_sinistri").upload(path, file);
                        if (uploadErr) throw uploadErr;
                        await supabase.from("documenti").insert({
                          nome_file: file.name,
                          path_storage: path,
                          bucket_name: "documenti_sinistri",
                          entita_tipo: "sinistro",
                          entita_id: id!,
                          caricato_da: user?.id,
                          categoria: "referto_medico",
                        });
                        toast.success("Referto medico salvato nei documenti");
                        qc.invalidateQueries({ queryKey: ["documenti", "sinistro", id] });
                      } catch (err: any) {
                        toast.error("Errore salvataggio: " + err.message);
                      }
                    }}
                    onExtracted={() => {}}
                  />
                </div>
              </CardContent>
            </Card>
          )}
          <DocumentiTab entitaTipo="sinistro" entitaId={id!} bucketName="documenti_sinistri" />
        </TabsContent>

        <TabsContent value="chat">
          <ChatTab entitaTipo="sinistro" entitaId={id!} />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineTab entitaTipo="sinistro" entitaId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
