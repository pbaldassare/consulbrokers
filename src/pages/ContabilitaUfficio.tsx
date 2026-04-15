import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowUpRight, ArrowDownLeft, CheckCircle, XCircle, Calculator, CreditCard, GitCompare, ChevronLeft, ChevronRight, Package, ChevronDown, ChevronUp, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";

type TitoloCassa = {
  id: string;
  numero_titolo: string | null;
  premio_lordo: number | null;
  provvigioni_firma: number | null;
  provvigioni_quietanza: number | null;
  compagnia_id: string | null;
  compagnie: { nome: string } | null;
  clienti: { cognome: string | null; nome: string | null; ragione_sociale: string | null } | null;
};

type GruppoCompagnia = {
  nome: string;
  count: number;
  premio_lordo: number;
  provvigioni: number;
  da_rimettere: number;
  compagnia_id: string;
  titoli: TitoloCassa[];
};

const ContabilitaUfficio = () => {
  const navigate = useNavigate();
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

  // Riepilogo Messa a Cassa
  const [meseCorrente, setMeseCorrente] = useState(new Date());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmDialog, setConfirmDialog] = useState<GruppoCompagnia | null>(null);
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), "yyyy-MM-dd"));
  const [ibanSelezionato, setIbanSelezionato] = useState("");

  const meseDa = format(startOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseA = format(endOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseLabel = format(meseCorrente, "MMMM yyyy", { locale: it });

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

  // --- Riepilogo Messa a Cassa queries ---
  const { data: usedTitoliIds = [] } = useQuery({
    queryKey: ["rimessa-dettaglio-used"],
    queryFn: async () => {
      const { data } = await supabase.from("rimessa_dettaglio").select("titolo_id");
      return (data || []).map((r: any) => r.titolo_id);
    },
  });

  const { data: titoliCassa = [] } = useQuery({
    queryKey: ["titoli-cassa-mese", meseDa, meseA, usedTitoliIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, provvigioni_firma, provvigioni_quietanza, compagnia_id, compagnie:compagnie!titoli_compagnia_id_fkey(nome), clienti:clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale)")
        .eq("stato", "incassato")
        .gte("data_messa_cassa", meseDa)
        .lte("data_messa_cassa", meseA);
      if (error) throw error;

      const usedSet = new Set(usedTitoliIds);
      const filtered = (data || []).filter((t: any) => !usedSet.has(t.id));

      const map: Record<string, GruppoCompagnia> = {};
      for (const t of filtered as any[]) {
        const cId = t.compagnia_id || "sconosciuta";
        const cNome = t.compagnie?.nome || "Senza compagnia";
        if (!map[cId]) map[cId] = { nome: cNome, count: 0, premio_lordo: 0, provvigioni: 0, da_rimettere: 0, compagnia_id: cId, titoli: [] };
        const lordo = t.premio_lordo || 0;
        const provv = (t.provvigioni_firma || 0) + (t.provvigioni_quietanza || 0);
        map[cId].count++;
        map[cId].premio_lordo += lordo;
        map[cId].provvigioni += provv;
        map[cId].da_rimettere += lordo - provv;
        map[cId].titoli.push(t);
      }
      return Object.values(map).sort((a, b) => b.da_rimettere - a.da_rimettere);
    },
  });

  const { data: compagniaIban } = useQuery({
    queryKey: ["compagnia-iban", confirmDialog?.compagnia_id],
    queryFn: async () => {
      if (!confirmDialog?.compagnia_id) return null;
      const { data } = await supabase
        .from("compagnie")
        .select("iban, nome")
        .eq("id", confirmDialog.compagnia_id)
        .single();
      return data;
    },
    enabled: !!confirmDialog?.compagnia_id,
  });

  const totaliCassa = titoliCassa.reduce(
    (acc, g) => ({
      count: acc.count + g.count,
      premio_lordo: acc.premio_lordo + g.premio_lordo,
      provvigioni: acc.provvigioni + g.provvigioni,
      da_rimettere: acc.da_rimettere + g.da_rimettere,
    }),
    { count: 0, premio_lordo: 0, provvigioni: 0, da_rimettere: 0 }
  );

  const confirmMutation = useMutation({
    mutationFn: async (gruppo: GruppoCompagnia) => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from("profiles").select("ufficio_id").eq("id", authUser?.id || "").single();

      const { data: rimessa, error: rErr } = await supabase
        .from("rimessa_premi")
        .insert({
          compagnia_id: gruppo.compagnia_id,
          ufficio_id: prof?.ufficio_id || null,
          created_by: authUser?.id || null,
          totale_importi: Math.round(gruppo.da_rimettere * 100) / 100,
          stato: "inviata",
          iban_utilizzato: ibanSelezionato || null,
          data_pagamento_rimessa: dataPagamento || null,
          n_titoli: gruppo.count,
          totale_provvigioni: Math.round(gruppo.provvigioni * 100) / 100,
        } as any)
        .select()
        .single();
      if (rErr) throw rErr;

      const dettagli = gruppo.titoli.map((t) => ({
        rimessa_id: (rimessa as any).id,
        titolo_id: t.id,
        importo: (t.premio_lordo || 0) - ((t.provvigioni_firma || 0) + (t.provvigioni_quietanza || 0)),
      }));
      const { error: dErr } = await supabase.from("rimessa_dettaglio").insert(dettagli);
      if (dErr) throw dErr;

      await logAttivita({
        azione: "conferma_rimessa",
        entita_tipo: "rimessa_premi",
        entita_id: (rimessa as any).id,
        dettagli_json: { compagnia: gruppo.nome, n_titoli: gruppo.count, totale: gruppo.da_rimettere, iban: ibanSelezionato },
      });

      return rimessa;
    },
    onSuccess: () => {
      toast.success("Rimessa confermata e archiviata");
      setConfirmDialog(null);
      queryClient.invalidateQueries({ queryKey: ["rimessa_premi"] });
      queryClient.invalidateQueries({ queryKey: ["titoli-cassa-mese"] });
      queryClient.invalidateQueries({ queryKey: ["rimessa-dettaglio-used"] });
    },
    onError: (e: any) => toast.error(e.message || "Errore nella conferma"),
  });

  // KPI
  const totEntrate = movimenti.filter((m: any) => m.tipo === "entrata").reduce((s: number, m: any) => s + (m.importo || 0), 0);
  const totUscite = movimenti.filter((m: any) => m.tipo === "uscita").reduce((s: number, m: any) => s + (m.importo || 0), 0);
  const saldo = totEntrate - totUscite;
  const anomalieKO = estratti.filter((e: any) => e.stato === "ko").length;

  const fmt = (n: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

  const filteredMov = movimenti.filter((m: any) => {
    if (filtroTipoMov !== "all" && m.tipo !== filtroTipoMov) return false;
    if (filtroStatoMov !== "all" && m.stato !== filtroStatoMov) return false;
    return true;
  });

  const filteredIncr = incroci.filter((i: any) => {
    if (filtroEsitoIncr !== "all" && i.esito !== filtroEsitoIncr) return false;
    return true;
  });

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const clienteDisplay = (t: TitoloCassa) => {
    const c = t.clienti;
    if (!c) return "—";
    return c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim() || "—";
  };

  const openConfirm = (g: GruppoCompagnia) => {
    setDataPagamento(format(new Date(), "yyyy-MM-dd"));
    setIbanSelezionato("");
    setConfirmDialog(g);
  };

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
      toast.success("Movimento registrato");
    },
    onError: (err: any) => toast.error("Errore"),
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
      toast.success("Estratto conto caricato e incrocio eseguito");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const verificaIncrocioMutation = useMutation({
    mutationFn: async (incrocioId: string) => {
      const { error } = await supabase.from("incroci_bancari").update({ verificato: true }).eq("id", incrocioId);
      if (error) throw error;
      await logAttivita({ azione: "verifica_incasso", entita_tipo: "incrocio_bancario", entita_id: incrocioId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incroci_bancari"] });
      toast.success("Incrocio verificato");
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
      toast.success("Stato aggiornato");
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
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <ArrowDownLeft className="w-3.5 h-3.5" /> Totale Entrate
            </CardDescription>
            <CardTitle className="text-xl text-green-600">{fmt(totEntrate)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{movimenti.filter((m: any) => m.tipo === "entrata").length} movimenti</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <ArrowUpRight className="w-3.5 h-3.5" /> Totale Uscite
            </CardDescription>
            <CardTitle className="text-xl text-red-600">{fmt(totUscite)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{movimenti.filter((m: any) => m.tipo === "uscita").length} movimenti</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${saldo >= 0 ? "border-l-blue-500" : "border-l-orange-500"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Calculator className="w-3.5 h-3.5" /> Saldo
            </CardDescription>
            <CardTitle className={`text-xl ${saldo >= 0 ? "text-blue-600" : "text-orange-600"}`}>{fmt(saldo)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{movimenti.length} mov. totali</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${anomalieKO > 0 ? "border-l-destructive" : "border-l-green-500"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <XCircle className="w-3.5 h-3.5" /> Anomalie KO
            </CardDescription>
            <CardTitle className={`text-xl ${anomalieKO > 0 ? "text-destructive" : ""}`}>{anomalieKO}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">estratti non riconciliati</p>
          </CardContent>
        </Card>
      </div>

      {/* Riepilogo Messa a Cassa */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMeseCorrente((prev) => subMonths(prev, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold capitalize min-w-[140px] text-center">{meseLabel}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMeseCorrente((prev) => addMonths(prev, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Package className="w-5 h-5" />Riepilogo Messa a Cassa — {meseLabel}</CardTitle></CardHeader>
          <CardContent>
            {titoliCassa.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun titolo messo a cassa nel mese selezionato</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Compagnia</TableHead>
                    <TableHead className="text-right">Titoli</TableHead>
                    <TableHead className="text-right">Premio Lordo</TableHead>
                    <TableHead className="text-right">Provvigioni</TableHead>
                    <TableHead className="text-right">Da Rimettere</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {titoliCassa.map((g) => (
                    <>
                      <TableRow key={g.compagnia_id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(g.compagnia_id)}>
                        <TableCell className="px-2">
                          {expanded[g.compagnia_id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </TableCell>
                        <TableCell className="font-medium">{g.nome}</TableCell>
                        <TableCell className="text-right">{g.count}</TableCell>
                        <TableCell className="text-right font-mono">€ {g.premio_lordo.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">€ {g.provvigioni.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">€ {g.da_rimettere.toFixed(2)}</TableCell>
                        <TableCell className="px-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); openConfirm(g); }}>
                            <Check className="w-3 h-3 mr-1" />Conferma
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expanded[g.compagnia_id] && (
                        <TableRow key={`${g.compagnia_id}-detail`}>
                          <TableCell colSpan={7} className="bg-muted/30 p-0">
                            <div className="p-3">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>N° Titolo</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead className="text-right">Premio Lordo</TableHead>
                                    <TableHead className="text-right">Provvigioni</TableHead>
                                    <TableHead className="text-right">Netto</TableHead>
                                    <TableHead className="w-8"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {g.titoli.map((t) => {
                                    const lordo = t.premio_lordo || 0;
                                    const provv = (t.provvigioni_firma || 0) + (t.provvigioni_quietanza || 0);
                                    return (
                                      <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/titoli/${t.id}`)}>
                                        <TableCell className="font-mono text-sm">{t.numero_titolo || "—"}</TableCell>
                                        <TableCell className="text-sm">{clienteDisplay(t)}</TableCell>
                                        <TableCell className="text-right font-mono text-sm">€ {lordo.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono text-sm">€ {provv.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono text-sm font-semibold">€ {(lordo - provv).toFixed(2)}</TableCell>
                                        <TableCell><ExternalLink className="w-3 h-3 text-muted-foreground" /></TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell />
                    <TableCell className="font-bold">Totale</TableCell>
                    <TableCell className="text-right font-bold">{totaliCassa.count}</TableCell>
                    <TableCell className="text-right font-mono font-bold">€ {totaliCassa.premio_lordo.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">€ {totaliCassa.provvigioni.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">€ {totaliCassa.da_rimettere.toFixed(2)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog conferma rimessa */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Rimessa — {confirmDialog?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Titoli:</span> <strong>{confirmDialog?.count}</strong></div>
              <div><span className="text-muted-foreground">Premio Lordo:</span> <strong className="font-mono">€ {confirmDialog?.premio_lordo?.toFixed(2)}</strong></div>
              <div><span className="text-muted-foreground">Provvigioni:</span> <strong className="font-mono">€ {confirmDialog?.provvigioni?.toFixed(2)}</strong></div>
              <div><span className="text-muted-foreground">Da Rimettere:</span> <strong className="font-mono text-primary">€ {confirmDialog?.da_rimettere?.toFixed(2)}</strong></div>
            </div>

            <div className="space-y-2">
              <Label>Data Pagamento</Label>
              <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>IBAN Compagnia</Label>
              {compagniaIban?.iban ? (
                <Select value={ibanSelezionato} onValueChange={setIbanSelezionato}>
                  <SelectTrigger><SelectValue placeholder="Seleziona IBAN" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={compagniaIban.iban}>{compagniaIban.iban}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="Inserisci IBAN manualmente" value={ibanSelezionato} onChange={(e) => setIbanSelezionato(e.target.value)} />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Annulla</Button>
            <Button onClick={() => confirmDialog && confirmMutation.mutate(confirmDialog)} disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? "Salvataggio..." : "Conferma Rimessa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
