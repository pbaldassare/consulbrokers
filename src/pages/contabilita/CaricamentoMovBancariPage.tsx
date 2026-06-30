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
import { Upload, FileSpreadsheet, Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { fmtEuro } from "@/lib/formatCurrency";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";
import { resolveUfficioFromConto, normalizeExcelRow, resolveOrdinanteImport } from "@/lib/movimentiBancari";

const STATO_LABEL: Record<string, { label: string; variant: "secondary" | "default" | "outline" | "destructive" }> = {
  importato: { label: "Importato", variant: "secondary" },
  matchato: { label: "Matchato", variant: "default" },
  assegnato: { label: "Assegnato", variant: "default" },
  ricongiunti: { label: "Ricongiunti", variant: "outline" },
  incassato: { label: "Incassato", variant: "outline" },
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (raw instanceof Date) {
    return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, "0")}-${String(raw.getDate()).padStart(2, "0")}`;
  }
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

const Page = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState("importazione");
  const [importing, setImporting] = useState(false);
  const [lastReport, setLastReport] = useState<{ inseriti: number; duplicati: number; senzaCliente: number } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [contoImportId, setContoImportId] = useState<string>("");

  const handleFile = useCallback(async (file: File) => {
    if (!contoImportId) {
      toast.error("Seleziona il conto bancario prima di importare");
      return;
    }
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true }).map(normalizeExcelRow);
      if (rows.length === 0) {
        toast.error("Nessuna riga trovata nel file");
        return;
      }
      const cols = Object.keys(rows[0]);
      const colData = cols.find((c) => /data\s*contabile/i.test(c)) || cols.find((c) => /^data/i.test(c)) || cols[0];
      const colImp = cols.find((c) => /^importo/i.test(c)) || cols.find((c) => /importo|amount/i.test(c));
      const colOrd = cols.find((c) => /^ordinante/i.test(c)) || cols.find((c) => /ordinante|mittente|controparte/i.test(c));
      const colDesc = cols.find((c) => /descri/i.test(c)) || cols.find((c) => /causale/i.test(c));
      const colCliId = cols.find((c) => /cliente\s*id/i.test(c));

      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp.user?.id ?? null;
      const ufficioDaConto = await resolveUfficioFromConto(contoImportId);

      const records = rows
        .map((r) => {
          const importo = parseImporto(r[colImp as string]);
          if (!importo) return null;
          const descrizione = colDesc ? String(r[colDesc] ?? "").trim() : "";
          const ordinante = resolveOrdinanteImport(colOrd ? String(r[colOrd] ?? "") : "", descrizione);
          const rawCli = colCliId ? String(r[colCliId] ?? "").trim() : "";
          const cliente_id = UUID_RE.test(rawCli) ? rawCli : null;
          return {
            data_movimento: parseDataExcel(r[colData as string]),
            importo,
            ordinante: ordinante || null,
            descrizione: descrizione || null,
            cliente_id,
            conto_bancario_id: contoImportId,
            stato: (cliente_id ? "assegnato" : "importato") as "assegnato" | "importato",
            caricato_da: userId,
          };
        })
        .filter(Boolean) as any[];

      if (records.length === 0) {
        toast.error("Nessuna riga valida importata");
        return;
      }

      // Risolvi ufficio_id per i cliente_id presenti
      const cliIds = Array.from(new Set(records.map((r) => r.cliente_id).filter(Boolean))) as string[];
      const ufficioMap = new Map<string, string | null>();
      if (cliIds.length > 0) {
        const { data: clienti } = await supabase.from("clienti").select("id, ufficio_id").in("id", cliIds as any);
        for (const c of (clienti as any[] ?? [])) ufficioMap.set(c.id, c.ufficio_id ?? null);
      }
      for (const r of records) {
        (r as any).ufficio_id = r.cliente_id
          ? (ufficioMap.get(r.cliente_id) ?? ufficioDaConto)
          : ufficioDaConto;
      }

      // Dedup vs DB
      const keyOf = (r: any) => `${r.data_movimento}|${r.importo}|${r.ordinante ?? ""}|${r.descrizione ?? ""}`;
      const dates = Array.from(new Set(records.map((r) => r.data_movimento)));
      const { data: existing } = await supabase
        .from("movimenti_bancari" as any)
        .select("data_movimento, importo, ordinante, descrizione")
        .in("data_movimento", dates as any);
      const existingKeys = new Set((existing as any[] | null ?? []).map(keyOf));
      const toInsert = records.filter((r) => !existingKeys.has(keyOf(r)));
      const duplicati = records.length - toInsert.length;
      const senzaCliente = toInsert.filter((r) => !r.cliente_id).length;

      if (toInsert.length === 0) {
        toast.info(`Nessun nuovo movimento: ${duplicati} già presenti`);
        setLastReport({ inseriti: 0, duplicati, senzaCliente: 0 });
        return;
      }

      // Insert in chunk per evitare timeout
      const CHUNK = 200;
      let inseriti = 0;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const slice = toInsert.slice(i, i + CHUNK);
        const { error } = await supabase.from("movimenti_bancari" as any).insert(slice as any);
        if (error) throw error;
        inseriti += slice.length;
      }
      setLastReport({ inseriti, duplicati, senzaCliente });
      const parts = [`${inseriti} movimenti caricati e assegnati`];
      if (duplicati) parts.push(`${duplicati} duplicati ignorati`);
      if (senzaCliente) parts.push(`${senzaCliente} senza Cliente ID`);
      toast.success(parts.join(" · "));
      qc.invalidateQueries({ queryKey: ["mov-bancari"] });
    } catch (e: any) {
      toast.error(`Errore import: ${e.message ?? e}`);
    } finally {
      setImporting(false);
    }
  }, [qc, contoImportId]);

  const handleManualInsert = async (payload: {
    cliente_id: string;
    ufficio_id: string | null;
    conto_bancario_id: string | null;
    data_movimento: string;
    importo: number;
    ordinante: string | null;
    descrizione: string | null;
    note: string | null;
  }) => {
    const { data: userResp } = await supabase.auth.getUser();
    const { error } = await supabase.from("movimenti_bancari" as any).insert({
      data_movimento: payload.data_movimento,
      importo: payload.importo,
      ordinante: payload.ordinante,
      descrizione: payload.descrizione,
      note: payload.note,
      cliente_id: payload.cliente_id,
      ufficio_id: payload.ufficio_id,
      conto_bancario_id: payload.conto_bancario_id,
      stato: "assegnato",
      caricato_da: userResp.user?.id ?? null,
    } as any);
    if (error) { toast.error(error.message); throw error; }
    toast.success("Movimento creato e assegnato al cliente");
    qc.invalidateQueries({ queryKey: ["mov-bancari"] });
  };

  return (
    <RoleGuard allowedRoles={["admin", "cfo"]} permissionKey="contabilita">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Caricamento Movimenti Bancari</h1>
          <p className="text-sm text-muted-foreground">
            Carica l&apos;estratto Excel del conto bancario. La colonna <code>Cliente ID</code> è opzionale:
            i movimenti senza cliente restano in coda per il ricongiungimento.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="importazione">Importazione</TabsTrigger>
              <TabsTrigger value="monitor">Monitor Real-time</TabsTrigger>
            </TabsList>
            <Button onClick={() => setManualOpen(true)} size="sm" className="gap-1">
              <Plus className="w-4 h-4" /> Inserimento manuale
            </Button>
          </div>

          <TabsContent value="importazione" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Excel estratto conto</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Conto bancario *</Label>
                  <ContoBancarioSelect
                    value={contoImportId || null}
                    onChange={(id) => setContoImportId(id ?? "")}
                    tipi={["incasso_clienti", "generico"]}
                    autoSelectDefault
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Le sedi collegate a questo conto vedranno i movimenti in ricongiungimento.
                  </p>
                </div>
                <DropZone disabled={importing || !contoImportId} onFile={handleFile} />
                <p className="text-xs text-muted-foreground">
                  Colonne minime: <code>Data contabile</code>, <code>Importo</code>, <code>Descrizione</code>.
                  L&apos;<code>Ordinante</code> viene letto dalla colonna o estratto dalla descrizione (es. estratti BCC).
                  Opzionale: <code>Cliente ID</code> (UUID) per pre-assegnare il pagatore.
                </p>
                {lastReport && (
                  <div className="mt-4 rounded-md border bg-muted/30 p-3 text-sm">
                    <div className="font-medium">Ultimo caricamento</div>
                    <ul className="mt-1 text-muted-foreground space-y-0.5">
                      <li>· {lastReport.inseriti} movimenti inseriti</li>
                      <li>· {lastReport.duplicati} duplicati ignorati</li>
                      <li>· {lastReport.senzaCliente} senza Cliente ID (stato: Importato)</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
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

// === Monitor tab ===
type ManualInsertPayload = {
  cliente_id: string;
  ufficio_id: string | null;
  conto_bancario_id: string | null;
  data_movimento: string;
  importo: number;
  ordinante: string | null;
  descrizione: string | null;
  note: string | null;
};

const MonitorTab = () => {
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
    let totIncassato = 0;
    for (const m of movs) {
      by[m.stato as keyof typeof by] = (by[m.stato as keyof typeof by] ?? 0) + 1;
      if (m.stato === "incassato") totIncassato += Number(m.importo) || 0;
    }
    return { ...by, totIncassato };
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
                  Ordinante: m.ordinante || "",
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
              <TableHead>Data</TableHead><TableHead>Ordinante</TableHead><TableHead>Cliente</TableHead><TableHead>Ufficio</TableHead>
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
                    <TableCell className="text-sm max-w-[220px] truncate" title={m.ordinante || undefined}>{m.ordinante || "—"}</TableCell>
                    <TableCell className="text-sm">{cliNome}</TableCell>
                    <TableCell className="text-sm">{m.ufficio?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtEuro(m.importo)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtEuro(aCassa)}</TableCell>
                    <TableCell className="text-sm">{polizze.length || "—"}</TableCell>
                    <TableCell><Badge variant={STATO_LABEL[m.stato]?.variant ?? "secondary"}>{STATO_LABEL[m.stato]?.label ?? m.stato}</Badge></TableCell>
                  </TableRow>
                );
              })}
              {movs.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nessun movimento</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// === Inserimento manuale (dialog popup) ===
const InserimentoManualeDialog = ({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (p: ManualInsertPayload) => Promise<void> }) => {
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteLabel, setClienteLabel] = useState<string>("");
  const [ufficioId, setUfficioId] = useState<string | null>(null);
  const [dataMov, setDataMov] = useState(todayISO());
  const [importo, setImporto] = useState("");
  const [ordinante, setOrdinante] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [note, setNote] = useState("");
  const [contoId, setContoId] = useState<string>("");
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
    conto: !contoId ? "Seleziona il conto bancario" : "",
    data: !dataMov ? "Inserisci la data del movimento" : "",
    importo: !importo ? "Inserisci l'importo" : (importoNum <= 0 ? "L'importo deve essere maggiore di zero" : ""),
  };
  const hasErrors = !!(errors.cliente || errors.conto || errors.data || errors.importo);
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
        conto_bancario_id: contoId || null,
        data_movimento: dataMov,
        importo: importoNum,
        ordinante: ordinante || clienteLabel || null,
        descrizione: descrizione || null,
        note: note || null,
      });
      setClienteId(""); setClienteLabel(""); setUfficioId(null); setContoId("");
      setDataMov(todayISO()); setImporto(""); setOrdinante(""); setDescrizione(""); setNote("");
      setSearch(""); setTouched({});
    } catch { /* toast handled in caller */ }
    finally { setSaving(false); }
  };

  const errClass = (v: string | undefined) => v ? "border-destructive focus-visible:ring-destructive" : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4" /> Inserimento manuale movimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Conto bancario *</Label>
            <ContoBancarioSelect
              value={contoId || null}
              onChange={(id) => setContoId(id ?? "")}
              tipi={["incasso_clienti", "generico"]}
              autoSelectDefault
            />
          </div>
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
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" size="sm">Annulla</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1" size="sm">
              <Plus className="w-4 h-4 mr-1" /> {saving ? "Salvataggio…" : "Aggiungi"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">Il movimento verrà creato come <strong>Assegnato</strong> al cliente.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Kpi = ({ label, value }: { label: string; value: number | string }) => (
  <Card><CardContent className="p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-lg font-bold tabular-nums">{value}</div>
  </CardContent></Card>
);

export default Page;
