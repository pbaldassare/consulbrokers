import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, Pencil, UserCog, ExternalLink, CalendarIcon, UserPlus, KeyRound, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { LEVELS } from "@/lib/userLevels";

interface SpecialistRow {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  ruolo: string | null;
  ufficio_id: string | null;
  attivo: boolean | null;
  descrizione: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  telefono: string | null;
  fax: string | null;
  codice_fiscale: string | null;
  nome_rui: string | null;
  data_iscrizione_rui: string | null;
  numero_rui: string | null;
  sezione_rui: string | null;
  codice_contabile: string | null;
  percentuale_ra: number | null;
  iban: string | null;
  intestatario_cc: string | null;
  percentuale_base: number | null;
  percentuale_consulenza: number | null;
  note: string | null;
}

const emptyForm = {
  cognome: "", nome: "", email: "", telefono: "", fax: "",
  codice_fiscale: "", descrizione: "", ufficio_id: "",
  indirizzo: "", cap: "", citta: "", provincia: "",
  nome_rui: "", sezione_rui: "", numero_rui: "", data_iscrizione_rui: "",
  codice_contabile: "",
  percentuale_base: "", percentuale_consulenza: "", percentuale_ra: "",
  iban: "", intestatario_cc: "",
  note: "",
  attivo: true,
};

const DateField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const parsed = value ? parseISO(value) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {parsed ? format(parsed, "dd/MM/yyyy") : <span>gg/mm/aaaa</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
          locale={it}
          captionLayout="dropdown-buttons"
          fromYear={1980}
          toYear={new Date().getFullYear() + 1}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
};

const SELECT_FIELDS =
  "id, nome, cognome, email, ruolo, ufficio_id, attivo, descrizione, indirizzo, cap, citta, provincia, telefono, fax, codice_fiscale, nome_rui, data_iscrizione_rui, numero_rui, sezione_rui, codice_contabile, percentuale_ra, iban, intestatario_cc, percentuale_base, percentuale_consulenza, note";

interface SpecialistListProps {
  editId?: string | null;
  onEditConsumed?: () => void;
}

