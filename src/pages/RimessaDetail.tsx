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
import { ArrowLeft, FileText, Code, Clock, Send, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const RimessaDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: rimessa, isLoading } = useQuery({
    queryKey: ["rimessa", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rimessa_premi")
        .select("*, compagnie(nome, codice), uffici(nome_ufficio), profiles(nome, cognome)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: dettagli = [] } = useQuery({
    queryKey: ["rimessa_dettaglio", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rimessa_dettaglio")
        .select("*, titoli(numero_titolo, premio_lordo, importo_incassato, data_incasso, prodotti(nome_prodotto))")
        .eq("rimessa_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["logs_rimessa", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("log_attivita")
        .select("*")
        .eq("entita_tipo", "rimessa_premi")
        .eq("entita_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const generateXmlMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gestione-rimessa", {
        body: { action: "genera_xml", rimessa_id: id, created_by: user?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rimessa", id] });
      queryClient.invalidateQueries({ queryKey: ["logs_rimessa", id] });
      toast({ title: "XML generato, rimessa pronta" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  const changeStatoMutation = useMutation({
    mutationFn: async (nuovoStato: string) => {
      const vecchioStato = (rimessa as any)?.stato;
      const { error } = await supabase.from("rimessa_premi").update({ stato: nuovoStato, updated_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;
      await logAttivita({
        azione: "cambio_stato_rimessa",
        entita_tipo: "rimessa_premi",
        entita_id: id!,
        dettagli_json: { stato_precedente: vecchioStato, nuovo_stato: nuovoStato },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rimessa", id] });
      queryClient.invalidateQueries({ queryKey: ["logs_rimessa", id] });
      toast({ title: "Stato aggiornato" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground p-8">Caricamento...</p>;
  if (!rimessa) return <p className="text-destructive p-8">Rimessa non trovata</p>;

  const r = rimessa as any;
  const isBozza = r.stato === "bozza";

  const statoBadge = (s: string) => {
    switch (s) {
      case "pronta": return "default";
      case "inviata": return "secondary";
      case "errore": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rimessa-premi")}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rimessa {r.compagnie?.nome}</h1>
          <p className="text-muted-foreground">ID: {r.id.slice(0, 8)} — {r.data_creazione ? format(new Date(r.data_creazione), "dd/MM/yyyy", { locale: it }) : ""}</p>
        </div>
        <Badge variant={statoBadge(r.stato)} className="ml-auto text-sm">{r.stato}</Badge>
      </div>

      {/* Azioni */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Azioni</CardTitle></CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          {isBozza && (
            <Button onClick={() => generateXmlMutation.mutate()} disabled={generateXmlMutation.isPending}>
              <Code className="w-4 h-4 mr-2" />Genera XML
            </Button>
          )}
          {r.stato === "pronta" && (
            <Button onClick={() => changeStatoMutation.mutate("inviata")} disabled={changeStatoMutation.isPending}>
              <Send className="w-4 h-4 mr-2" />Segna come Inviata
            </Button>
          )}
          {r.stato !== "errore" && r.stato !== "bozza" && (
            <Button variant="destructive" onClick={() => changeStatoMutation.mutate("errore")} disabled={changeStatoMutation.isPending}>
              <AlertTriangle className="w-4 h-4 mr-2" />Segna Errore
            </Button>
          )}
          {r.stato === "errore" && (
            <Button variant="outline" onClick={() => changeStatoMutation.mutate("bozza")} disabled={changeStatoMutation.isPending}>
              Riporta a Bozza
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Compagnia</p><p className="text-lg font-bold">{r.compagnie?.nome}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Totale Importi</p><p className="text-lg font-bold font-mono">€ {r.totale_importi?.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Titoli Inclusi</p><p className="text-lg font-bold">{dettagli.length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="titoli">
        <TabsList>
          <TabsTrigger value="titoli"><FileText className="w-4 h-4 mr-1" />Titoli ({dettagli.length})</TabsTrigger>
          <TabsTrigger value="xml"><Code className="w-4 h-4 mr-1" />XML</TabsTrigger>
          <TabsTrigger value="log"><Clock className="w-4 h-4 mr-1" />Log ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="titoli">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N. Titolo</TableHead>
                    <TableHead>Prodotto</TableHead>
                    <TableHead>Premio €</TableHead>
                    <TableHead>Incassato €</TableHead>
                    <TableHead>Importo Rimessa €</TableHead>
                    <TableHead>Data Incasso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dettagli.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.titoli?.numero_titolo || "—"}</TableCell>
                      <TableCell>{d.titoli?.prodotti?.nome_prodotto || "—"}</TableCell>
                      <TableCell className="font-mono">{d.titoli?.premio_lordo?.toFixed(2) ?? "—"}</TableCell>
                      <TableCell className="font-mono">{d.titoli?.importo_incassato?.toFixed(2) ?? "—"}</TableCell>
                      <TableCell className="font-mono">{d.importo?.toFixed(2) ?? "—"}</TableCell>
                      <TableCell>{d.titoli?.data_incasso || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {dettagli.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nessun titolo</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="xml">
          <Card>
            <CardContent className="pt-6">
              {r.xml_output ? (
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">{r.xml_output}</pre>
              ) : (
                <p className="text-center text-muted-foreground">XML non ancora generato. Usa "Genera XML" per crearlo.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {logs.map((l: any) => (
                <div key={l.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{l.azione}</p>
                    {l.dettagli_json && <p className="text-xs text-muted-foreground mt-1">{JSON.stringify(l.dettagli_json)}</p>}
                    <p className="text-xs text-muted-foreground">{l.created_at ? format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: it }) : ""}</p>
                  </div>
                </div>
              ))}
              {logs.length === 0 && <p className="text-center text-muted-foreground text-sm">Nessuna attività</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* API info */}
      {(r.api_endpoint || r.api_response) && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Info API (predisposizione)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {r.api_endpoint && <div><span className="text-muted-foreground">Endpoint:</span> {r.api_endpoint}</div>}
            {r.api_response && <div><span className="text-muted-foreground">Response:</span> <pre className="text-xs bg-muted p-2 rounded mt-1">{r.api_response}</pre></div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RimessaDetail;
