import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RoleGuard from "@/components/RoleGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Sparkles, Check, X, RefreshCw, FileSpreadsheet, Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { fmtEuro } from "@/lib/formatCurrency";
import { notificaSedeMovimentoBancario } from "@/lib/notificheMovimentiBancari";

const STATO_LABEL: Record<string, { label: string; variant: "secondary" | "default" | "outline" | "destructive" }> = {
  importato: { label: "Importato", variant: "secondary" },
  matchato: { label: "Matchato", variant: "default" },
  assegnato: { label: "Assegnato", variant: "default" },
  ricongiunti: { label: "Ricongiunti", variant: "outline" },
  incassato: { label: "Incassato", variant: "outline" },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const parseImporto = (raw: any): number => {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  let s = String(raw).replace(/[€$\s]/g, "").trim();
  if (/^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const parseDataExcel = (raw: any): string => {
  if (!raw) return todayISO();
  if (typeof raw === "number") {
    const d = XLSX.SSF?.parse_date_code?.(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(raw).trim();
  const m1 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m1) {
    const y = m1[3].length === 2 ? `20${m1[3]}` : m1[3];
    return `${y}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return m2[0];
  return todayISO();
};

const extractOrdinante = (descrizione: string): string => {
  if (!descrizione) return "";
  // Pattern comuni: "ORDINANTE: NOME", "DA NOME", "BONIFICO ... NOME"
  const m = descrizione.match(/ORDINANTE[:\s]+([^/\n]+?)(?:\s{2,}|$|CRO|TRN|IBAN)/i);
  if (m) return m[1].trim();
  const m2 = descrizione.match(/DA\s+([A-Z][A-Z\s&\.]+?)(?:\s{2,}|$|CRO|TRN|IBAN)/);
  if (m2) return m2[1].trim();
  // Fallback: prime parole significative
  return descrizione.split(/\s{2,}|;|\|/)[0].slice(0, 80).trim();
};

// Fuzzy match semplice tra ordinante e nominativo cliente
const matchScore = (ordinante: string, cliente: { ragione_sociale?: string | null; nome?: string | null; cognome?: string | null }): number => {
  const a = ordinante.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  if (!a) return 0;
  const candidates = [
    cliente.ragione_sociale,
    [cliente.nome, cliente.cognome].filter(Boolean).join(" "),
    [cliente.cognome, cliente.nome].filter(Boolean).join(" "),
  ].filter(Boolean).map((s) => s!.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim());

  let best = 0;
  for (const c of candidates) {
    if (!c) continue;
    if (a === c) { best = Math.max(best, 100); continue; }
    if (a.includes(c) || c.includes(a)) { best = Math.max(best, 90); continue; }
    const wa = a.split(/\s+/).filter((w) => w.length > 2);
    const wc = c.split(/\s+/).filter((w) => w.length > 2);
    if (wa.length === 0 || wc.length === 0) continue;
    const matched = wa.filter((w) => wc.some((w2) => w2.includes(w) || w.includes(w2))).length;
    best = Math.max(best, (matched / Math.max(wa.length, wc.length)) * 100);
  }
  return Math.round(best);
};

const Page = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState("importazione");

  // === Importazione: file upload ===
  const [importing, setImporting] = useState(false);
  const [matching, setMatching] = useState(false);
  const [lastBatch, setLastBatch] = useState<string[]>([]);


  const handleFile = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
      if (rows.length === 0) {
        toast.error("Nessuna riga trovata nel file");
        return;
      }
      const cols = Object.keys(rows[0]);
      const colData = cols.find((c) => /data/i.test(c)) || cols[0];
      const colImp = cols.find((c) => /importo|amount|dare|avere/i.test(c)) || cols[1];
      const colDesc = cols.find((c) => /descri|causale|riferimento|note/i.test(c)) || cols[2];
      const colOrd = cols.find((c) => /ordinant/i.test(c));

      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp.user?.id ?? null;

      const records = rows
        .map((r) => {
          const importo = parseImporto(r[colImp]);
          if (!importo) return null;
          const descrizione = String(r[colDesc] ?? "").trim();
          const ordinante = colOrd ? String(r[colOrd] ?? "").trim() : extractOrdinante(descrizione);
          return {
            data_movimento: parseDataExcel(r[colData]),
            importo,
            ordinante: ordinante || null,
            descrizione: descrizione || null,
            stato: "importato" as const,
            caricato_da: userId,
          };
        })
        .filter(Boolean);

      if (records.length === 0) {
        toast.error("Nessuna riga valida importata");
        return;
      }

      const { data, error } = await supabase
        .from("movimenti_bancari" as any)
        .insert(records as any)
        .select("id");
      if (error) throw error;
      setLastBatch((data as any[]).map((r) => r.id));
      toast.success(`${records.length} movimenti importati`);
      qc.invalidateQueries({ queryKey: ["mov-bancari"] });
    } catch (e: any) {
      toast.error(`Errore import: ${e.message ?? e}`);
    } finally {
      setImporting(false);
    }
  }, [qc]);

  const handleManualInsert = async (payload: {
    cliente_id: string;
    ufficio_id: string | null;
    data_movimento: string;
    importo: number;
    ordinante: string | null;
    descrizione: string | null;
    note: string | null;
  }) => {
    const { data: userResp } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("movimenti_bancari" as any).insert({
      data_movimento: payload.data_movimento,
      importo: payload.importo,
      ordinante: payload.ordinante,
      descrizione: payload.descrizione,
      note: payload.note,
      cliente_id: payload.cliente_id,
      ufficio_id: payload.ufficio_id,
      stato: "matchato",
      caricato_da: userResp.user?.id ?? null,
    } as any).select("id").single();
    if (error) { toast.error(error.message); throw error; }
    setLastBatch([(data as any).id]);
    toast.success("Movimento creato e assegnato al cliente");
    qc.invalidateQueries({ queryKey: ["mov-bancari"] });
  };


  // === AI Matching via edge function ===
  const runMatching = async () => {
    setMatching(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-match-movimenti-bancari", {
        body: { use_ai: true, fuzzy_threshold: 70 },
      });
      if (error) throw error;
      const r = data as { processed: number; matched: number; ai_used: number };
      toast.success(`${r.matched}/${r.processed} matchati (AI usata su ${r.ai_used})`);
      qc.invalidateQueries({ queryKey: ["mov-bancari"] });
    } catch (e: any) {
      toast.error(`Errore matching: ${e.message ?? e}`);
    } finally {
      setMatching(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["admin", "cfo"]} permissionKey="contabilita">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Caricamento Movimenti Bancari</h1>
          <p className="text-sm text-muted-foreground">Importa estratti conto, esegui il matching AI e approva le assegnazioni.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="importazione">Importazione</TabsTrigger>
              <TabsTrigger value="revisione">Revisione</TabsTrigger>
              <TabsTrigger value="monitor">Monitor Real-time</TabsTrigger>
            </TabsList>
            <Button onClick={() => setManualOpen(true)} size="sm" className="gap-1">
              <Plus className="w-4 h-4" /> Inserimento manuale
            </Button>
          </div>

          <TabsContent value="importazione" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Excel</CardTitle></CardHeader>
              <CardContent>
                <DropZone disabled={importing} onFile={handleFile} />
                <p className="text-xs text-muted-foreground mt-2">Colonne riconosciute: data, importo, descrizione, ordinante (opz).</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Ultimo batch importato</CardTitle>
                <Button onClick={runMatching} disabled={matching}>
                  <Sparkles className="w-4 h-4 mr-1" /> {matching ? "Matching in corso…" : "Avvia AI Matching"}
                </Button>
              </CardHeader>
              <CardContent>
                <BatchPreview ids={lastBatch} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revisione">
            <RevisioneTab />
          </TabsContent>

          <TabsContent value="monitor">
            <MonitorTab />
          </TabsContent>

        </Tabs>

        <InserimentoManualeDialog
          open={manualOpen}
          onOpenChange={setManualOpen}
          onSubmit={async (p) => { await handleManualInsert(p); setManualOpen(false); }}
        />
      </div>
    </RoleGuard>
  );
};

// === Drop zone ===
const DropZone = ({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) => {
  const [drag, setDrag] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition ${drag ? "border-primary bg-primary/5" : "border-muted-foreground/25"} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <FileSpreadsheet className="w-8 h-8 text-muted-foreground mb-2" />
      <span className="text-sm">{disabled ? "Importazione in corso…" : "Trascina un file Excel o clicca per selezionare"}</span>
      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </label>
  );
};

// === Batch preview ===
const BatchPreview = ({ ids }: { ids: string[] }) => {
  const { data = [] } = useQuery({
    queryKey: ["mov-bancari-batch", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("movimenti_bancari" as any).select("id, data_movimento, importo, ordinante, descrizione, stato, cliente_id").in("id", ids);
      return data as any[];
    },
  });
  if (ids.length === 0) return <p className="text-sm text-muted-foreground">Nessun batch importato in questa sessione.</p>;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Ordinante</TableHead><TableHead className="text-right">Importo</TableHead><TableHead>Stato</TableHead></TableRow></TableHeader>
      <TableBody>
        {data.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.data_movimento}</TableCell>
            <TableCell className="max-w-xs truncate">{r.ordinante || <span className="text-muted-foreground italic">—</span>}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtEuro(r.importo)}</TableCell>
            <TableCell><Badge variant={STATO_LABEL[r.stato]?.variant ?? "secondary"}>{STATO_LABEL[r.stato]?.label ?? r.stato}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

// === Revisione tab ===
const RevisioneTab = () => {
  const qc = useQueryClient();
  const [filtroStato, setFiltroStato] = useState<string>("");
  const [filtroUfficio, setFiltroUfficio] = useState<string>("");
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-all"],
    queryFn: async () => (await supabase.from("uffici").select("id, nome:nome_ufficio").order("nome_ufficio")).data ?? [],
  });

  const { data: movs = [], isLoading } = useQuery({
    queryKey: ["mov-bancari", "revisione", filtroStato, filtroUfficio, dal, al],
    queryFn: async () => {
      let q = supabase.from("movimenti_bancari" as any)
        .select("id, data_movimento, importo, ordinante, descrizione, stato, ufficio_id, cliente_id, cliente:clienti(id, ragione_sociale, nome, cognome), ufficio:uffici(nome:nome_ufficio)")
        .order("data_movimento", { ascending: false })
        .limit(200);
      if (filtroStato) q = q.eq("stato", filtroStato);
      if (filtroUfficio) q = q.eq("ufficio_id", filtroUfficio);
      if (dal) q = q.gte("data_movimento", dal);
      if (al) q = q.lte("data_movimento", al);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const [clientiQuery, setClientiQuery] = useState("");
  const { data: clientiOpts = [] } = useQuery({
    queryKey: ["clienti-search", clientiQuery],
    enabled: clientiQuery.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from("clienti")
        .select("id, ragione_sociale, nome, cognome, ufficio_id" as any)
        .or(`ragione_sociale.ilike.%${clientiQuery}%,cognome.ilike.%${clientiQuery}%,nome.ilike.%${clientiQuery}%`)
        .limit(20);
      return (data as any[]) ?? [];
    },
  });

  const approva = async (m: any) => {
    const { error } = await supabase.from("movimenti_bancari" as any).update({ stato: "assegnato" } as any).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    const cliNome = m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "—";
    await notificaSedeMovimentoBancario({
      evento: "approvato",
      movimentoId: m.id,
      ufficioId: m.ufficio_id,
      importo: Number(m.importo) || 0,
      clienteLabel: cliNome,
      statoNuovo: "assegnato",
    });
    toast.success("Movimento assegnato alla sede");
    qc.invalidateQueries({ queryKey: ["mov-bancari"] });
  };


  const rifiuta = async (m: any) => {
    const { error } = await supabase.from("movimenti_bancari" as any).update({ stato: "importato", cliente_id: null, ufficio_id: null } as any).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Match rifiutato");
    qc.invalidateQueries({ queryKey: ["mov-bancari"] });
  };

  const assegnaManuale = async (m: any, clienteId: string) => {
    const cli = (clientiOpts as any[]).find((c) => c.id === clienteId);
    const { error } = await supabase.from("movimenti_bancari" as any).update({
      cliente_id: clienteId,
      ufficio_id: cli?.ufficio_id ?? null,
      stato: "matchato",
    } as any).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente assegnato");
    qc.invalidateQueries({ queryKey: ["mov-bancari"] });
  };

  const resetFiltri = () => { setFiltroStato(""); setFiltroUfficio(""); setDal(""); setAl(""); };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label>Stato</Label>
            <select value={filtroStato} onChange={(e) => setFiltroStato(e.target.value)} className="h-9 px-2 border rounded-md text-sm bg-background">
              <option value="">Tutti</option>
              {Object.entries(STATO_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div><Label>Ufficio</Label>
            <select value={filtroUfficio} onChange={(e) => setFiltroUfficio(e.target.value)} className="h-9 px-2 border rounded-md text-sm bg-background">
              <option value="">Tutti</option>
              {(uffici as any[]).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <div><Label>Dal</Label><Input type="date" value={dal} onChange={(e) => setDal(e.target.value)} className="w-40" /></div>
          <div><Label>Al</Label><Input type="date" value={al} onChange={(e) => setAl(e.target.value)} className="w-40" /></div>
          <Button variant="outline" size="sm" onClick={resetFiltri}><RefreshCw className="w-3 h-3 mr-1" />Reset</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm">Caricamento…</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Ordinante</TableHead><TableHead className="text-right">Importo</TableHead>
              <TableHead>Cliente</TableHead><TableHead>Ufficio</TableHead><TableHead>Stato</TableHead><TableHead>Azioni</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {movs.map((m: any, i: number) => {
                const cliNome = m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "—";
                return (
                  <TableRow key={m.id} className={i % 2 ? "bg-muted/30" : ""}>
                    <TableCell>{m.data_movimento}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={m.ordinante}>{m.ordinante || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtEuro(m.importo)}</TableCell>
                    <TableCell className="text-sm">{cliNome}</TableCell>
                    <TableCell className="text-sm">{m.ufficio?.nome ?? "—"}</TableCell>
                    <TableCell><Badge variant={STATO_LABEL[m.stato]?.variant ?? "secondary"}>{STATO_LABEL[m.stato]?.label ?? m.stato}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap items-center">
                        {m.stato === "matchato" && (
                          <>
                            <Button size="sm" variant="default" onClick={() => approva(m)}><Check className="w-3 h-3 mr-1" />Approva</Button>
                            <Button size="sm" variant="outline" onClick={() => rifiuta(m)}><X className="w-3 h-3 mr-1" />Rifiuta</Button>
                          </>
                        )}
                        {(m.stato === "importato" || m.stato === "matchato") && (
                          <div className="w-56">
                            <SearchableSelect
                              options={(clientiOpts as any[]).map((c) => ({
                                value: c.id,
                                label: c.ragione_sociale || [c.nome, c.cognome].filter(Boolean).join(" "),
                              }))}
                              value=""
                              onValueChange={(v) => v && assegnaManuale(m, v)}
                              onSearchChange={setClientiQuery}
                              placeholder="Cerca cliente…"
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {movs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nessun movimento</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

// === Monitor tab ===
type ManualInsertPayload = {
  cliente_id: string;
  ufficio_id: string | null;
  data_movimento: string;
  importo: number;
  ordinante: string | null;
  descrizione: string | null;
  note: string | null;
};
const MonitorTab = ({ onManualInsert }: { onManualInsert: (p: ManualInsertPayload) => Promise<void> }) => {

  const qc = useQueryClient();
  const [filtroUfficio, setFiltroUfficio] = useState("");
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-all"],
    queryFn: async () => (await supabase.from("uffici").select("id, nome:nome_ufficio").order("nome_ufficio")).data ?? [],
  });

  const { data: movs = [] } = useQuery({
    queryKey: ["mov-bancari", "monitor", filtroUfficio, dal, al],
    queryFn: async () => {
      let q = supabase.from("movimenti_bancari" as any)
        .select("id, data_movimento, importo, ordinante, stato, ufficio_id, cliente_id, cliente:clienti(ragione_sociale, nome, cognome), ufficio:uffici(nome:nome_ufficio), movimenti_clienti(id, importo_assegnato, anticipo, ammanco, movimenti_polizze(id, importo, tipo, messo_a_cassa))")
        .order("data_movimento", { ascending: false })
        .limit(500);
      if (filtroUfficio) q = q.eq("ufficio_id", filtroUfficio);
      if (dal) q = q.gte("data_movimento", dal);
      if (al) q = q.lte("data_movimento", al);
      const { data } = await q;
      return (data as any[]) ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("monitor-mov-bancari")
      .on("postgres_changes", { event: "*", schema: "public", table: "movimenti_bancari" }, () => qc.invalidateQueries({ queryKey: ["mov-bancari"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "movimenti_polizze" }, () => qc.invalidateQueries({ queryKey: ["mov-bancari"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const kpi = useMemo(() => {
    const by = { importato: 0, matchato: 0, assegnato: 0, ricongiunti: 0, incassato: 0 };
    let totEur = 0, totIncassato = 0;
    for (const m of movs) {
      by[m.stato as keyof typeof by] = (by[m.stato as keyof typeof by] ?? 0) + 1;
      totEur += Number(m.importo) || 0;
      if (m.stato === "incassato") totIncassato += Number(m.importo) || 0;
    }
    return { ...by, totEur, totIncassato };
  }, [movs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Kpi label="Importati" value={kpi.importato} />
        <Kpi label="Matchati" value={kpi.matchato} />
        <Kpi label="Assegnati" value={kpi.assegnato} />
        <Kpi label="Ricongiunti" value={kpi.ricongiunti} />
        <Kpi label="Incassati" value={`${kpi.incassato} · ${fmtEuro(kpi.totIncassato)}`} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end gap-2">
              <div><Label>Ufficio</Label>
                <select value={filtroUfficio} onChange={(e) => setFiltroUfficio(e.target.value)} className="h-9 px-2 border rounded-md text-sm bg-background">
                  <option value="">Tutti</option>
                  {(uffici as any[]).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <div><Label>Dal</Label><Input type="date" value={dal} onChange={(e) => setDal(e.target.value)} className="w-40" /></div>
              <div><Label>Al</Label><Input type="date" value={al} onChange={(e) => setAl(e.target.value)} className="w-40" /></div>
              <Button variant="outline" size="sm" onClick={() => {
                const rows = (movs as any[]).map((m: any) => {
                  const cliNome = m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "";
                  const polizze = (m.movimenti_clienti ?? []).flatMap((mc: any) => mc.movimenti_polizze ?? []);
                  const aCassa = polizze.filter((p: any) => p.messo_a_cassa).reduce((s: number, p: any) => s + Number(p.importo || 0), 0);
                  return {
                    Data: m.data_movimento,
                    Cliente: cliNome,
                    Ufficio: m.ufficio?.nome || "",
                    Totale: Number(m.importo) || 0,
                    "A cassa": aCassa,
                    Polizze: polizze.length,
                    Stato: STATO_LABEL[m.stato]?.label ?? m.stato,
                  };
                });
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Monitor");
                XLSX.writeFile(wb, `monitor-movimenti-${new Date().toISOString().slice(0, 10)}.xlsx`);
              }}><Download className="w-3 h-3 mr-1" />Export Excel</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Ufficio</TableHead>
                <TableHead className="text-right">Totale</TableHead><TableHead className="text-right">A cassa</TableHead>
                <TableHead>Polizze</TableHead><TableHead>Stato</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movs.map((m: any, i: number) => {
                  const cliNome = m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "—";
                  const polizze = (m.movimenti_clienti ?? []).flatMap((mc: any) => mc.movimenti_polizze ?? []);
                  const aCassa = polizze.filter((p: any) => p.messo_a_cassa).reduce((s: number, p: any) => s + Number(p.importo || 0), 0);
                  return (
                    <TableRow key={m.id} className={i % 2 ? "bg-muted/30" : ""}>
                      <TableCell>{m.data_movimento}</TableCell>
                      <TableCell className="text-sm">{cliNome}</TableCell>
                      <TableCell className="text-sm">{m.ufficio?.nome ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtEuro(m.importo)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtEuro(aCassa)}</TableCell>
                      <TableCell className="text-sm">{polizze.length || "—"}</TableCell>
                      <TableCell><Badge variant={STATO_LABEL[m.stato]?.variant ?? "secondary"}>{STATO_LABEL[m.stato]?.label ?? m.stato}</Badge></TableCell>
                    </TableRow>
                  );
                })}
                {movs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nessun movimento</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <InserimentoManualeCard onSubmit={onManualInsert} />
      </div>
    </div>
  );
};

// === Inserimento manuale (card compatta accanto al Monitor) ===
const InserimentoManualeCard = ({ onSubmit }: { onSubmit: (p: ManualInsertPayload) => Promise<void> }) => {
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteLabel, setClienteLabel] = useState<string>("");
  const [ufficioId, setUfficioId] = useState<string | null>(null);
  const [dataMov, setDataMov] = useState(todayISO());
  const [importo, setImporto] = useState("");
  const [ordinante, setOrdinante] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: clienti = [], isLoading: loadingClienti } = useQuery({
    queryKey: ["clienti-search-mov-manual", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from("clienti")
        .select("id, ragione_sociale, nome, cognome, ufficio_id")
        .or(`ragione_sociale.ilike.%${debounced}%,cognome.ilike.%${debounced}%,nome.ilike.%${debounced}%`)
        .limit(25);
      return (data as any[]) ?? [];
    },
  });

  const importoNum = parseImporto(importo);
  const [touched, setTouched] = useState<{ cliente?: boolean; data?: boolean; importo?: boolean }>({});

  const errors = {
    cliente: !clienteId ? "Seleziona un cliente dall'elenco" : (!ufficioId ? "Il cliente selezionato non ha una sede associata: assegna una sede al cliente prima di procedere" : ""),
    data: !dataMov ? "Inserisci la data del movimento" : "",
    importo: !importo ? "Inserisci l'importo" : (importoNum <= 0 ? "L'importo deve essere maggiore di zero" : ""),
  };
  const hasErrors = !!(errors.cliente || errors.data || errors.importo);
  const canSubmit = !hasErrors && !saving;

  const handleSubmit = async () => {
    setTouched({ cliente: true, data: true, importo: true });
    if (hasErrors) {
      toast.error(errors.cliente || errors.data || errors.importo);
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        cliente_id: clienteId,
        ufficio_id: ufficioId,
        data_movimento: dataMov,
        importo: importoNum,
        ordinante: ordinante || clienteLabel || null,
        descrizione: descrizione || null,
        note: note || null,
      });
      setClienteId(""); setClienteLabel(""); setUfficioId(null);
      setDataMov(todayISO()); setImporto(""); setOrdinante(""); setDescrizione(""); setNote("");
      setSearch(""); setTouched({});
    } catch { /* toast handled in caller */ }
    finally { setSaving(false); }
  };

  const errClass = (v: string | undefined) => v ? "border-destructive focus-visible:ring-destructive" : "";

  return (
    <Card className="h-fit">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Inserimento manuale</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Cliente *</Label>
          <SearchableSelect
            options={(clienti as any[]).map((c) => ({
              value: c.id,
              label: c.ragione_sociale || [c.nome, c.cognome].filter(Boolean).join(" "),
              description: c.ufficio_id ? undefined : "⚠ Senza sede assegnata",
            }))}
            value={clienteId}
            onValueChange={(v) => {
              setClienteId(v);
              setTouched((t) => ({ ...t, cliente: true }));
              const c = (clienti as any[]).find((x) => x.id === v);
              if (c) {
                const lbl = c.ragione_sociale || [c.nome, c.cognome].filter(Boolean).join(" ");
                setClienteLabel(lbl);
                setUfficioId(c.ufficio_id ?? null);
                if (!ordinante) setOrdinante(lbl);
              } else {
                setUfficioId(null);
              }
            }}
            onSearchChange={setSearch}
            placeholder={loadingClienti ? "Caricamento…" : "Cerca cliente…"}
            className={touched.cliente && errors.cliente ? "border-destructive" : ""}
          />
          {touched.cliente && errors.cliente && (
            <p className="text-[11px] text-destructive mt-1">{errors.cliente}</p>
          )}
          {clienteId && ufficioId && (
            <p className="text-[11px] text-muted-foreground mt-1">Sede assegnata automaticamente dal cliente</p>
          )}
        </div>
        <div>
          <Label className="text-xs">Data *</Label>
          <Input
            type="date"
            value={dataMov}
            onChange={(e) => setDataMov(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, data: true }))}
            className={touched.data && errors.data ? errClass(errors.data) : ""}
          />
          {touched.data && errors.data && <p className="text-[11px] text-destructive mt-1">{errors.data}</p>}
        </div>
        <div>
          <Label className="text-xs">Importo € *</Label>
          <Input
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, importo: true }))}
            placeholder="0,00"
            className={touched.importo && errors.importo ? errClass(errors.importo) : ""}
          />
          {touched.importo && errors.importo && <p className="text-[11px] text-destructive mt-1">{errors.importo}</p>}
        </div>
        <div>
          <Label className="text-xs">Ordinante</Label>
          <Input value={ordinante} onChange={(e) => setOrdinante(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Descrizione</Label>
          <Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Note</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full" size="sm">
          <Plus className="w-4 h-4 mr-1" /> {saving ? "Salvataggio…" : "Aggiungi"}
        </Button>
        <p className="text-[10px] text-muted-foreground text-center">Il movimento verrà creato come <strong>Matchato</strong> e assegnato al cliente.</p>
      </CardContent>
    </Card>
  );
};


const Kpi = ({ label, value }: { label: string; value: number | string }) => (
  <Card><CardContent className="p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-lg font-bold tabular-nums">{value}</div>
  </CardContent></Card>
);

export default Page;