const SpecialistList = ({ editId, onEditConsumed }: SpecialistListProps = {}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["specialist-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(SELECT_FIELDS)
        .eq("ruolo", "backoffice")
        .order("cognome", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SpecialistRow[];
    },
  });

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici_select_specialist"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici" as any)
        .select("id, codice_ufficio, nome_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      return (data || []) as unknown as { id: string; codice_ufficio: string; nome_ufficio: string }[];
    },
  });

  const ufficioMap = Object.fromEntries(uffici.map(u => [u.id, `${u.codice_ufficio} — ${u.nome_ufficio}`]));

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("Nessuno Specialist selezionato");
      if (!form.ufficio_id) throw new Error("Sede obbligatoria: ogni Specialist deve essere collegato a una Sede");
      const payload: Record<string, unknown> = {
        cognome: form.cognome || null,
        nome: form.nome || null,
        email: form.email || null,
        telefono: form.telefono || null,
        fax: form.fax || null,
        codice_fiscale: form.codice_fiscale ? form.codice_fiscale.toUpperCase() : null,
        descrizione: form.descrizione || null,
        ufficio_id: form.ufficio_id || null,
        indirizzo: form.indirizzo || null,
        cap: form.cap || null,
        citta: form.citta || null,
        provincia: form.provincia || null,
        nome_rui: form.nome_rui || null,
        sezione_rui: form.sezione_rui || null,
        numero_rui: form.numero_rui || null,
        data_iscrizione_rui: form.data_iscrizione_rui || null,
        codice_contabile: form.codice_contabile || null,
        percentuale_base: form.percentuale_base ? Number(form.percentuale_base) : null,
        percentuale_consulenza: form.percentuale_consulenza ? Number(form.percentuale_consulenza) : null,
        percentuale_ra: form.percentuale_ra ? Number(form.percentuale_ra) : null,
        iban: form.iban || null,
        intestatario_cc: form.intestatario_cc || null,
        note: form.note || null,
        attivo: form.attivo,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("profiles").update(payload as any).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specialist-profiles"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Specialist aggiornato");
    },
    onError: (e: Error) => toast.error(e.message || "Errore aggiornamento"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("profiles").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["specialist-profiles"] }),
  });

  const openEdit = (item: SpecialistRow) => {
    setEditingId(item.id);
    setForm({
      cognome: item.cognome || "",
      nome: item.nome || "",
      email: item.email || "",
      telefono: item.telefono || "",
      fax: item.fax || "",
      codice_fiscale: item.codice_fiscale || "",
      descrizione: item.descrizione || "",
      ufficio_id: item.ufficio_id || "",
      indirizzo: item.indirizzo || "",
      cap: item.cap || "",
      citta: item.citta || "",
      provincia: item.provincia || "",
      nome_rui: item.nome_rui || "",
      sezione_rui: item.sezione_rui || "",
      numero_rui: item.numero_rui || "",
      data_iscrizione_rui: item.data_iscrizione_rui || "",
      codice_contabile: item.codice_contabile || "",
      percentuale_base: item.percentuale_base?.toString() || "",
      percentuale_consulenza: item.percentuale_consulenza?.toString() || "",
      percentuale_ra: item.percentuale_ra?.toString() || "",
      iban: item.iban || "",
      intestatario_cc: item.intestatario_cc || "",
      note: item.note || "",
      attivo: item.attivo ?? true,
    });
    setDialogOpen(true);
  };

  // Deep-link: apri in edit la riga richiesta dal Centro Utenti
  useEffect(() => {
    if (!editId || items.length === 0) return;
    const target = items.find((i) => i.id === editId);
    if (target) {
      openEdit(target);
      onEditConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, items]);

  const filtered = items.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (p.nome?.toLowerCase().includes(s)) ||
      (p.cognome?.toLowerCase().includes(s)) ||
      (p.email?.toLowerCase().includes(s)) ||
      (p.codice_contabile?.toLowerCase().includes(s)) ||
      (p.codice_fiscale?.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, cognome, email, codice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{filtered.length} risultati</Badge>
      </div>

      <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground flex items-start gap-2">
        <UserCog className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          Gli <strong>Specialist</strong> sono utenti di sistema (ruolo <code className="text-foreground">backoffice</code>).
          Qui modifichi l'anagrafica completa: dati personali, RUI, percentuali e coordinate bancarie.
          Per <strong>creare un nuovo Specialist</strong> con accesso al sistema, usa Centro Utenti & Privilegi.
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/utenti-privilegi")}>
          <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Centro Utenti
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codice</TableHead>
              <TableHead>Cognome / Nome</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead>Tel / Email</TableHead>
              <TableHead>Dati RUI</TableHead>
              <TableHead>% Provv / Cons / RA</TableHead>
              <TableHead className="text-center">Stato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nessuno Specialist trovato</TableCell></TableRow>
            ) : (
              filtered.map((p, idx) => {
                const ruiParts = [
                  p.sezione_rui ? `Sez. ${p.sezione_rui}` : null,
                  p.numero_rui ? `N° ${p.numero_rui}` : null,
                  p.data_iscrizione_rui ? format(parseISO(p.data_iscrizione_rui), "dd/MM/yyyy") : null,
                ].filter(Boolean);
                return (
                  <TableRow
                    key={p.id}
                    className={cn("hover:bg-muted/50 cursor-pointer", idx % 2 === 1 && "bg-muted/20")}
                    onClick={() => openEdit(p)}
                  >
                    <TableCell className="font-medium">{p.codice_contabile || "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.cognome || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.nome || ""}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.ufficio_id ? (
                        ufficioMap[p.ufficio_id] || "—"
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">Sede mancante</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.telefono && <div>Tel {p.telefono}</div>}
                      {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                      {!p.telefono && !p.email && "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ruiParts.length > 0 ? ruiParts.map((r, i) => <div key={i} className="text-xs">{r}</div>) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="text-xs">Provv: {p.percentuale_base ?? 0}%</div>
                      <div className="text-xs">Cons: {p.percentuale_consulenza ?? 0}%</div>
                      <div className="text-xs">RA: {p.percentuale_ra ?? 0}%</div>
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch checked={p.attivo ?? true} onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, attivo: v })} />
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)} title="Modifica anagrafica">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Specialist</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
            <Tabs defaultValue="dati">
              <TabsList className="grid grid-cols-5">
                <TabsTrigger value="dati">Dati</TabsTrigger>
                <TabsTrigger value="indirizzo">Indirizzo</TabsTrigger>
                <TabsTrigger value="rui">RUI</TabsTrigger>
                <TabsTrigger value="provvigioni">Provvigioni</TabsTrigger>
                <TabsTrigger value="banca">Banca</TabsTrigger>
              </TabsList>

              <TabsContent value="dati" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Codice contabile</Label><Input value={form.codice_contabile} onChange={(e) => setForm({ ...form, codice_contabile: e.target.value })} /></div>
                  <div>
                    <Label>Sede <span className="text-destructive">*</span></Label>
                    <Select value={form.ufficio_id} onValueChange={(v) => setForm({ ...form, ufficio_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleziona sede..." /></SelectTrigger>
                      <SelectContent>
                        {uffici.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.codice_ufficio} — {u.nome_ufficio}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Cognome *</Label><Input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
                  <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Descrizione</Label><Input value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} /></div>
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Codice Fiscale</Label><Input value={form.codice_fiscale} onChange={(e) => setForm({ ...form, codice_fiscale: e.target.value.toUpperCase() })} /></div>
                  <div><Label>Telefono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
                  <div><Label>Fax</Label><Input value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Switch checked={form.attivo} onCheckedChange={(v) => setForm({ ...form, attivo: v })} />
                  <Label>Attivo</Label>
                </div>
              </TabsContent>

              <TabsContent value="indirizzo" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Indirizzo</Label><AddressAutocomplete value={form.indirizzo} onChange={(v) => setForm({ ...form, indirizzo: v })} onSelect={(c) => setForm((f) => ({ ...f, cap: c.cap, citta: c.citta, provincia: c.provincia }))} /></div>
                  <div><Label>CAP</Label><Input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
                  <div><Label>Città</Label><Input value={form.citta} onChange={(e) => setForm({ ...form, citta: e.target.value })} /></div>
                  <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value.toUpperCase() })} maxLength={2} /></div>
                </div>
                <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
              </TabsContent>

              <TabsContent value="rui" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome RUI</Label><Input value={form.nome_rui} onChange={(e) => setForm({ ...form, nome_rui: e.target.value })} /></div>
                  <div><Label>Sezione RUI</Label><Input value={form.sezione_rui} onChange={(e) => setForm({ ...form, sezione_rui: e.target.value })} placeholder="Es. B" /></div>
                  <div><Label>Numero RUI</Label><Input value={form.numero_rui} onChange={(e) => setForm({ ...form, numero_rui: e.target.value })} /></div>
                  <div><Label>Data iscrizione RUI</Label><DateField value={form.data_iscrizione_rui} onChange={(v) => setForm({ ...form, data_iscrizione_rui: v })} /></div>
                </div>
              </TabsContent>

              <TabsContent value="provvigioni" className="space-y-3 mt-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>% Provvigione</Label><Input type="number" step="0.01" value={form.percentuale_base} onChange={(e) => setForm({ ...form, percentuale_base: e.target.value })} /></div>
                  <div><Label>% Consulenza</Label><Input type="number" step="0.01" value={form.percentuale_consulenza} onChange={(e) => setForm({ ...form, percentuale_consulenza: e.target.value })} /></div>
                  <div><Label>% RA</Label><Input type="number" step="0.01" value={form.percentuale_ra} onChange={(e) => setForm({ ...form, percentuale_ra: e.target.value })} /></div>
                </div>
              </TabsContent>

              <TabsContent value="banca" className="space-y-3 mt-3">
                <div className="grid grid-cols-1 gap-3">
                  <div><Label>IBAN</Label><Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase() })} /></div>
                  <div><Label>Intestatario C/C</Label><Input value={form.intestatario_cc} onChange={(e) => setForm({ ...form, intestatario_cc: e.target.value })} /></div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SpecialistList;
