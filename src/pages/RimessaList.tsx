import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, ChevronLeft, ChevronRight, Package, ChevronDown, ChevronUp, ExternalLink, Check, Undo2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";

const PAGE_SIZE = 25;
const statiRimessa = ["bozza", "pronta", "inviata", "errore"];

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

const RimessaList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtroStato, setFiltroStato] = useState("all");
  const [page, setPage] = useState(0);
  const [meseCorrente, setMeseCorrente] = useState(new Date());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmDialog, setConfirmDialog] = useState<GruppoCompagnia | null>(null);
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), "yyyy-MM-dd"));
  const [ibanSelezionato, setIbanSelezionato] = useState("");

  const meseDa = format(startOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseA = format(endOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseLabel = format(meseCorrente, "MMMM yyyy", { locale: it });

  // Fetch titoli già collegati a rimesse
  const { data: usedTitoliIds = [] } = useQuery({
    queryKey: ["rimessa-dettaglio-used"],
    queryFn: async () => {
      const { data } = await supabase.from("rimessa_dettaglio").select("titolo_id");
      return (data || []).map((r: any) => r.titolo_id);
    },
  });

  // Titoli messi a cassa nel mese con dettagli per espansione
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

  // Fetch IBAN della compagnia selezionata per il dialog
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

  const totali = titoliCassa.reduce(
    (acc, g) => ({
      count: acc.count + g.count,
      premio_lordo: acc.premio_lordo + g.premio_lordo,
      provvigioni: acc.provvigioni + g.provvigioni,
      da_rimettere: acc.da_rimettere + g.da_rimettere,
    }),
    { count: 0, premio_lordo: 0, provvigioni: 0, da_rimettere: 0 }
  );

  // Conferma rimessa mutation
  const confirmMutation = useMutation({
    mutationFn: async (gruppo: GruppoCompagnia) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("ufficio_id").eq("id", user?.id || "").single();

      const { data: rimessa, error: rErr } = await supabase
        .from("rimessa_premi")
        .insert({
          compagnia_id: gruppo.compagnia_id,
          ufficio_id: profile?.ufficio_id || null,
          created_by: user?.id || null,
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

  // Revert rimessa mutation
  const revertMutation = useMutation({
    mutationFn: async (rimessaId: string) => {
      const { error: dErr } = await supabase.from("rimessa_dettaglio").delete().eq("rimessa_id", rimessaId);
      if (dErr) throw dErr;
      const { error: rErr } = await supabase.from("rimessa_premi").delete().eq("id", rimessaId);
      if (rErr) throw rErr;
      await logAttivita({
        azione: "annullamento_rimessa",
        entita_tipo: "rimessa_premi",
        entita_id: rimessaId,
      });
    },
    onSuccess: () => {
      toast.success("Rimessa annullata — i titoli sono tornati nel riepilogo");
      queryClient.invalidateQueries({ queryKey: ["rimessa_premi"] });
      queryClient.invalidateQueries({ queryKey: ["titoli-cassa-mese"] });
      queryClient.invalidateQueries({ queryKey: ["rimessa-dettaglio-used"] });
    },
    onError: (e: any) => toast.error(e.message || "Errore nell'annullamento"),
  });

      return rimessa;
    },
    onSuccess: () => {
      toast.success("Rimessa confermata e archiviata");
      setConfirmDialog(null);
      queryClient.invalidateQueries({ queryKey: ["rimessa_premi"] });
      queryClient.invalidateQueries({ queryKey: ["titoli-cassa-mese"] });
    },
    onError: (e: any) => toast.error(e.message || "Errore nella conferma"),
  });

  const { data: rimesseResult, isLoading } = useQuery({
    queryKey: ["rimessa_premi", page, filtroStato, meseDa, meseA],
    queryFn: async () => {
      let q = supabase
        .from("rimessa_premi")
        .select("*, compagnie(nome), uffici(nome_ufficio), profiles(nome, cognome)", { count: "exact" });

      if (filtroStato !== "all") q = q.eq("stato", filtroStato);

      const { data, error, count } = await q
        .order("data_creazione", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const rimesse = rimesseResult?.data || [];
  const totalCount = rimesseResult?.count || 0;

  const statoBadge = (s: string) => {
    switch (s) {
      case "pronta": return "default";
      case "inviata": return "secondary";
      case "errore": return "destructive";
      default: return "outline";
    }
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rimessa Premi</h1>
        <p className="text-muted-foreground">Riepilogo premi messi a cassa per compagnia</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMeseCorrente((prev) => subMonths(prev, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold capitalize min-w-[140px] text-center">{meseLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMeseCorrente((prev) => addMonths(prev, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Select value={filtroStato} onValueChange={(v) => { setFiltroStato(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {statiRimessa.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Riepilogo premi per compagnia — espandibile */}
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
                  <TableCell className="text-right font-bold">{totali.count}</TableCell>
                  <TableCell className="text-right font-mono font-bold">€ {totali.premio_lordo.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">€ {totali.provvigioni.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">€ {totali.da_rimettere.toFixed(2)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

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

      {/* Storico rimesse */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Send className="w-5 h-5" />Storico Rimesse ({totalCount})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Caricamento...</p> : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compagnia</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead className="text-right">Importo €</TableHead>
                    <TableHead>IBAN</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Stato</TableHead>
                     <TableHead>Creata da</TableHead>
                     <TableHead>Data</TableHead>
                     <TableHead className="w-10"></TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {rimesse.map((r: any) => (
                     <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/rimessa-premi/${r.id}`)}>
                       <TableCell className="font-medium">{r.compagnie?.nome || "—"}</TableCell>
                       <TableCell>{r.uffici?.nome_ufficio || "—"}</TableCell>
                       <TableCell className="text-right font-mono">€ {(r.totale_importi ?? 0).toFixed(2)}</TableCell>
                       <TableCell className="font-mono text-xs">{r.iban_utilizzato || "—"}</TableCell>
                       <TableCell>{r.data_pagamento_rimessa ? format(new Date(r.data_pagamento_rimessa), "dd/MM/yyyy") : "—"}</TableCell>
                       <TableCell><Badge variant={statoBadge(r.stato)}>{r.stato}</Badge></TableCell>
                       <TableCell>{r.profiles ? `${r.profiles.nome} ${r.profiles.cognome}` : "—"}</TableCell>
                       <TableCell>{r.data_creazione ? format(new Date(r.data_creazione), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                       <TableCell>
                         <Button
                           size="sm"
                           variant="ghost"
                           className="h-7 text-xs text-destructive hover:text-destructive"
                           onClick={(e) => {
                             e.stopPropagation();
                             if (window.confirm(`Annullare la rimessa per ${r.compagnie?.nome || "questa compagnia"}? I titoli torneranno nel riepilogo.`)) {
                               revertMutation.mutate(r.id);
                             }
                           }}
                           disabled={revertMutation.isPending}
                         >
                           <Undo2 className="w-3 h-3 mr-1" />Annulla
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))}
                   {rimesse.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nessuna rimessa archiviata</TableCell></TableRow>}
                 </TableBody>
               </Table>
               <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
             </>
           )}
         </CardContent>
       </Card>
     </div>
   );
 };
 
 export default RimessaList;
