import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowUpRight, ArrowDownLeft, CheckCircle, XCircle, Calculator, CreditCard, GitCompare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ContabilitaUfficio = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  // Movimento form
  const [movOpen, setMovOpen] = useState(false);
  const [movTipo, setMovTipo] = useState("entrata");
  const [movCategoria, setMovCategoria] = useState("");
  const [movImporto, setMovImporto] = useState("");
  const [movData, setMovData] = useState("");
  const [movDescrizione, setMovDescrizione] = useState("");
  const [movRifTipo, setMovRifTipo] = useState("");

  // Estratto form
  const [estOpen, setEstOpen] = useState(false);
  const [estImporto, setEstImporto] = useState("");
  const [estData, setEstData] = useState("");
  const [estDescrizione, setEstDescrizione] = useState("");
  const [estSaldo, setEstSaldo] = useState("");

  // Filtri
  const [filtroTipoMov, setFiltroTipoMov] = useState("all");
  const [filtroStatoMov, setFiltroStatoMov] = useState("all");
  const [filtroEsitoIncr, setFiltroEsitoIncr] = useState("all");

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uffici").select("*").eq("attivo", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: movimenti = [], isLoading: movLoading } = useQuery({
    queryKey: ["movimenti_contabili"],
    queryFn: async () => {
      const { data, error } = await supabase.from("movimenti_contabili").select("*, uffici(nome_ufficio)").order("data_movimento", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: estratti = [], isLoading: estLoading } = useQuery({
    queryKey: ["estratti_conto"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estratti_conto").select("*, uffici(nome_ufficio)").order("data_operazione", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: incroci = [], isLoading: incrLoading } = useQuery({
    queryKey: ["incroci_bancari"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incroci_bancari")
        .select("*, movimenti_contabili(importo, descrizione, data_movimento), estratti_conto(importo, descrizione, data_operazione)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // KPI
  const totEntrate = movimenti.filter((m: any) => m.tipo === "entrata").reduce((s: number, m: any) => s + (m.importo || 0), 0);
  const totUscite = movimenti.filter((m: any) => m.tipo === "uscita").reduce((s: number, m: any) => s + (m.importo || 0), 0);
  const saldo = totEntrate - totUscite;
  const anomalieKO = estratti.filter((e: any) => e.stato === "ko").length;

  // Filtered
  const filteredMov = movimenti.filter((m: any) => {
    if (filtroTipoMov !== "all" && m.tipo !== filtroTipoMov) return false;
    if (filtroStatoMov !== "all" && m.stato !== filtroStatoMov) return false;
    return true;
  });

  const filteredIncr = incroci.filter((i: any) => {
    if (filtroEsitoIncr !== "all" && i.esito !== filtroEsitoIncr) return false;
    return true;
  });

  const createMovMutation = useMutation({
    mutationFn: async () => {
      const ufficioId = (profile as any)?.ufficio_id || uffici[0]?.id;
      const { data, error } = await supabase.from("movimenti_contabili").insert({
        ufficio_id: ufficioId,
        tipo: movTipo,
        categoria: movCategoria || null,
        riferimento_tipo: movRifTipo || "manuale",
        importo: parseFloat(movImporto),
        data_movimento: movData || new Date().toISOString().split("T")[0],
        descrizione: movDescrizione || null,
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      await logAttivita({ azione: "creazione_movimento_contabile", entita_tipo: "movimento_contabile", entita_id: data.id, dettagli_json: { tipo: movTipo, importo: parseFloat(movImporto) } });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimenti_contabili"] });
      setMovOpen(false);
      setMovTipo("entrata"); setMovCategoria(""); setMovImporto(""); setMovData(""); setMovDescrizione(""); setMovRifTipo("");
      toast({ title: "Movimento registrato" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  const createEstMutation = useMutation({
    mutationFn: async () => {
      const ufficioId = (profile as any)?.ufficio_id || uffici[0]?.id;
      const { data, error } = await supabase.from("estratti_conto").insert({
        ufficio_id: ufficioId,
        importo: parseFloat(estImporto),
        data_operazione: estData || new Date().toISOString().split("T")[0],
        descrizione: estDescrizione || null,
        saldo: estSaldo ? parseFloat(estSaldo) : null,
      }).select().single();
      if (error) throw error;

      // Auto-incrocio
      await supabase.functions.invoke("incrocio-bancario", {
        body: { estratto_id: data.id, user_id: user?.id },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estratti_conto"] });
      queryClient.invalidateQueries({ queryKey: ["incroci_bancari"] });
      setEstOpen(false);
      setEstImporto(""); setEstData(""); setEstDescrizione(""); setEstSaldo("");
      toast({ title: "Estratto conto caricato e incrocio eseguito" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  const verificaIncrocioMutation = useMutation({
    mutationFn: async (incrocioId: string) => {
      const { error } = await supabase.from("incroci_bancari").update({ verificato: true }).eq("id", incrocioId);
      if (error) throw error;
      await logAttivita({ azione: "verifica_incasso", entita_tipo: "incrocio_bancario", entita_id: incrocioId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incroci_bancari"] });
      toast({ title: "Incrocio verificato" });
    },
  });

  const verificaManualeMutation = useMutation({
    mutationFn: async ({ id, nuovoStato }: { id: string; nuovoStato: string }) => {
      const { error } = await supabase.from("estratti_conto").update({ stato: nuovoStato }).eq("id", id);
      if (error) throw error;
      await logAttivita({ azione: "verifica_incasso", entita_tipo: "estratto_conto", entita_id: id, dettagli_json: { nuovo_stato: nuovoStato } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estratti_conto"] });
      toast({ title: "Stato aggiornato" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contabilità Ufficio</h1>
        <p className="text-muted-foreground">Gestione contabile per cassa con incrocio bancario</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowDownLeft className="w-4 h-4 text-green-500" />Totale Entrate</div><p className="text-2xl font-bold font-mono mt-1">€ {totEntrate.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowUpRight className="w-4 h-4 text-red-500" />Totale Uscite</div><p className="text-2xl font-bold font-mono mt-1">€ {totUscite.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Calculator className="w-4 h-4" />Saldo</div><p className={`text-2xl font-bold font-mono mt-1 ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>€ {saldo.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><XCircle className="w-4 h-4 text-red-500" />Anomalie KO</div><p className="text-2xl font-bold mt-1">{anomalieKO}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="movimenti">
        <TabsList>
          <TabsTrigger value="movimenti"><Calculator className="w-4 h-4 mr-1" />Movimenti</TabsTrigger>
          <TabsTrigger value="estratti"><CreditCard className="w-4 h-4 mr-1" />Estratti Conto</TabsTrigger>
          <TabsTrigger value="incroci"><GitCompare className="w-4 h-4 mr-1" />Incroci</TabsTrigger>
        </TabsList>

        {/* MOVIMENTI */}
        <TabsContent value="movimenti">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Select value={filtroTipoMov} onValueChange={setFiltroTipoMov}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Tutti</SelectItem><SelectItem value="entrata">Entrate</SelectItem><SelectItem value="uscita">Uscite</SelectItem></SelectContent>
                </Select>
                <Select value={filtroStatoMov} onValueChange={setFiltroStatoMov}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Tutti gli stati</SelectItem><SelectItem value="registrato">Registrato</SelectItem><SelectItem value="verificato">Verificato</SelectItem></SelectContent>
                </Select>
              </div>
              <Dialog open={movOpen} onOpenChange={setMovOpen}>
                <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nuovo Movimento</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nuovo Movimento</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Tipo *</Label>
                      <Select value={movTipo} onValueChange={setMovTipo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="entrata">Entrata</SelectItem><SelectItem value="uscita">Uscita</SelectItem></SelectContent></Select>
                    </div>
                    <div><Label>Importo *</Label><Input type="number" value={movImporto} onChange={(e) => setMovImporto(e.target.value)} /></div>
                    <div><Label>Data</Label><Input type="date" value={movData} onChange={(e) => setMovData(e.target.value)} /></div>
                    <div><Label>Categoria</Label><Input value={movCategoria} onChange={(e) => setMovCategoria(e.target.value)} placeholder="es. premio, rimborso..." /></div>
                    <div><Label>Rif. Tipo</Label><Input value={movRifTipo} onChange={(e) => setMovRifTipo(e.target.value)} placeholder="titolo, rimessa, manuale" /></div>
                    <div><Label>Descrizione</Label><Textarea value={movDescrizione} onChange={(e) => setMovDescrizione(e.target.value)} /></div>
                    <Button onClick={() => createMovMutation.mutate()} disabled={!movImporto || createMovMutation.isPending} className="w-full">Registra</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Importo €</TableHead><TableHead>Data</TableHead><TableHead>Categoria</TableHead><TableHead>Descrizione</TableHead><TableHead>Stato</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredMov.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell><Badge variant={m.tipo === "entrata" ? "default" : "destructive"}>{m.tipo}</Badge></TableCell>
                        <TableCell className="font-mono">€ {m.importo?.toFixed(2)}</TableCell>
                        <TableCell>{m.data_movimento}</TableCell>
                        <TableCell>{m.categoria || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{m.descrizione || "—"}</TableCell>
                        <TableCell><Badge variant={m.stato === "verificato" ? "default" : "outline"}>{m.stato}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {filteredMov.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nessun movimento</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ESTRATTI CONTO */}
        <TabsContent value="estratti">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={estOpen} onOpenChange={setEstOpen}>
                <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nuovo Estratto</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nuovo Estratto Conto</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Importo *</Label><Input type="number" value={estImporto} onChange={(e) => setEstImporto(e.target.value)} /></div>
                    <div><Label>Data Operazione</Label><Input type="date" value={estData} onChange={(e) => setEstData(e.target.value)} /></div>
                    <div><Label>Descrizione</Label><Textarea value={estDescrizione} onChange={(e) => setEstDescrizione(e.target.value)} /></div>
                    <div><Label>Saldo</Label><Input type="number" value={estSaldo} onChange={(e) => setEstSaldo(e.target.value)} /></div>
                    <p className="text-xs text-muted-foreground">All'inserimento verrà eseguito automaticamente l'incrocio con i movimenti contabili.</p>
                    <Button onClick={() => createEstMutation.mutate()} disabled={!estImporto || createEstMutation.isPending} className="w-full">Carica e Incrocia</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader><TableRow><TableHead>Importo €</TableHead><TableHead>Data</TableHead><TableHead>Descrizione</TableHead><TableHead>Saldo €</TableHead><TableHead>Stato</TableHead><TableHead>Azioni</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {estratti.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono">€ {e.importo?.toFixed(2)}</TableCell>
                        <TableCell>{e.data_operazione}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{e.descrizione || "—"}</TableCell>
                        <TableCell className="font-mono">{e.saldo != null ? `€ ${e.saldo.toFixed(2)}` : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={e.stato === "ok" ? "default" : e.stato === "ko" ? "destructive" : "outline"}>
                            {e.stato === "ok" ? <><CheckCircle className="w-3 h-3 mr-1" />OK</> : e.stato === "ko" ? <><XCircle className="w-3 h-3 mr-1" />KO</> : "Da verificare"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {e.stato === "ko" && (
                            <Button size="sm" variant="outline" onClick={() => verificaManualeMutation.mutate({ id: e.id, nuovoStato: "ok" })}>
                              Verifica OK
                            </Button>
                          )}
                          {e.stato === "da_verificare" && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => verificaManualeMutation.mutate({ id: e.id, nuovoStato: "ok" })}>OK</Button>
                              <Button size="sm" variant="destructive" onClick={() => verificaManualeMutation.mutate({ id: e.id, nuovoStato: "ko" })}>KO</Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {estratti.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nessun estratto</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* INCROCI */}
        <TabsContent value="incroci">
          <div className="space-y-4">
            <Select value={filtroEsitoIncr} onValueChange={setFiltroEsitoIncr}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tutti</SelectItem><SelectItem value="ok">OK</SelectItem><SelectItem value="ko">KO</SelectItem></SelectContent>
            </Select>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader><TableRow><TableHead>Esito</TableHead><TableHead>Mov. Importo</TableHead><TableHead>Estr. Importo</TableHead><TableHead>Differenza</TableHead><TableHead>Verificato</TableHead><TableHead>Azioni</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredIncr.map((i: any) => (
                      <TableRow key={i.id}>
                        <TableCell><Badge variant={i.esito === "ok" ? "default" : "destructive"}>{i.esito.toUpperCase()}</Badge></TableCell>
                        <TableCell className="font-mono">{i.movimenti_contabili ? `€ ${i.movimenti_contabili.importo?.toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="font-mono">{i.estratti_conto ? `€ ${i.estratti_conto.importo?.toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="font-mono">{i.differenza?.toFixed(2)}</TableCell>
                        <TableCell><Badge variant={i.verificato ? "default" : "secondary"}>{i.verificato ? "Sì" : "No"}</Badge></TableCell>
                        <TableCell>
                          {!i.verificato && (
                            <Button size="sm" variant="outline" onClick={() => verificaIncrocioMutation.mutate(i.id)}>
                              Segna verificato
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredIncr.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nessun incrocio</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContabilitaUfficio;
