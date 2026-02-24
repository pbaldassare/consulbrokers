import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Users, Phone, Mail, Globe, StickyNote, Plus,
  Clock, FileText, TrendingUp, CheckCircle2, XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";

const STATI_PROSPECT = [
  { value: "nuovo", label: "Nuovo" },
  { value: "in_trattativa", label: "In Trattativa" },
  { value: "preventivo_inviato", label: "Preventivo Inviato" },
  { value: "chiuso_vinto", label: "Chiuso Vinto" },
  { value: "chiuso_perso", label: "Chiuso Perso" },
];

const STATI_TRATTATIVA = [
  { value: "aperta", label: "Aperta" },
  { value: "in_negoziazione", label: "In Negoziazione" },
  { value: "chiusa_vinta", label: "Chiusa Vinta" },
  { value: "chiusa_persa", label: "Chiusa Persa" },
];

const AZIONE_ICONS: Record<string, React.ElementType> = {
  creazione_prospect: Users,
  modifica_stato_prospect: TrendingUp,
  creazione_trattativa: FileText,
  chiusura_trattativa: CheckCircle2,
  modifica_stato_trattativa: TrendingUp,
};

const ProspectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [trattativaOpen, setTrattativaOpen] = useState(false);
  const [trattativaForm, setTrattativaForm] = useState({
    prodotto: "", compagnia: "", premio_previsto: "",
  });

  const { data: prospect, isLoading } = useQuery({
    queryKey: ["prospect", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect")
        .select("*, profiles:assegnato_a(nome, cognome), uffici:ufficio_id(nome_ufficio)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: trattative } = useQuery({
    queryKey: ["trattative", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trattative")
        .select("*")
        .eq("prospect_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: timeline } = useQuery({
    queryKey: ["log_attivita", "prospect", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("log_attivita")
        .select("*")
        .eq("entita_tipo", "prospect")
        .eq("entita_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Also get trattativa logs for this prospect's trattative
      if (trattative?.length) {
        const trattativeIds = trattative.map((t) => t.id);
        const { data: trattativeLogs } = await supabase
          .from("log_attivita")
          .select("*")
          .eq("entita_tipo", "trattativa")
          .in("entita_id", trattativeIds)
          .order("created_at", { ascending: false });
        
        const all = [...(data || []), ...(trattativeLogs || [])];
        all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return all;
      }

      return data;
    },
    enabled: !!id && trattative !== undefined,
  });

  const updateStatoMutation = useMutation({
    mutationFn: async (newStato: string) => {
      const oldStato = prospect?.stato;
      const { error } = await supabase.from("prospect").update({ stato: newStato, updated_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;

      await logAttivita({
        azione: "modifica_stato_prospect",
        entita_tipo: "prospect",
        entita_id: id!,
        dettagli_json: { stato_precedente: oldStato, nuovo_stato: newStato },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect", id] });
      queryClient.invalidateQueries({ queryKey: ["log_attivita", "prospect", id] });
      toast({ title: "Stato aggiornato" });
    },
  });

  const createTrattativaMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        prospect_id: id!,
        prodotto: trattativaForm.prodotto,
        compagnia: trattativaForm.compagnia,
        premio_previsto: trattativaForm.premio_previsto ? parseFloat(trattativaForm.premio_previsto) : null,
        stato: "aperta",
        created_by: profile?.id || null,
      };
      const { data, error } = await supabase.from("trattative").insert(payload).select().single();
      if (error) throw error;

      await logAttivita({
        azione: "creazione_trattativa",
        entita_tipo: "prospect",
        entita_id: id!,
        dettagli_json: { trattativa_id: data.id, prodotto: trattativaForm.prodotto, compagnia: trattativaForm.compagnia },
      });

      // Update prospect stato if still "nuovo"
      if (prospect?.stato === "nuovo") {
        await supabase.from("prospect").update({ stato: "in_trattativa", updated_at: new Date().toISOString() }).eq("id", id!);
        await logAttivita({
          azione: "modifica_stato_prospect",
          entita_tipo: "prospect",
          entita_id: id!,
          dettagli_json: { stato_precedente: "nuovo", nuovo_stato: "in_trattativa", motivo: "apertura_trattativa" },
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative", id] });
      queryClient.invalidateQueries({ queryKey: ["prospect", id] });
      queryClient.invalidateQueries({ queryKey: ["log_attivita", "prospect", id] });
      toast({ title: "Trattativa creata" });
      setTrattativaForm({ prodotto: "", compagnia: "", premio_previsto: "" });
      setTrattativaOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const updateTrattativaStato = useMutation({
    mutationFn: async ({ trattativaId, newStato, oldStato }: { trattativaId: string; newStato: string; oldStato: string }) => {
      const update: Record<string, unknown> = { stato: newStato, updated_at: new Date().toISOString() };
      if (newStato === "chiusa_vinta" || newStato === "chiusa_persa") {
        update.data_chiusura = new Date().toISOString();
      }
      const { error } = await supabase.from("trattative").update(update).eq("id", trattativaId);
      if (error) throw error;

      const azione = (newStato === "chiusa_vinta" || newStato === "chiusa_persa") ? "chiusura_trattativa" : "modifica_stato_trattativa";
      await logAttivita({
        azione,
        entita_tipo: "trattativa",
        entita_id: trattativaId,
        dettagli_json: { prospect_id: id, stato_precedente: oldStato, nuovo_stato: newStato },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative", id] });
      queryClient.invalidateQueries({ queryKey: ["log_attivita", "prospect", id] });
      toast({ title: "Trattativa aggiornata" });
    },
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Caricamento...</div>;
  if (!prospect) return <div className="text-center py-12 text-muted-foreground">Prospect non trovato</div>;

  const getTrattativaColor = (stato: string) => {
    switch (stato) {
      case "aperta": return "bg-kpi-blue-bg text-kpi-blue-text border-kpi-blue-border";
      case "in_negoziazione": return "bg-kpi-yellow-bg text-kpi-yellow-text border-kpi-yellow-border";
      case "chiusa_vinta": return "bg-kpi-green-bg text-kpi-green-text border-kpi-green-border";
      case "chiusa_persa": return "bg-destructive/10 text-destructive border-destructive/30";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate("/prospect")} className="hover:text-foreground">Prospect & Trattative</button>
        <span>›</span>
        <span>{prospect.nome} {prospect.cognome}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/prospect")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{prospect.nome} {prospect.cognome}</h1>
            <p className="text-sm text-muted-foreground">
              Creato il {format(new Date(prospect.created_at), "dd MMMM yyyy", { locale: it })}
            </p>
          </div>
        </div>
        <Select value={prospect.stato} onValueChange={(v) => updateStatoMutation.mutate(v)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATI_PROSPECT.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info + Trattative */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info card */}
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Dati Anagrafici</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{prospect.email || "Nessuna email"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{prospect.telefono || "Nessun telefono"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Fonte: {prospect.fonte || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Assegnato a: {(prospect as any).profiles ? `${(prospect as any).profiles.nome || ""} ${(prospect as any).profiles.cognome || ""}`.trim() : "—"}
                </span>
              </div>
            </div>
            {prospect.note && (
              <div className="flex items-start gap-2 text-sm pt-2 border-t border-border">
                <StickyNote className="w-4 h-4 text-muted-foreground mt-0.5" />
                <p className="text-muted-foreground">{prospect.note}</p>
              </div>
            )}
          </Card>

          {/* Trattative */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Trattative ({trattative?.length || 0})</h3>
              <Dialog open={trattativaOpen} onOpenChange={setTrattativaOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" />Nuova Trattativa</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nuova Trattativa</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label>Prodotto *</Label>
                      <Input value={trattativaForm.prodotto} onChange={(e) => setTrattativaForm({ ...trattativaForm, prodotto: e.target.value })} placeholder="Es: RC Auto" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Compagnia *</Label>
                      <Input value={trattativaForm.compagnia} onChange={(e) => setTrattativaForm({ ...trattativaForm, compagnia: e.target.value })} placeholder="Es: UnipolSai" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Premio Previsto (€)</Label>
                      <Input type="number" value={trattativaForm.premio_previsto} onChange={(e) => setTrattativaForm({ ...trattativaForm, premio_previsto: e.target.value })} placeholder="0.00" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setTrattativaOpen(false)}>Annulla</Button>
                      <Button onClick={() => createTrattativaMutation.mutate()} disabled={createTrattativaMutation.isPending || !trattativaForm.prodotto || !trattativaForm.compagnia}>
                        Crea Trattativa
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {!trattative?.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Nessuna trattativa ancora</div>
            ) : (
              <div className="space-y-3">
                {trattative.map((t) => (
                  <div key={t.id} className="border border-border rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{t.prodotto}</p>
                      <p className="text-sm text-muted-foreground">{t.compagnia} • {t.premio_previsto ? `€ ${Number(t.premio_previsto).toLocaleString("it-IT")}` : "Premio n.d."}</p>
                      {t.data_chiusura && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Chiusa il {format(new Date(t.data_chiusura), "dd/MM/yyyy")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${getTrattativaColor(t.stato)}`}>
                        {STATI_TRATTATIVA.find((s) => s.value === t.stato)?.label || t.stato}
                      </span>
                      <Select value={t.stato} onValueChange={(v) => updateTrattativaStato.mutate({ trattativaId: t.id, newStato: v, oldStato: t.stato })}>
                        <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATI_TRATTATIVA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Timeline */}
        <div>
          <Card className="p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />Timeline Attività
            </h3>
            {!timeline?.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Nessuna attività registrata</div>
            ) : (
              <div className="space-y-4">
                {timeline.map((log) => {
                  const IconComp = AZIONE_ICONS[log.azione] || Clock;
                  const details = log.dettagli_json as Record<string, unknown> | null;
                  return (
                    <div key={log.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <IconComp className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {log.azione.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </p>
                        {details && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {details.stato_precedente && details.nuovo_stato
                              ? `${details.stato_precedente} → ${details.nuovo_stato}`
                              : details.prodotto
                              ? `${details.prodotto} - ${details.compagnia || ""}`
                              : JSON.stringify(details)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: it })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
      {/* Documenti e Chat */}
      <Tabs defaultValue="documenti">
        <TabsList>
          <TabsTrigger value="documenti">Documenti</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>
        <TabsContent value="documenti">
          <Card className="p-5"><DocumentiTab entitaTipo="prospect" entitaId={id!} /></Card>
        </TabsContent>
        <TabsContent value="chat">
          <Card className="p-5"><ChatTab entitaTipo="prospect" entitaId={id!} /></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProspectDetail;
