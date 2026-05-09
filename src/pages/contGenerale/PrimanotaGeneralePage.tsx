import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Search, CalendarPlus } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import ServerPagination from "@/components/ServerPagination";
import { format, addDays } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PAGE_SIZE = 25;

const getDefaultForm = () => ({
  numero_pn: "", data_pn: new Date().toISOString().slice(0, 10), numero_protocollo: "", data_protocollo: "",
  numero_documento: "", data_documento: "", fornitore_id: "", causale_id: "", tipo: "EE",
  descrizione: "", totale: 0, imponibile: 0, aliquota_ritenuta: 20, ritenuta: 0, non_soggetto: 0, altri_importi: 0,
});

const PrimanotaGeneralePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>(getDefaultForm());

  // Scadenza fields
  const [generaScadenza, setGeneraScadenza] = useState(true);
  const [giorniScadenza, setGiorniScadenza] = useState(30);
  const [dataScadenza, setDataScadenza] = useState(addDays(new Date(), 30).toISOString().slice(0, 10));

  // Mini-dialog for creating scadenza from existing row
  const [scadenzaDialogRow, setScadenzaDialogRow] = useState<any>(null);
  const [scadenzaGiorni, setScadenzaGiorni] = useState(30);
  const [scadenzaData, setScadenzaData] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["primanota_generale", page, search],
    queryFn: async () => {
      let q = supabase.from("primanota_generale").select("*, fornitori(nome), causali_contabili(descrizione)", { count: "exact" });
      if (search) q = q.or(`numero_pn.ilike.%${search}%,descrizione.ilike.%${search}%,numero_documento.ilike.%${search}%`);
      q = q.order("data_pn", { ascending: false }).range(range.from, range.to);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data || [], total: count || 0 };
    },
  });

  const { data: fornitori = [] } = useQuery({
    queryKey: ["fornitori_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("fornitori").select("id, nome, codice").eq("attivo", true).order("nome").limit(500);
      return data || [];
    },
  });

  const { data: causali = [] } = useQuery({
    queryKey: ["causali_primanota_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("causali_contabili").select("id, codice, descrizione").eq("tipo_tabella", "causale_primanota").eq("attivo", true);
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: pnData, error } = await supabase.from("primanota_generale").insert({
        ...form,
        fornitore_id: form.fornitore_id || null,
        causale_id: form.causale_id || null,
        data_protocollo: form.data_protocollo || null,
        data_documento: form.data_documento || null,
        created_by: user?.id,
      }).select("id, numero_pn, descrizione, totale, ritenuta, fornitore_id").single();
      if (error) throw error;

      // Auto-create scadenza
      if (generaScadenza && pnData) {
        const importoNetto = (Number(pnData.totale) || 0) - (Number(pnData.ritenuta) || 0);
        const { error: scadErr } = await supabase.from("scadenziario").insert({
          fornitore_id: pnData.fornitore_id,
          primanota_id: pnData.id,
          importo: importoNetto,
          data_scadenza: dataScadenza,
          descrizione: `PN ${pnData.numero_pn || "—"} — ${pnData.descrizione || ""}`.trim(),
          stato: "aperta",
        });
        if (scadErr) console.error("Errore creazione scadenza:", scadErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["primanota_generale"] });
      queryClient.invalidateQueries({ queryKey: ["scadenziario"] });
      setDialogOpen(false);
      setForm(getDefaultForm());
      setGeneraScadenza(true);
      setGiorniScadenza(30);
      setDataScadenza(addDays(new Date(), 30).toISOString().slice(0, 10));
      toast.success("Registrazione creata" + (generaScadenza ? " con scadenza" : ""));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createScadenzaMutation = useMutation({
    mutationFn: async (row: any) => {
      const importoNetto = (Number(row.totale) || 0) - (Number(row.ritenuta) || 0);
      const { error } = await supabase.from("scadenziario").insert({
        fornitore_id: row.fornitore_id,
        primanota_id: row.id,
        importo: importoNetto,
        data_scadenza: scadenzaData,
        descrizione: `PN ${row.numero_pn || "—"} — ${row.descrizione || ""}`.trim(),
        stato: "aperta",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scadenziario"] });
      setScadenzaDialogRow(null);
      toast.success("Scadenza creata");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleGiorniChange = (days: number) => {
    setGiorniScadenza(days);
    const baseDate = form.data_pn ? new Date(form.data_pn) : new Date();
    setDataScadenza(addDays(baseDate, days).toISOString().slice(0, 10));
  };

  const openScadenzaDialog = (row: any) => {
    setScadenzaDialogRow(row);
    setScadenzaGiorni(30);
    const baseDate = row.data_pn ? new Date(row.data_pn) : new Date();
    setScadenzaData(addDays(baseDate, 30).toISOString().slice(0, 10));
  };

  const rows = data?.rows || [];
  const totalCount = data?.total || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageBreadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Primanota Generale</h1>
            <p className="text-sm text-muted-foreground">Registrazioni contabilità generale con fornitori e causali</p>
          </div>
        </div>
        <Button onClick={() => { setForm(getDefaultForm()); setGeneraScadenza(true); handleGiorniChange(30); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Nuova Registrazione</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cerca per N° PN, descrizione, documento..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
            </div>
            <Badge variant="outline">{totalCount} registrazioni</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° PN</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead>Causale</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Totale</TableHead>
                <TableHead className="text-right">Ritenuta</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nessuna registrazione trovata</TableCell></TableRow>
              ) : rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.numero_pn || "—"}</TableCell>
                  <TableCell>{r.data_pn ? format(new Date(r.data_pn), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>{r.fornitori?.nome || "—"}</TableCell>
                  <TableCell>{r.causali_contabili?.descrizione || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.tipo}</Badge></TableCell>
                  <TableCell className="text-right font-mono">€ {Number(r.totale).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-mono">€ {Number(r.ritenuta).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <Badge variant={r.stato === "verificata" ? "default" : r.stato === "registrata" ? "secondary" : "outline"}>
                      {r.stato}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openScadenzaDialog(r)}>
                          <CalendarPlus className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Crea scadenza</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* Dialog nuova registrazione */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuova Registrazione Primanota</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>N° Primanota</Label><Input value={form.numero_pn} onChange={e => setForm((f: any) => ({ ...f, numero_pn: e.target.value }))} /></div>
            <div><Label>Data PN</Label><Input type="date" value={form.data_pn} onChange={e => { setForm((f: any) => ({ ...f, data_pn: e.target.value })); if (generaScadenza) { setDataScadenza(addDays(new Date(e.target.value), giorniScadenza).toISOString().slice(0, 10)); } }} /></div>
            <div><Label>N° Protocollo</Label><Input value={form.numero_protocollo} onChange={e => setForm((f: any) => ({ ...f, numero_protocollo: e.target.value }))} /></div>
            <div><Label>Data Protocollo</Label><Input type="date" value={form.data_protocollo} onChange={e => setForm((f: any) => ({ ...f, data_protocollo: e.target.value }))} /></div>
            <div><Label>N° Documento</Label><Input value={form.numero_documento} onChange={e => setForm((f: any) => ({ ...f, numero_documento: e.target.value }))} /></div>
            <div><Label>Data Documento</Label><Input type="date" value={form.data_documento} onChange={e => setForm((f: any) => ({ ...f, data_documento: e.target.value }))} /></div>
            <div>
              <Label>Fornitore</Label>
              <Select value={form.fornitore_id} onValueChange={v => setForm((f: any) => ({ ...f, fornitore_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>{fornitori.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.codice} — {f.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Causale</Label>
              <Select value={form.causale_id} onValueChange={v => setForm((f: any) => ({ ...f, causale_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>{causali.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.codice} — {c.descrizione}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipo</Label><Input value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))} /></div>
            <div><Label>Descrizione</Label><Input value={form.descrizione} onChange={e => setForm((f: any) => ({ ...f, descrizione: e.target.value }))} /></div>
            <div><Label>Totale (€)</Label><Input type="number" value={form.totale} onChange={e => setForm((f: any) => ({ ...f, totale: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label>Imponibile (€)</Label><Input type="number" value={form.imponibile} onChange={e => setForm((f: any) => ({ ...f, imponibile: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label>Aliquota Rit. (%)</Label><Input type="number" value={form.aliquota_ritenuta} onChange={e => setForm((f: any) => ({ ...f, aliquota_ritenuta: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label>Ritenuta (€)</Label><Input type="number" value={form.ritenuta} onChange={e => setForm((f: any) => ({ ...f, ritenuta: parseFloat(e.target.value) || 0 }))} /></div>
          </div>

          {/* Sezione scadenza */}
          <div className="border rounded-lg p-4 mt-2 space-y-3 bg-muted/30">
            <div className="flex items-center gap-3">
              <Checkbox id="genera-scadenza" checked={generaScadenza} onCheckedChange={(v) => setGeneraScadenza(!!v)} />
              <Label htmlFor="genera-scadenza" className="font-medium cursor-pointer">Genera scadenza automatica</Label>
            </div>
            {generaScadenza && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Giorni scadenza</Label>
                  <Select value={String(giorniScadenza)} onValueChange={v => handleGiorniChange(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 giorni</SelectItem>
                      <SelectItem value="60">60 giorni</SelectItem>
                      <SelectItem value="90">90 giorni</SelectItem>
                      <SelectItem value="120">120 giorni</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data scadenza</Label>
                  <Input type="date" value={dataScadenza} onChange={e => setDataScadenza(e.target.value)} />
                </div>
                <div className="col-span-2 text-sm text-muted-foreground">
                  Importo scadenza: <span className="font-mono font-medium">€ {((form.totale || 0) - (form.ritenuta || 0)).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span> (totale − ritenuta)
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mini-dialog crea scadenza da riga esistente */}
      <Dialog open={!!scadenzaDialogRow} onOpenChange={(open) => { if (!open) setScadenzaDialogRow(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Crea Scadenza da Primanota</DialogTitle></DialogHeader>
          {scadenzaDialogRow && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">N° PN:</span> <span className="font-mono">{scadenzaDialogRow.numero_pn || "—"}</span></p>
                <p><span className="text-muted-foreground">Fornitore:</span> {scadenzaDialogRow.fornitori?.nome || "—"}</p>
                <p><span className="text-muted-foreground">Importo netto:</span> <span className="font-mono">€ {((Number(scadenzaDialogRow.totale) || 0) - (Number(scadenzaDialogRow.ritenuta) || 0)).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span></p>
              </div>
              <div>
                <Label>Giorni scadenza</Label>
                <Select value={String(scadenzaGiorni)} onValueChange={v => { setScadenzaGiorni(Number(v)); const base = scadenzaDialogRow.data_pn ? new Date(scadenzaDialogRow.data_pn) : new Date(); setScadenzaData(addDays(base, Number(v)).toISOString().slice(0, 10)); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 giorni</SelectItem>
                    <SelectItem value="60">60 giorni</SelectItem>
                    <SelectItem value="90">90 giorni</SelectItem>
                    <SelectItem value="120">120 giorni</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data scadenza</Label>
                <Input type="date" value={scadenzaData} onChange={e => setScadenzaData(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScadenzaDialogRow(null)}>Annulla</Button>
            <Button onClick={() => createScadenzaMutation.mutate(scadenzaDialogRow)} disabled={createScadenzaMutation.isPending}>
              <CalendarPlus className="w-4 h-4 mr-2" />Crea Scadenza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrimanotaGeneralePage;
