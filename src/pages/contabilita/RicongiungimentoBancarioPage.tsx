import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import RoleGuard from "@/components/RoleGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, Wallet, ChevronDown, Download, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { fmtEuro } from "@/lib/formatCurrency";
import * as XLSX from "xlsx";
import { MessaCassaDialog } from "@/components/portafoglio/MessaCassaDialog";
import { notificaSedeMovimentoBancario } from "@/lib/notificheMovimentiBancari";

const round2 = (n: number) => Math.round(n * 100) / 100;
const TOLL = 0.01;

const Page = () => {
  const { profile, isAdmin } = useAuth();
  const isCfo = profile?.ruolo === "cfo";
  const seeAll = isAdmin || isCfo;
  return (
    <RoleGuard allowedRoles={["admin", "cfo", "ufficio", "backoffice", "contabilita"]} permissionKey="contabilita">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Ricongiungimento Bancario</h1>
          <p className="text-sm text-muted-foreground">Collega i movimenti bancari alle polizze e mettile a cassa.</p>
        </div>

        <Tabs defaultValue="da-ricongiungere">
          <TabsList>
            <TabsTrigger value="da-ricongiungere">Da Ricongiungere</TabsTrigger>
            <TabsTrigger value="storico">Storico</TabsTrigger>
          </TabsList>

          <TabsContent value="da-ricongiungere">
            <DaRicongiungereTab profileUfficio={profile?.ufficio_id ?? null} seeAll={seeAll} />
          </TabsContent>

          <TabsContent value="storico">
            <StoricoTab profileUfficio={profile?.ufficio_id ?? null} seeAll={seeAll} />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
};

// === Tab: Da Ricongiungere ===
const DaRicongiungereTab = ({ profileUfficio, seeAll }: { profileUfficio: string | null; seeAll: boolean }) => {
  const qc = useQueryClient();
  const [filtroUfficio, setFiltroUfficio] = useState<string>("");

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-all"],
    enabled: seeAll,
    queryFn: async () => (await supabase.from("uffici").select("id, nome").order("nome")).data ?? [],
  });

  const { data: movs = [], isLoading } = useQuery({
    queryKey: ["mov-bancari", "ricongiungimento", profileUfficio, filtroUfficio, seeAll],
    queryFn: async () => {
      let q = supabase.from("movimenti_bancari" as any)
        .select("id, data_movimento, importo, ordinante, descrizione, stato, ufficio_id, cliente_id, cliente:clienti(id, ragione_sociale, nome, cognome)")
        .in("stato", ["assegnato", "ricongiunti"])
        .order("data_movimento", { ascending: false })
        .limit(200);
      if (!seeAll && profileUfficio) q = q.eq("ufficio_id", profileUfficio);
      if (seeAll && filtroUfficio) q = q.eq("ufficio_id", filtroUfficio);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        {seeAll && (
          <div className="flex items-end gap-2">
            <div>
              <Label>Ufficio</Label>
              <select value={filtroUfficio} onChange={(e) => setFiltroUfficio(e.target.value)} className="h-9 px-2 border rounded-md text-sm bg-background">
                <option value="">Tutti</option>
                {(uffici as any[]).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? <p className="text-sm">Caricamento…</p> :
          movs.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nessun movimento da ricongiungere</p> :
          movs.map((m: any) => <MovimentoCard key={m.id} movimento={m} onChanged={() => qc.invalidateQueries({ queryKey: ["mov-bancari"] })} />)}
      </CardContent>
    </Card>
  );
};

// === Card movimento espandibile ===
const MovimentoCard = ({ movimento, onChanged }: { movimento: any; onChanged: () => void }) => {
  const [open, setOpen] = useState(false);
  const cliNome = movimento.cliente?.ragione_sociale || [movimento.cliente?.nome, movimento.cliente?.cognome].filter(Boolean).join(" ") || "—";

  // Polizze attive del cliente
  const { data: polizze = [] } = useQuery({
    queryKey: ["polizze-cliente", movimento.cliente_id],
    enabled: open && !!movimento.cliente_id,
    queryFn: async () => {
      const { data } = await supabase.from("titoli")
        .select("id, numero_titolo, premio_lordo, stato, data_messa_cassa, ramo_label:rami(nome), compagnia:compagnie(nome)" as any)
        .eq("cliente_anagrafica_id", movimento.cliente_id)
        .is("data_messa_cassa", null)
        .neq("stato", "annullato")
        .order("data_decorrenza", { ascending: false })
        .limit(50);
      return (data as any[]) ?? [];
    },
  });

  // Ricongiungimenti già salvati (per pre-popolare la UI)
  const { data: esistente = null } = useQuery({
    queryKey: ["mov-cliente-by-mov", movimento.id],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("movimenti_clienti" as any)
        .select("id, importo_assegnato, anticipo, ammanco, note, movimenti_polizze(id, titolo_id, importo, tipo, messo_a_cassa, data_messa_cassa)")
        .eq("movimento_id", movimento.id)
        .maybeSingle();
      return data as any;
    },
  });

  // Stato locale: polizze selezionate
  const [selPol, setSelPol] = useState<Record<string, number>>({});
  const [anticipo, setAnticipo] = useState(0);
  const [ammanco, setAmmanco] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [cassaOpen, setCassaOpen] = useState(false);
  const [cassaTitoli, setCassaTitoli] = useState<any[]>([]);

  useEffect(() => {
    if (!esistente) return;
    const map: Record<string, number> = {};
    for (const mp of (esistente.movimenti_polizze ?? [])) {
      if (mp.tipo === "polizza" && mp.titolo_id) map[mp.titolo_id] = Number(mp.importo) || 0;
    }
    setSelPol(map);
    setAnticipo(Number(esistente.anticipo) || 0);
    setAmmanco(Number(esistente.ammanco) || 0);
    setNote(esistente.note || "");
  }, [esistente]);

  const totalePolizze = useMemo(() => round2(Object.values(selPol).reduce((s, v) => s + (Number(v) || 0), 0)), [selPol]);
  const totale = round2(totalePolizze + (Number(anticipo) || 0) + (Number(ammanco) || 0));
  const delta = round2((Number(movimento.importo) || 0) - totale);
  const quadra = Math.abs(delta) < TOLL;

  const togglePol = (id: string, suggested: number) => {
    setSelPol((p) => {
      if (id in p) { const { [id]: _, ...rest } = p; return rest; }
      return { ...p, [id]: suggested };
    });
  };

  const salvaRicongiungimento = async () => {
    if (totale <= 0) { toast.error("Inserisci almeno una voce"); return; }
    setSaving(true);
    try {
      // Upsert movimenti_clienti
      let mcId = esistente?.id;
      if (mcId) {
        await supabase.from("movimenti_clienti" as any).update({
          importo_assegnato: totale,
          anticipo, ammanco, note: note || null,
        } as any).eq("id", mcId);
        await supabase.from("movimenti_polizze" as any).delete().eq("movimento_cliente_id", mcId);
      } else {
        const { data: ins, error } = await supabase.from("movimenti_clienti" as any).insert({
          movimento_id: movimento.id,
          cliente_id: movimento.cliente_id,
          ufficio_id: movimento.ufficio_id,
          importo_assegnato: totale,
          anticipo, ammanco, note: note || null,
        } as any).select("id").single();
        if (error) throw error;
        mcId = (ins as any).id;
      }

      const righe: any[] = [];
      for (const [titoloId, importo] of Object.entries(selPol)) {
        if (importo > 0) righe.push({ movimento_cliente_id: mcId, titolo_id: titoloId, importo, tipo: "polizza" });
      }
      if (anticipo > 0) righe.push({ movimento_cliente_id: mcId, titolo_id: null, importo: anticipo, tipo: "anticipo" });
      if (ammanco > 0) righe.push({ movimento_cliente_id: mcId, titolo_id: null, importo: ammanco, tipo: "ammanco" });
      if (righe.length > 0) {
        const { error } = await supabase.from("movimenti_polizze" as any).insert(righe);
        if (error) throw error;
      }

      await supabase.from("movimenti_bancari" as any).update({ stato: "ricongiunti" } as any).eq("id", movimento.id);

      const cliNome = movimento.cliente?.ragione_sociale || [movimento.cliente?.nome, movimento.cliente?.cognome].filter(Boolean).join(" ") || "—";
      await notificaSedeMovimentoBancario({
        evento: "ricongiunto",
        movimentoId: movimento.id,
        ufficioId: movimento.ufficio_id,
        importo: Number(movimento.importo) || 0,
        clienteLabel: cliNome,
        statoNuovo: "ricongiunti",
        note: `${Object.keys(selPol).length} polizze`,
      });
      toast.success("Ricongiungimento salvato");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  // === Metti a Cassa: apre il MessaCassaDialog con le polizze selezionate ===
  const apriMessaCassa = async () => {
    if (!quadra) { toast.error(`Non quadra: delta ${fmtEuro(delta)}`); return; }
    const titoliIds = Object.entries(selPol).filter(([, v]) => v > 0).map(([id]) => id);
    if (titoliIds.length === 0) { toast.error("Nessuna polizza selezionata"); return; }
    const { data: titoli, error } = await supabase
      .from("titoli")
      .select("id, numero_titolo, premio_lordo, cliente_anagrafica_id, ufficio_id")
      .in("id", titoliIds);
    if (error) { toast.error(error.message); return; }
    setCassaTitoli(titoli ?? []);
    setCassaOpen(true);
  };

  // Callback dopo conferma MessaCassaDialog: aggiorna movimenti_bancari + notifica
  const onCassaSuccess = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: mc } = await supabase.from("movimenti_clienti" as any)
      .select("id")
      .eq("movimento_id", movimento.id).maybeSingle();
    const mcId = (mc as any)?.id;
    if (mcId) {
      await supabase.from("movimenti_polizze" as any)
        .update({ messo_a_cassa: true, data_messa_cassa: today } as any)
        .eq("movimento_cliente_id", mcId);
    }
    await supabase.from("movimenti_bancari" as any).update({ stato: "incassato" } as any).eq("id", movimento.id);

    const cliNome = movimento.cliente?.ragione_sociale || [movimento.cliente?.nome, movimento.cliente?.cognome].filter(Boolean).join(" ") || "—";
    await notificaSedeMovimentoBancario({
      evento: "messo_a_cassa",
      movimentoId: movimento.id,
      ufficioId: movimento.ufficio_id,
      importo: Number(movimento.importo) || 0,
      clienteLabel: cliNome,
      statoNuovo: "incassato",
      note: `${cassaTitoli.length} polizze`,
    });
    toast.success(`Messa a cassa completata: ${cassaTitoli.length} polizze`);
    setCassaOpen(false);
    onChanged();
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <div className="p-4 cursor-pointer hover:bg-muted/40 flex items-center justify-between">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">Data: </span><span className="font-medium">{movimento.data_movimento}</span></div>
              <div><span className="text-muted-foreground">Ordinante: </span><span className="font-medium">{movimento.ordinante || "—"}</span></div>
              <div><span className="text-muted-foreground">Cliente: </span><span className="font-medium">{cliNome}</span></div>
              <div className="text-right md:text-left"><span className="text-muted-foreground">Importo: </span><span className="font-bold tabular-nums">{fmtEuro(movimento.importo)}</span></div>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <Badge variant={movimento.stato === "ricongiunti" ? "outline" : "default"}>{movimento.stato}</Badge>
              <ChevronDown className={`w-4 h-4 transition ${open ? "rotate-180" : ""}`} />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="border-t space-y-4 pt-4">
            {/* Cliente */}
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Cliente</h4>
              {movimento.cliente_id ? (
                <Link to={`/archivi/clienti/${movimento.cliente_id}`} className="text-sm text-primary underline flex items-center gap-1">
                  {cliNome} <ExternalLink className="w-3 h-3" />
                </Link>
              ) : <span className="text-sm text-muted-foreground">Nessun cliente associato</span>}
            </div>

            {/* Polizze */}
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Polizze attive</h4>
              {polizze.length === 0 ? <p className="text-sm text-muted-foreground">Nessuna polizza in carico per questo cliente.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Numero</TableHead><TableHead>Ramo</TableHead><TableHead>Compagnia</TableHead>
                    <TableHead className="text-right">Premio</TableHead><TableHead className="text-right w-32">Importo da collegare</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {polizze.map((p: any, i: number) => {
                      const sel = p.id in selPol;
                      const lordo = Number(p.premio_lordo) || 0;
                      return (
                        <TableRow key={p.id} className={i % 2 ? "bg-muted/30" : ""}>
                          <TableCell><Checkbox checked={sel} onCheckedChange={() => togglePol(p.id, lordo)} /></TableCell>
                          <TableCell className="text-sm">{p.numero_titolo}</TableCell>
                          <TableCell className="text-sm">{p.ramo_label?.nome ?? "—"}</TableCell>
                          <TableCell className="text-sm">{p.compagnia?.nome ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{fmtEuro(lordo)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              disabled={!sel} type="number" step="0.01"
                              value={sel ? selPol[p.id] : ""}
                              onChange={(e) => setSelPol((s) => ({ ...s, [p.id]: Number(e.target.value) || 0 }))}
                              className="h-8 w-28 text-right tabular-nums"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Anticipi / Ammanchi */}
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Anticipo (€)</Label>
                <Input type="number" step="0.01" value={anticipo || ""} onChange={(e) => setAnticipo(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Ammanco (€)</Label>
                <Input type="number" step="0.01" value={ammanco || ""} onChange={(e) => setAmmanco(Number(e.target.value) || 0)} />
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {/* Quadratura */}
            <div className={`p-3 rounded-md flex justify-between text-sm ${quadra ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}>
              <span>Totale assegnato: <strong className="tabular-nums">{fmtEuro(totale)}</strong> · Movimento: <strong className="tabular-nums">{fmtEuro(movimento.importo)}</strong></span>
              <span>{quadra ? "✓ Quadra" : `Delta: ${fmtEuro(delta)}`}</span>
            </div>

            {/* Azioni */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={salvaRicongiungimento} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> Salva Ricongiungimento
              </Button>
              <Button onClick={apriMessaCassa} disabled={!quadra}>
                <Wallet className="w-4 h-4 mr-1" /> Metti a Cassa
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
      <MessaCassaDialog
        open={cassaOpen}
        onOpenChange={setCassaOpen}
        titoli={cassaTitoli}
        onSuccess={onCassaSuccess}
      />
    </Collapsible>
  );
};

// === Tab: Storico ===
const StoricoTab = ({ profileUfficio, seeAll }: { profileUfficio: string | null; seeAll: boolean }) => {
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [cliente, setCliente] = useState("");

  const { data: movs = [] } = useQuery({
    queryKey: ["mov-bancari", "storico", profileUfficio, seeAll, dal, al, cliente],
    queryFn: async () => {
      let q = supabase.from("movimenti_bancari" as any)
        .select("id, data_movimento, importo, ordinante, ufficio_id, cliente:clienti(id, ragione_sociale, nome, cognome), ufficio:uffici(nome)")
        .eq("stato", "incassato")
        .order("data_movimento", { ascending: false })
        .limit(500);
      if (!seeAll && profileUfficio) q = q.eq("ufficio_id", profileUfficio);
      if (dal) q = q.gte("data_movimento", dal);
      if (al) q = q.lte("data_movimento", al);
      const { data } = await q;
      let rows = (data as any[]) ?? [];
      if (cliente) {
        const c = cliente.toLowerCase();
        rows = rows.filter((m) => {
          const n = (m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "").toLowerCase();
          return n.includes(c);
        });
      }
      return rows;
    },
  });

  const exportXlsx = () => {
    const rows = movs.map((m: any) => ({
      Data: m.data_movimento,
      Ordinante: m.ordinante || "",
      Cliente: m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "",
      Ufficio: m.ufficio?.nome || "",
      Importo: Number(m.importo) || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Storico");
    XLSX.writeFile(wb, `storico-movimenti-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label>Dal</Label><Input type="date" value={dal} onChange={(e) => setDal(e.target.value)} className="w-40" /></div>
          <div><Label>Al</Label><Input type="date" value={al} onChange={(e) => setAl(e.target.value)} className="w-40" /></div>
          <div><Label>Cliente</Label><Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Cerca…" className="w-56" /></div>
          <Button variant="outline" size="sm" onClick={exportXlsx}><Download className="w-3 h-3 mr-1" />Export Excel</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Ordinante</TableHead><TableHead>Cliente</TableHead>
            <TableHead>Ufficio</TableHead><TableHead className="text-right">Importo</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {movs.map((m: any, i: number) => (
              <TableRow key={m.id} className={i % 2 ? "bg-muted/30" : ""}>
                <TableCell>{m.data_movimento}</TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">{m.ordinante || "—"}</TableCell>
                <TableCell className="text-sm">{m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell className="text-sm">{m.ufficio?.nome ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtEuro(m.importo)}</TableCell>
              </TableRow>
            ))}
            {movs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nessun movimento</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default Page;
