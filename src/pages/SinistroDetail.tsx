import { useState } from "react";
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
import { ArrowLeft, Plus, CheckCircle, XCircle, Clock } from "lucide-react";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAttivita } from "@/lib/logAttivita";

const statiSinistro = ["aperto", "in_lavorazione", "in_attesa_documenti", "chiuso", "respinto"];
const statoBadge: Record<string, string> = {
  aperto: "bg-blue-100 text-blue-800",
  in_lavorazione: "bg-yellow-100 text-yellow-800",
  in_attesa_documenti: "bg-orange-100 text-orange-800",
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
  const [checklistDialog, setChecklistDialog] = useState(false);
  const [eventoDialog, setEventoDialog] = useState(false);
  const [newChecklist, setNewChecklist] = useState({ descrizione: "", obbligatorio: true });
  const [newEvento, setNewEvento] = useState({ tipo_evento: "", data_scadenza: "", note: "" });

  const { data: sinistro } = useQuery({
    queryKey: ["sinistro", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sinistri")
        .select("*, compagnie(nome), profiles!sinistri_responsabile_id_fkey(nome, cognome)")
        .eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

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

  // Timeline is now rendered by TimelineTab component

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sinistro", id] });
    qc.invalidateQueries({ queryKey: ["sinistro-checklist", id] });
    qc.invalidateQueries({ queryKey: ["sinistro-eventi", id] });
    qc.invalidateQueries({ queryKey: ["timeline", "sinistro", id] });
  };

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

  const cambiaStato = async (nuovo: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("gestione-sinistri", {
        body: { azione: "cambia_stato", sinistro_id: id, nuovo_stato: nuovo, user_id: user?.id },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      toast.success(`Stato aggiornato a "${nuovo.replace(/_/g, " ")}"`);
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!sinistro) return null;

  const isChiuso = sinistro.stato === "chiuso" || sinistro.stato === "respinto";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sinistri")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Sinistro {sinistro.numero_sinistro || "—"}</h1>
          <p className="text-muted-foreground">{sinistro.compagnie?.nome}</p>
        </div>
        <Badge className={`text-sm px-3 py-1 ${statoBadge[sinistro.stato]}`}>{sinistro.stato.replace(/_/g, " ")}</Badge>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Data Apertura</p><p className="font-semibold">{sinistro.data_apertura ? format(new Date(sinistro.data_apertura), "dd/MM/yyyy") : "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Responsabile</p><p className="font-semibold">{sinistro.profiles ? `${sinistro.profiles.nome} ${sinistro.profiles.cognome}` : "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Checklist</p><p className="font-semibold">{checklist?.filter((c: any) => c.completato).length}/{checklist?.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Eventi Attivi</p><p className="font-semibold">{eventi?.filter((e: any) => e.stato === "attivo").length}</p></CardContent></Card>
      </div>

      {/* Stato actions */}
      {!isChiuso && (
        <Card>
          <CardHeader><CardTitle className="text-base">Cambia Stato</CardTitle></CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {statiSinistro.filter(s => s !== sinistro.stato).map(s => (
              <Button key={s} variant={s === "chiuso" ? "default" : "outline"} size="sm" onClick={() => cambiaStato(s)}>
                {s.replace(/_/g, " ")}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {sinistro.descrizione && (
        <Card><CardHeader><CardTitle className="text-base">Descrizione</CardTitle></CardHeader><CardContent><p>{sinistro.descrizione}</p></CardContent></Card>
      )}

      <Tabs defaultValue="checklist">
        <TabsList>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="eventi">Eventi</TabsTrigger>
          <TabsTrigger value="documenti">Documenti</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

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

        <TabsContent value="documenti">
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
