import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/SearchableSelect";
import { RamoSottoramoSelect } from "@/components/polizze/RamoSottoramoSelect";
import { TrattativaDetailDialog } from "@/components/trattative/TrattativaDetailDialog";
import { STATI_TRATTATIVA_FULL, getStatoLabel, getStatoColor } from "@/components/trattative/StatoPipeline";
import { toast } from "sonner";
import { FileText, Search, Plus, Landmark, Archive } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface TrattativaForm {
  tipo_soggetto: "prospect" | "cliente";
  prospect_id: string;
  cliente_id: string;
  ramo_id: string;
  gruppo_ramo_id: string;
  compagnia_id: string;
  ufficio_id: string;
  premio_previsto: string;
  priorita: string;
  note: string;
}

const emptyForm: TrattativaForm = {
  tipo_soggetto: "prospect",
  prospect_id: "",
  cliente_id: "",
  ramo_id: "",
  gruppo_ramo_id: "",
  compagnia_id: "",
  ufficio_id: "",
  premio_previsto: "",
  priorita: "media",
  note: "",
};

const PRIORITA_ICONS: Record<string, string> = {
  urgente: "🔴",
  alta: "🟠",
  media: "🟡",
  bassa: "🟢",
};

const TrattativeList = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [filtroSearch, setFiltroSearch] = useState("");
  const [filtroUfficio, setFiltroUfficio] = useState("tutti");
  const [filtroTipo, setFiltroTipo] = useState("tutti");
  const [filtroCompagnia, setFiltroCompagnia] = useState("tutti");
  const [filtroScadenzaDa, setFiltroScadenzaDa] = useState("");
  const [filtroScadenzaA, setFiltroScadenzaA] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<TrattativaForm>({ ...emptyForm });
  const [selectedTrattativa, setSelectedTrattativa] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveMode, setArchiveMode] = useState<"selected" | "all_closed">("selected");

  const { data: trattative, isLoading } = useQuery({
    queryKey: ["trattative_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trattative")
        .select("*, prospect:prospect_id(nome, cognome, ragione_sociale, tipo_cliente, ufficio_id), cliente:cliente_id(nome, cognome, ragione_sociale, tipo_cliente), ramo:ramo_id(descrizione), compagnia_rel:compagnia_id(nome), profiles:created_by(nome, cognome), ufficio:ufficio_id(nome_ufficio), assegnato:assegnato_a(nome, cognome)")
        .or("archiviata.eq.false,archiviata.is.null")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (data || []).map((t) => t.id);
      let bandiMap: Record<string, any[]> = {};
      if (ids.length > 0) {
        const { data: links } = await supabase
          .from("bandi_trattative")
          .select("trattativa_id, bando:bando_id(id, titolo, ente, scheda_id, link)")
          .in("trattativa_id", ids);
        if (links) {
          for (const l of links) {
            if (!bandiMap[l.trattativa_id]) bandiMap[l.trattativa_id] = [];
            bandiMap[l.trattativa_id].push(l.bando);
          }
        }
      }

      return (data || []).map((t) => ({
        ...t,
        bandi_collegati: bandiMap[t.id] || [],
      }));
    },
  });

  const { data: prospects = [] } = useQuery({
    queryKey: ["prospect_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("prospect").select("id, nome, cognome").order("cognome");
      return (data || []).map((p) => ({ value: p.id, label: `${p.cognome || ""} ${p.nome || ""}`.trim() }));
    },
  });

  const { data: clienti = [] } = useQuery({
    queryKey: ["clienti_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("clienti").select("id, nome, cognome, ragione_sociale, tipo_cliente").eq("attivo", true).order("cognome");
      return (data || []).map((c) => ({
        value: c.id,
        label: c.tipo_cliente === "privato" ? `${c.cognome || ""} ${c.nome || ""}`.trim() : c.ragione_sociale || "—",
      }));
    },
  });

  const { data: rami = [] } = useQuery({
    queryKey: ["rami_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione").eq("attivo", true).order("codice");
      return (data || []).map((r) => ({ value: r.id, label: `${r.codice} - ${r.descrizione}` }));
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return (data || []).map((c) => ({ value: c.id, label: c.nome }));
    },
  });

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return (data || []).map((u) => ({ value: u.id, label: u.nome_ufficio }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        stato: "aperta",
        created_by: profile?.id || null,
        ramo_id: form.ramo_id || null,
        compagnia_id: form.compagnia_id || null,
        ufficio_id: form.ufficio_id || null,
        premio_previsto: form.premio_previsto ? parseFloat(form.premio_previsto) : null,
        priorita: form.priorita || "media",
        note: form.note || null,
        data_apertura: new Date().toISOString().split("T")[0],
      };
      if (form.tipo_soggetto === "prospect") {
        payload.prospect_id = form.prospect_id;
      } else {
        payload.cliente_id = form.cliente_id;
      }
      const { data, error } = await supabase.from("trattative").insert(payload).select().single();
      if (error) throw error;

      // Log evento nella timeline
      await supabase.from("trattativa_eventi").insert({
        trattativa_id: data.id,
        tipo_evento: "cambio_stato",
        descrizione: "Trattativa creata con stato: Aperta",
        created_by: profile?.id,
      });

      const entitaId = form.tipo_soggetto === "prospect" ? form.prospect_id : form.cliente_id;
      await logAttivita({
        azione: "creazione_trattativa",
        entita_tipo: form.tipo_soggetto,
        entita_id: entitaId,
        dettagli_json: { trattativa_id: data.id, tipo_soggetto: form.tipo_soggetto },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative_all"] });
      toast.success("Trattativa creata");
      setForm({ ...emptyForm });
      setCreateOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (mode: "selected" | "all_closed") => {
      if (mode === "selected") {
        const ids = Array.from(selectedIds);
        if (!ids.length) return;
        const { error } = await supabase.from("trattative").update({ archiviata: true }).in("id", ids);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trattative").update({ archiviata: true }).in("stato", ["chiusa_vinta", "chiusa_persa"]).or("archiviata.eq.false,archiviata.is.null");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative_all"] });
      queryClient.invalidateQueries({ queryKey: ["trattative_storico"] });
      toast.success("Trattative archiviate");
      setSelectedIds(new Set());
      setArchiveDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getSoggettoName = (t: any) => {
    if (t.cliente) {
      return t.cliente.tipo_cliente === "privato"
        ? `${t.cliente.cognome || ""} ${t.cliente.nome || ""}`.trim()
        : t.cliente.ragione_sociale || "—";
    }
    if (t.prospect) {
      if (t.prospect.tipo_cliente === "ente" || t.prospect.ragione_sociale) {
        return t.prospect.ragione_sociale || "—";
      }
      return `${t.prospect.cognome || ""} ${t.prospect.nome || ""}`.trim() || "—";
    }
    return "—";
  };

  const filtered = trattative?.filter((t) => {
    if (filtroStato !== "tutti" && t.stato !== filtroStato) return false;
    if (filtroUfficio !== "tutti" && t.ufficio_id !== filtroUfficio) return false;
    if (filtroTipo !== "tutti") {
      if (filtroTipo === "cliente" && !t.cliente_id) return false;
      if (filtroTipo === "prospect" && t.cliente_id) return false;
    }
    if (filtroCompagnia !== "tutti" && t.compagnia_id !== filtroCompagnia) return false;
    if (filtroScadenzaDa && t.data_scadenza && t.data_scadenza < filtroScadenzaDa) return false;
    if (filtroScadenzaDa && !t.data_scadenza) return false;
    if (filtroScadenzaA && t.data_scadenza && t.data_scadenza > filtroScadenzaA) return false;
    if (filtroScadenzaA && !t.data_scadenza) return false;
    if (filtroSearch) {
      const search = filtroSearch.toLowerCase();
      const soggetto = getSoggettoName(t).toLowerCase();
      const comp = (t.compagnia_rel?.nome || t.compagnia || "").toLowerCase();
      const bandoTitolo = (t.bandi_collegati?.[0]?.titolo || "").toLowerCase();
      if (!soggetto.includes(search) && !comp.includes(search) && !bandoTitolo.includes(search)) return false;
    }
    return true;
  });

  const openDetail = (t: any) => {
    setSelectedTrattativa(t);
    setDetailOpen(true);
  };

  const canCreate = form.tipo_soggetto === "prospect" ? !!form.prospect_id : !!form.cliente_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Dashboard</span><span>›</span><span>Trattative</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Trattative</h1>
            <p className="text-sm text-muted-foreground">
              {trattative?.length || 0} trattative totali • {trattative?.filter((t) => !["chiusa_vinta", "chiusa_persa"].includes(t.stato)).length || 0} attive
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button variant="outline" className="gap-1.5" onClick={() => { setArchiveMode("selected"); setArchiveDialogOpen(true); }}>
              <Archive className="w-4 h-4" />Archivia ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" className="gap-1.5" onClick={() => { setArchiveMode("all_closed"); setArchiveDialogOpen(true); }}>
            <Archive className="w-4 h-4" />Archivia chiuse
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5"><Plus className="w-4 h-4" />Nuova Trattativa</Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nuova Trattativa</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Tipo soggetto</Label>
                <RadioGroup value={form.tipo_soggetto} onValueChange={(v) => setForm({ ...form, tipo_soggetto: v as "prospect" | "cliente", prospect_id: "", cliente_id: "" })} className="flex gap-4">
                  <div className="flex items-center gap-2"><RadioGroupItem value="prospect" id="r-prospect" /><Label htmlFor="r-prospect">Prospect</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="cliente" id="r-cliente" /><Label htmlFor="r-cliente">Cliente</Label></div>
                </RadioGroup>
              </div>
              {form.tipo_soggetto === "prospect" ? (
                <div className="space-y-1.5">
                  <Label>Prospect *</Label>
                  <SearchableSelect options={prospects} value={form.prospect_id} onValueChange={(v) => setForm({ ...form, prospect_id: v })} placeholder="Cerca prospect..." />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Cliente *</Label>
                  <SearchableSelect options={clienti} value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })} placeholder="Cerca cliente..." />
                </div>
              )}
              <RamoSottoramoSelect
                gruppoRamoId={form.gruppo_ramo_id || null}
                ramoId={form.ramo_id || null}
                onChange={({ gruppoRamoId, ramoId }) =>
                  setForm({ ...form, gruppo_ramo_id: gruppoRamoId || "", ramo_id: ramoId || "" })
                }
              />
              <div className="space-y-1.5">
                <Label>Agenzia</Label>
                <SearchableSelect options={compagnie} value={form.compagnia_id} onValueChange={(v) => setForm({ ...form, compagnia_id: v })} placeholder="Agenzia..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ufficio</Label>
                  <SearchableSelect options={uffici} value={form.ufficio_id} onValueChange={(v) => setForm({ ...form, ufficio_id: v })} placeholder="Ufficio..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Priorità</Label>
                  <Select value={form.priorita} onValueChange={(v) => setForm({ ...form, priorita: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bassa">🟢 Bassa</SelectItem>
                      <SelectItem value="media">🟡 Media</SelectItem>
                      <SelectItem value="alta">🟠 Alta</SelectItem>
                      <SelectItem value="urgente">🔴 Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Premio Previsto (€)</Label>
                <Input type="number" value={form.premio_previsto} onChange={(e) => setForm({ ...form, premio_previsto: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !canCreate}>Crea Trattativa</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 w-56" placeholder="Cerca soggetto, agenzia, bando..." value={filtroSearch} onChange={(e) => setFiltroSearch(e.target.value)} />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti i tipi</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="cliente">Cliente</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStato} onValueChange={setFiltroStato}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {STATI_TRATTATIVA_FULL.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCompagnia} onValueChange={setFiltroCompagnia}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutte le agenzie</SelectItem>
            {compagnie.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroUfficio} onValueChange={setFiltroUfficio}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli uffici</SelectItem>
            {uffici.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Scadenza da</Label>
            <Input type="date" className="w-36 h-10" value={filtroScadenzaDa} onChange={(e) => setFiltroScadenzaDa(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Scadenza a</Label>
            <Input type="date" className="w-36 h-10" value={filtroScadenzaA} onChange={(e) => setFiltroScadenzaA(e.target.value)} />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Caricamento...</div>
      ) : !filtered?.length ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nessuna trattativa trovata</h3>
          <p className="text-sm text-muted-foreground">Usa il pulsante "Nuova Trattativa" per crearne una.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered?.length > 0 && filtered.every((t) => selectedIds.has(t.id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(new Set(filtered?.map((t) => t.id) || []));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="w-8"></TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Soggetto</TableHead>
                <TableHead>Agenzia</TableHead>
                <TableHead>Ufficio</TableHead>
                <TableHead>Premio</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Bando</TableHead>
                <TableHead>Scadenza</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(t)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedIds);
                        if (checked) next.add(t.id); else next.delete(t.id);
                        setSelectedIds(next);
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    {PRIORITA_ICONS[t.priorita || "media"] || "🟡"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.cliente_id ? "default" : "secondary"}>
                      {t.cliente_id ? "Cliente" : "Prospect"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{getSoggettoName(t)}</TableCell>
                  <TableCell className="text-muted-foreground">{t.compagnia_rel?.nome || t.compagnia || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.ufficio?.nome_ufficio || "—"}</TableCell>
                  <TableCell>{t.premio_previsto ? `€ ${Number(t.premio_previsto).toLocaleString("it-IT")}` : "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full text-white ${getStatoColor(t.stato)}`}>
                      {getStatoLabel(t.stato)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {t.bandi_collegati?.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {t.bandi_collegati.map((b: any) => {
                          const label = b.titolo || b.scheda_id || "—";
                          const short = label.length > 60 ? label.slice(0, 57) + "…" : label;
                          return (
                            <a key={b.id} href={b.link || "#"} target="_blank" rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <Landmark className="h-3 w-3 shrink-0" />
                              {short}
                            </a>
                          );
                        })}
                      </div>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.data_scadenza ? format(new Date(t.data_scadenza), "dd/MM/yyyy", { locale: it }) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {selectedTrattativa && (
        <TrattativaDetailDialog
          trattativa={selectedTrattativa}
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setSelectedTrattativa(null);
          }}
        />
      )}

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivia trattative</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveMode === "selected"
                ? `Stai per archiviare ${selectedIds.size} trattativa/e selezionata/e. Le trattative archiviate saranno visibili nello Storico.`
                : "Stai per archiviare tutte le trattative chiuse (vinte e perse). Saranno visibili nello Storico."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveMutation.mutate(archiveMode)}>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrattativeList;
