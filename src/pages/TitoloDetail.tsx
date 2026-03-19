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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Percent, Clock } from "lucide-react";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const statiTitolo = ["creato", "incassato", "stornato", "annullato"];

const TitoloDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: titolo, isLoading } = useQuery({
    queryKey: ["titolo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("*, prodotti(nome_prodotto, compagnie(nome)), uffici(nome_ufficio), produttore:profiles!titoli_produttore_id_fkey(nome, cognome, ruolo), cliente:profiles!titoli_cliente_id_fkey(nome, cognome), cliente_anagrafica:clienti!titoli_cliente_anagrafica_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale)")
        .eq("id", id!)
        .single();
      if (error) throw error;
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

  // Timeline is now rendered by TimelineTab component

  const changeStatoMutation = useMutation({
    mutationFn: async (nuovoStato: string) => {
      const vecchioStato = titolo?.stato;
      const { error } = await supabase.from("titoli").update({ stato: nuovoStato, updated_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;

      if (user) {
        await logAttivita({
          azione: "cambio_stato_titolo",
          entita_tipo: "titolo",
          entita_id: id!,
          dettagli_json: { stato_precedente: vecchioStato, nuovo_stato: nuovoStato },
        });
      }

      // Se incassato, calcola provvigioni
      if (nuovoStato === "incassato") {
        await supabase.functions.invoke("calcola-provvigioni", {
          body: { titolo_id: id },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni", id] });
      queryClient.invalidateQueries({ queryKey: ["logs_titolo", id] });
      toast({ title: "Stato aggiornato" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground p-8">Caricamento...</p>;
  if (!titolo) return <p className="text-destructive p-8">Titolo non trovato</p>;

  const t = titolo as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/titoli")}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Titolo {t.numero_titolo || t.id.slice(0, 8)}</h1>
          <p className="text-muted-foreground">{t.prodotti?.nome_prodotto} — {t.prodotti?.compagnie?.nome || "N/D"}</p>
        </div>
        <Badge variant={t.stato === "incassato" ? "default" : t.stato === "stornato" ? "destructive" : "secondary"} className="ml-auto text-sm">
          {t.stato}
        </Badge>
      </div>

      {/* Cambio stato */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Cambia Stato</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          {statiTitolo.filter((s) => s !== t.stato).map((s) => (
            <Button key={s} variant="outline" size="sm" onClick={() => changeStatoMutation.mutate(s)} disabled={changeStatoMutation.isPending}>
              {s}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Dati */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-4 h-4" />Dati Economici</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Premio Lordo</span><span className="font-mono">€ {t.premio_lordo?.toFixed(2) ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Importo Incassato</span><span className="font-mono">€ {t.importo_incassato?.toFixed(2) ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Data Incasso</span><span>{t.data_incasso || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ufficio</span><span>{t.uffici?.nome_ufficio || "—"}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Soggetti</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span>{t.cliente ? `${t.cliente.nome} ${t.cliente.cognome}` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Produttore</span><span>{t.produttore ? `${t.produttore.nome} ${t.produttore.cognome}` : "—"}</span></div>
            {t.note && <div className="pt-2 border-t"><span className="text-muted-foreground">Note:</span> {t.note}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="provvigioni">
        <TabsList>
          <TabsTrigger value="provvigioni"><Percent className="w-4 h-4 mr-1" />Provvigioni ({provvigioni.length})</TabsTrigger>
          <TabsTrigger value="documenti"><FileText className="w-4 h-4 mr-1" />Documenti</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="timeline"><Clock className="w-4 h-4 mr-1" />Timeline</TabsTrigger>
        </TabsList>
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
        <TabsContent value="documenti">
          <Card><CardContent className="pt-6"><DocumentiTab entitaTipo="titolo" entitaId={id!} bucketName="documenti_titoli" /></CardContent></Card>
        </TabsContent>
        <TabsContent value="chat">
          <Card><CardContent className="pt-6"><ChatTab entitaTipo="titolo" entitaId={id!} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="timeline">
          <Card>
            <CardContent className="pt-6">
              <TimelineTab entitaTipo="titolo" entitaId={id!} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TitoloDetail;
