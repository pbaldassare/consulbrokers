import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, UserCheck, Scale, Briefcase, Eye, Users } from "lucide-react";

const TIPI = [
  { value: "liquidatore", label: "Liquidatori", icon: UserCheck },
  { value: "perito", label: "Periti", icon: Eye },
  { value: "legale", label: "Legali", icon: Scale },
  { value: "account_executive", label: "Account Executive", icon: Briefcase },
  { value: "corrispondente", label: "Corrispondenti", icon: Users },
] as const;

type TipoAnagrafica = typeof TIPI[number]["value"];

interface Anagrafica {
  id: string;
  tipo: string;
  nome: string | null;
  cognome: string | null;
  ragione_sociale: string | null;
  codice_fiscale: string | null;
  partita_iva: string | null;
  email: string | null;
  pec: string | null;
  telefono: string | null;
  cellulare: string | null;
  fax: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  compagnia_id: string | null;
  specializzazione: string | null;
  albo_numero: string | null;
  note: string | null;
  attivo: boolean | null;
  ufficio_id: string | null;
}

const emptyForm = {
  nome: "", cognome: "", ragione_sociale: "", codice_fiscale: "", partita_iva: "",
  email: "", pec: "", telefono: "", cellulare: "", fax: "",
  indirizzo: "", cap: "", citta: "", provincia: "",
  compagnia_id: "", specializzazione: "", albo_numero: "", note: "",
};

const AnagraficheProfessionaliPage = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TipoAnagrafica>("liquidatore");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["anagrafiche_professionali", activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anagrafiche_professionali")
        .select("*")
        .eq("tipo", activeTab)
        .order("cognome", { ascending: true });
      if (error) throw error;
      return data as Anagrafica[];
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie_select"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        tipo: activeTab,
        nome: form.nome || null,
        cognome: form.cognome || null,
        ragione_sociale: form.ragione_sociale || null,
        codice_fiscale: form.codice_fiscale || null,
        partita_iva: form.partita_iva || null,
        email: form.email || null,
        pec: form.pec || null,
        telefono: form.telefono || null,
        cellulare: form.cellulare || null,
        fax: form.fax || null,
        indirizzo: form.indirizzo || null,
        cap: form.cap || null,
        citta: form.citta || null,
        provincia: form.provincia || null,
        compagnia_id: form.compagnia_id || null,
        specializzazione: form.specializzazione || null,
        albo_numero: form.albo_numero || null,
        note: form.note || null,
        ufficio_id: profile?.ufficio_id || null,
      };
      const { error } = await supabase.from("anagrafiche_professionali").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anagrafiche_professionali"] });
      setDialogOpen(false);
      setForm(emptyForm);
      toast({ title: "Anagrafica creata con successo" });
    },
    onError: (e: Error) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("anagrafiche_professionali").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["anagrafiche_professionali"] }),
  });

  const filtered = items.filter((item) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (item.cognome?.toLowerCase().includes(s)) ||
      (item.nome?.toLowerCase().includes(s)) ||
      (item.ragione_sociale?.toLowerCase().includes(s)) ||
      (item.email?.toLowerCase().includes(s)) ||
      (item.citta?.toLowerCase().includes(s))
    );
  });

  const tipoLabel = TIPI.find((t) => t.value === activeTab)?.label || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anagrafiche</h1>
          <p className="text-sm text-muted-foreground">Liquidatori, Periti, Legali, Account Executive, Corrispondenti</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Nuovo
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TipoAnagrafica); setSearch(""); }}>
        <TabsList>
          {TIPI.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <t.icon className="w-4 h-4" />{t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Cerca per nome, cognome, email, città..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Badge variant="secondary">{filtered.length} risultati</Badge>
        </div>

        {TIPI.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cognome</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Città</TableHead>
                    <TableHead>Specializzazione</TableHead>
                    <TableHead className="text-center">Attivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nessun {t.label.slice(0, -1).toLowerCase()} trovato</TableCell></TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.cognome || "—"}</TableCell>
                        <TableCell>{item.nome || "—"}</TableCell>
                        <TableCell>{item.email || "—"}</TableCell>
                        <TableCell>{item.telefono || item.cellulare || "—"}</TableCell>
                        <TableCell>{item.citta || "—"}</TableCell>
                        <TableCell>{item.specializzazione || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={item.attivo ?? true} onCheckedChange={(v) => toggleMutation.mutate({ id: item.id, attivo: v })} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Dialog Nuovo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuovo {tipoLabel.slice(0, -1)}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <Tabs defaultValue="dati">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="dati">Dati Personali</TabsTrigger>
                <TabsTrigger value="contatti">Contatti</TabsTrigger>
                <TabsTrigger value="indirizzo">Indirizzo & Note</TabsTrigger>
              </TabsList>

              <TabsContent value="dati" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cognome</Label><Input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
                  <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                  <div><Label>Ragione Sociale</Label><Input value={form.ragione_sociale} onChange={(e) => setForm({ ...form, ragione_sociale: e.target.value })} /></div>
                  <div><Label>Codice Fiscale</Label><Input value={form.codice_fiscale} onChange={(e) => setForm({ ...form, codice_fiscale: e.target.value })} /></div>
                  <div><Label>Partita IVA</Label><Input value={form.partita_iva} onChange={(e) => setForm({ ...form, partita_iva: e.target.value })} /></div>
                  <div><Label>N° Albo</Label><Input value={form.albo_numero} onChange={(e) => setForm({ ...form, albo_numero: e.target.value })} /></div>
                  <div><Label>Specializzazione</Label><Input value={form.specializzazione} onChange={(e) => setForm({ ...form, specializzazione: e.target.value })} /></div>
                  <div>
                    <Label>Compagnia</Label>
                    <Select value={form.compagnia_id} onValueChange={(v) => setForm({ ...form, compagnia_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                      <SelectContent>
                        {compagnie.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contatti" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>PEC</Label><Input type="email" value={form.pec} onChange={(e) => setForm({ ...form, pec: e.target.value })} /></div>
                  <div><Label>Telefono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
                  <div><Label>Cellulare</Label><Input value={form.cellulare} onChange={(e) => setForm({ ...form, cellulare: e.target.value })} /></div>
                  <div><Label>Fax</Label><Input value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} /></div>
                </div>
              </TabsContent>

              <TabsContent value="indirizzo" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Indirizzo</Label><Input value={form.indirizzo} onChange={(e) => setForm({ ...form, indirizzo: e.target.value })} /></div>
                  <div><Label>CAP</Label><Input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
                  <div><Label>Città</Label><Input value={form.citta} onChange={(e) => setForm({ ...form, citta: e.target.value })} /></div>
                  <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} maxLength={2} /></div>
                </div>
                <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnagraficheProfessionaliPage;
