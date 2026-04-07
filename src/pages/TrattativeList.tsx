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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { FileText, Search, Plus } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const STATI_TRATTATIVA = [
  { value: "aperta", label: "Aperta", color: "bg-kpi-blue-bg text-kpi-blue-text border-kpi-blue-border" },
  { value: "in_negoziazione", label: "In Negoziazione", color: "bg-kpi-yellow-bg text-kpi-yellow-text border-kpi-yellow-border" },
  { value: "chiusa_vinta", label: "Chiusa Vinta", color: "bg-kpi-green-bg text-kpi-green-text border-kpi-green-border" },
  { value: "chiusa_persa", label: "Chiusa Persa", color: "bg-destructive/10 text-destructive border-destructive/30" },
];

interface TrattativaForm {
  tipo_soggetto: "prospect" | "cliente";
  prospect_id: string;
  cliente_id: string;
  ramo_id: string;
  compagnia_id: string;
  premio_previsto: string;
  note: string;
}

const emptyForm: TrattativaForm = {
  tipo_soggetto: "prospect",
  prospect_id: "",
  cliente_id: "",
  ramo_id: "",
  compagnia_id: "",
  premio_previsto: "",
  note: "",
};

const TrattativeList = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [filtroSearch, setFiltroSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<TrattativaForm>({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TrattativaForm>({ ...emptyForm });

  // Fetch trattative with joins
  const { data: trattative, isLoading } = useQuery({
    queryKey: ["trattative_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trattative")
        .select("*, prospect:prospect_id(nome, cognome, ufficio_id), cliente:cliente_id(nome, cognome, ragione_sociale, tipo_cliente), ramo:ramo_id(descrizione), compagnia_rel:compagnia_id(nome), profiles:created_by(nome, cognome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Lookup data
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

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        stato: "aperta",
        created_by: profile?.id || null,
        ramo_id: form.ramo_id || null,
        compagnia_id: form.compagnia_id || null,
        premio_previsto: form.premio_previsto ? parseFloat(form.premio_previsto) : null,
        note: form.note || null,
      };
      if (form.tipo_soggetto === "prospect") {
        payload.prospect_id = form.prospect_id;
      } else {
        payload.cliente_id = form.cliente_id;
      }
      const { data, error } = await supabase.from("trattative").insert(payload).select().single();
      if (error) throw error;

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

  // Update mutation (for edit dialog)
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const existing = trattative?.find((t) => t.id === editId);
      const changes: Record<string, unknown> = {};
      const dettagli: Record<string, unknown> = {};

      const newRamo = editForm.ramo_id || null;
      const newCompagnia = editForm.compagnia_id || null;
      const newPremio = editForm.premio_previsto ? parseFloat(editForm.premio_previsto) : null;
      const newNote = editForm.note || null;

      if (newRamo !== (existing?.ramo_id || null)) {
        changes.ramo_id = newRamo;
        dettagli.ramo_precedente = existing?.ramo_id;
        dettagli.ramo_nuovo = newRamo;
      }
      if (newCompagnia !== (existing?.compagnia_id || null)) {
        changes.compagnia_id = newCompagnia;
        dettagli.compagnia_precedente = existing?.compagnia_id;
        dettagli.compagnia_nuova = newCompagnia;
      }
      if (newPremio !== (existing?.premio_previsto ? Number(existing.premio_previsto) : null)) {
        changes.premio_previsto = newPremio;
        dettagli.premio_precedente = existing?.premio_previsto;
        dettagli.premio_nuovo = newPremio;
      }
      if (newNote !== (existing?.note || null)) {
        changes.note = newNote;
      }

      if (Object.keys(changes).length === 0) return;

      changes.updated_at = new Date().toISOString();
      const { error } = await supabase.from("trattative").update(changes).eq("id", editId);
      if (error) throw error;

      await logAttivita({
        azione: "modifica_trattativa",
        entita_tipo: "trattativa",
        entita_id: editId,
        dettagli_json: dettagli,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative_all"] });
      toast.success("Trattativa aggiornata");
      setEditOpen(false);
      setEditId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Stato change mutation
  const updateStato = useMutation({
    mutationFn: async ({ id, newStato, oldStato }: { id: string; newStato: string; oldStato: string }) => {
      const update: Record<string, unknown> = { stato: newStato, updated_at: new Date().toISOString() };
      if (newStato === "chiusa_vinta" || newStato === "chiusa_persa") {
        update.data_chiusura = new Date().toISOString();
      }
      const { error } = await supabase.from("trattative").update(update).eq("id", id);
      if (error) throw error;

      const azione = (newStato === "chiusa_vinta" || newStato === "chiusa_persa") ? "chiusura_trattativa" : "modifica_stato_trattativa";
      await logAttivita({ azione, entita_tipo: "trattativa", entita_id: id, dettagli_json: { stato_precedente: oldStato, nuovo_stato: newStato } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative_all"] });
      toast.success("Trattativa aggiornata");
    },
  });

  const getSoggettoName = (t: any) => {
    if (t.cliente) {
      return t.cliente.tipo_cliente === "privato"
        ? `${t.cliente.cognome || ""} ${t.cliente.nome || ""}`.trim()
        : t.cliente.ragione_sociale || "—";
    }
    if (t.prospect) {
      return `${t.prospect.nome || ""} ${t.prospect.cognome || ""}`.trim();
    }
    return "—";
  };

  const getSoggettoTipo = (t: any) => {
    if (t.cliente_id) return "Cliente";
    if (t.prospect_id) return "Prospect";
    return "—";
  };

  const filtered = trattative?.filter((t) => {
    if (filtroStato !== "tutti" && t.stato !== filtroStato) return false;
    if (filtroSearch) {
      const search = filtroSearch.toLowerCase();
      const soggetto = getSoggettoName(t).toLowerCase();
      const ramo = ((t as any).ramo?.descrizione || t.prodotto || "").toLowerCase();
      const comp = ((t as any).compagnia_rel?.nome || t.compagnia || "").toLowerCase();
      if (!soggetto.includes(search) && !ramo.includes(search) && !comp.includes(search)) return false;
    }
    return true;
  });

  const getStatoBadge = (stato: string) => {
    const s = STATI_TRATTATIVA.find((x) => x.value === stato);
    return s ? (
      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
    ) : <Badge variant="secondary">{stato}</Badge>;
  };

  const openEdit = (t: any) => {
    setEditId(t.id);
    setEditForm({
      tipo_soggetto: t.cliente_id ? "cliente" : "prospect",
      prospect_id: t.prospect_id || "",
      cliente_id: t.cliente_id || "",
      ramo_id: t.ramo_id || "",
      compagnia_id: t.compagnia_id || "",
      premio_previsto: t.premio_previsto ? String(t.premio_previsto) : "",
      note: t.note || "",
    });
    setEditOpen(true);
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
            <p className="text-sm text-muted-foreground">Tutte le trattative commerciali</p>
          </div>
        </div>
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
              <div className="space-y-1.5">
                <Label>Ramo</Label>
                <SearchableSelect options={rami} value={form.ramo_id} onValueChange={(v) => setForm({ ...form, ramo_id: v })} placeholder="Seleziona ramo..." />
              </div>
              <div className="space-y-1.5">
                <Label>Compagnia</Label>
                <SearchableSelect options={compagnie} value={form.compagnia_id} onValueChange={(v) => setForm({ ...form, compagnia_id: v })} placeholder="Seleziona compagnia..." />
              </div>
              <div className="space-y-1.5">
                <Label>Premio Previsto (€)</Label>
                <Input type="number" value={form.premio_previsto} onChange={(e) => setForm({ ...form, premio_previsto: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note sulla trattativa..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !canCreate}>Crea Trattativa</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 w-64" placeholder="Cerca soggetto, ramo, compagnia..." value={filtroSearch} onChange={(e) => setFiltroSearch(e.target.value)} />
        </div>
        <Select value={filtroStato} onValueChange={setFiltroStato}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {STATI_TRATTATIVA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
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
                <TableHead>Tipo</TableHead>
                <TableHead>Soggetto</TableHead>
                <TableHead>Ramo</TableHead>
                <TableHead>Compagnia</TableHead>
                <TableHead>Premio</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Azione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => openEdit(t)}>
                  <TableCell>
                    <Badge variant={t.cliente_id ? "default" : "secondary"}>{getSoggettoTipo(t)}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{getSoggettoName(t)}</TableCell>
                  <TableCell className="text-muted-foreground">{(t as any).ramo?.descrizione || t.prodotto || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{(t as any).compagnia_rel?.nome || t.compagnia || "—"}</TableCell>
                  <TableCell>{t.premio_previsto ? `€ ${Number(t.premio_previsto).toLocaleString("it-IT")}` : "—"}</TableCell>
                  <TableCell>{getStatoBadge(t.stato)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(t.created_at), "dd/MM/yyyy", { locale: it })}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select value={t.stato} onValueChange={(v) => updateStato.mutate({ id: t.id, newStato: v, oldStato: t.stato })}>
                      <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATI_TRATTATIVA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifica Trattativa</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Ramo</Label>
              <SearchableSelect options={rami} value={editForm.ramo_id} onValueChange={(v) => setEditForm({ ...editForm, ramo_id: v })} placeholder="Seleziona ramo..." />
            </div>
            <div className="space-y-1.5">
              <Label>Compagnia</Label>
              <SearchableSelect options={compagnie} value={editForm.compagnia_id} onValueChange={(v) => setEditForm({ ...editForm, compagnia_id: v })} placeholder="Seleziona compagnia..." />
            </div>
            <div className="space-y-1.5">
              <Label>Premio Previsto (€)</Label>
              <Input type="number" value={editForm.premio_previsto} onChange={(e) => setEditForm({ ...editForm, premio_previsto: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} placeholder="Note sulla trattativa..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annulla</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Salva Modifiche</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrattativeList;
