import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Search, Eye } from "lucide-react";

const STATI_PROSPECT = [
  { value: "nuovo", label: "Nuovo", color: "bg-kpi-blue-bg text-kpi-blue-text border-kpi-blue-border" },
  { value: "in_trattativa", label: "In Trattativa", color: "bg-kpi-yellow-bg text-kpi-yellow-text border-kpi-yellow-border" },
  { value: "preventivo_inviato", label: "Preventivo Inviato", color: "bg-kpi-orange-bg text-kpi-orange-text border-kpi-orange-border" },
  { value: "chiuso_vinto", label: "Chiuso Vinto", color: "bg-kpi-green-bg text-kpi-green-text border-kpi-green-border" },
  { value: "chiuso_perso", label: "Chiuso Perso", color: "bg-destructive/10 text-destructive border-destructive/30" },
];

const FONTI = ["Referral", "Web", "Telefono", "Evento", "Altro"];

const ProspectList = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [filtroSearch, setFiltroSearch] = useState("");
  const [form, setForm] = useState({
    nome: "", cognome: "", email: "", telefono: "", fonte: "", note: "",
  });

  const { data: prospect, isLoading } = useQuery({
    queryKey: ["prospect"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect")
        .select("*, profiles:assegnato_a(nome, cognome), uffici:ufficio_id(nome_ufficio)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        nome: form.nome,
        cognome: form.cognome,
        email: form.email || null,
        telefono: form.telefono || null,
        fonte: form.fonte || null,
        note: form.note || null,
        stato: "nuovo",
        assegnato_a: profile?.id || null,
        ufficio_id: profile?.ufficio_id || null,
      };

      const { data, error } = await supabase.from("prospect").insert(payload).select().single();
      if (error) throw error;

      await logAttivita({
        azione: "creazione_prospect",
        entita_tipo: "prospect",
        entita_id: data.id,
        dettagli_json: { nome: form.nome, cognome: form.cognome, stato: "nuovo" },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect"] });
      toast({ title: "Prospect creato con successo" });
      setForm({ nome: "", cognome: "", email: "", telefono: "", fonte: "", note: "" });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const filtered = prospect?.filter((p) => {
    if (filtroStato !== "tutti" && p.stato !== filtroStato) return false;
    if (filtroSearch) {
      const search = filtroSearch.toLowerCase();
      const fullName = `${p.nome || ""} ${p.cognome || ""}`.toLowerCase();
      const email = (p.email || "").toLowerCase();
      if (!fullName.includes(search) && !email.includes(search)) return false;
    }
    return true;
  });

  const getStatoBadge = (stato: string) => {
    const s = STATI_PROSPECT.find((x) => x.value === stato);
    return s ? (
      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${s.color}`}>
        {s.label}
      </span>
    ) : <Badge variant="secondary">{stato}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Dashboard</span><span>›</span><span>Prospect & Trattative</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Prospect & Trattative</h1>
            <p className="text-sm text-muted-foreground">Gestione prospect e trattative commerciali</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />Nuovo Prospect</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Nuovo Prospect</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Mario" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cognome *</Label>
                  <Input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} placeholder="Rossi" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@esempio.it" />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefono</Label>
                  <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+39..." />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Fonte</Label>
                <Select value={form.fonte} onValueChange={(v) => setForm({ ...form, fonte: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona fonte" /></SelectTrigger>
                  <SelectContent>
                    {FONTI.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} placeholder="Note aggiuntive..." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.nome || !form.cognome}>
                  Crea Prospect
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 w-64"
            placeholder="Cerca per nome o email..."
            value={filtroSearch}
            onChange={(e) => setFiltroSearch(e.target.value)}
          />
        </div>
        <Select value={filtroStato} onValueChange={setFiltroStato}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {STATI_PROSPECT.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Caricamento...</div>
      ) : !filtered?.length ? (
        <Card className="p-8 text-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nessun prospect trovato</h3>
          <p className="text-sm text-muted-foreground">Crea il primo prospect per iniziare.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Assegnato a</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/prospect/${p.id}`)}>
                  <TableCell className="font-medium">{p.nome} {p.cognome}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.telefono || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.fonte || "—"}</TableCell>
                  <TableCell>{getStatoBadge(p.stato)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {(p as any).profiles ? `${(p as any).profiles.nome || ""} ${(p as any).profiles.cognome || ""}`.trim() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default ProspectList;
