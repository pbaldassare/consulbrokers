import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { logAttivita } from "@/lib/logAttivita";
import { useNavigate } from "react-router-dom";
import { Plus, Wallet, AlertTriangle, CheckCircle, Pause } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const statoBadge: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  attivo: { variant: "default", icon: CheckCircle },
  sospeso: { variant: "secondary", icon: Pause },
  chiuso: { variant: "outline", icon: AlertTriangle },
};

const PortafoglioList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    descrizione: "",
    importo_atteso: "",
    periodicita: "annuale",
    prossima_scadenza: "",
    stato: "attivo",
  });

  const { data: uffici } = useQuery({
    queryKey: ["uffici"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true);
      return data || [];
    },
  });

  const { data: portafogli, isLoading } = useQuery({
    queryKey: ["portafoglio_incassi", filtroStato],
    queryFn: async () => {
      let q = supabase
        .from("portafoglio_incassi" as any)
        .select("*, uffici(nome_ufficio), profiles(nome, cognome)")
        .order("prossima_scadenza", { ascending: true });
      if (filtroStato !== "tutti") q = q.eq("stato", filtroStato);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: eventiKO } = useQuery({
    queryKey: ["portafoglio_eventi_ko"],
    queryFn: async () => {
      const { data } = await supabase
        .from("portafoglio_incassi_eventi" as any)
        .select("*")
        .eq("esito", "ko");
      return (data || []) as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const myUfficio = await supabase.rpc("get_my_ufficio_id");
      const { data, error } = await supabase.from("portafoglio_incassi" as any).insert([{
        descrizione: form.descrizione,
        importo_atteso: parseFloat(form.importo_atteso),
        periodicita: form.periodicita,
        prossima_scadenza: form.prossima_scadenza,
        stato: form.stato,
        ufficio_id: myUfficio.data,
      }]).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: async (data: any) => {
      await logAttivita({ azione: "creazione_portafoglio", entita_tipo: "portafoglio_incassi", entita_id: data.id });
      queryClient.invalidateQueries({ queryKey: ["portafoglio_incassi"] });
      setDialogOpen(false);
      setForm({ descrizione: "", importo_atteso: "", periodicita: "annuale", prossima_scadenza: "", stato: "attivo" });
      toast({ title: "Portafoglio creato" });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile creare il portafoglio", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portafoglio Incassi</h1>
          <p className="text-muted-foreground">Gestione incassi ricorrenti e portafoglio storico</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuovo Portafoglio</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo Portafoglio Incassi</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Descrizione</Label>
                <Textarea value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Importo Atteso (€)</Label>
                  <Input type="number" step="0.01" value={form.importo_atteso} onChange={(e) => setForm({ ...form, importo_atteso: e.target.value })} />
                </div>
                <div>
                  <Label>Periodicità</Label>
                  <Select value={form.periodicita} onValueChange={(v) => setForm({ ...form, periodicita: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensile">Mensile</SelectItem>
                      <SelectItem value="trimestrale">Trimestrale</SelectItem>
                      <SelectItem value="annuale">Annuale</SelectItem>
                      <SelectItem value="una_tantum">Una Tantum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Prossima Scadenza</Label>
                <Input type="date" value={form.prossima_scadenza} onChange={(e) => setForm({ ...form, prossima_scadenza: e.target.value })} />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!form.descrizione || !form.importo_atteso || !form.prossima_scadenza} className="w-full">
                Crea Portafoglio
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{portafogli?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Totale portafogli</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{portafogli?.filter((p: any) => p.stato === "attivo").length || 0}</p>
                <p className="text-xs text-muted-foreground">Attivi</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{eventiKO?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Eventi KO</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">
                  €{portafogli?.reduce((s: number, p: any) => s + (p.stato === "attivo" ? Number(p.importo_atteso) : 0), 0).toLocaleString("it-IT", { minimumFractionDigits: 2 }) || "0,00"}
                </p>
                <p className="text-xs text-muted-foreground">Tot. atteso attivi</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={filtroStato} onValueChange={setFiltroStato}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Stato" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti gli stati</SelectItem>
                <SelectItem value="attivo">Attivo</SelectItem>
                <SelectItem value="sospeso">Sospeso</SelectItem>
                <SelectItem value="chiuso">Chiuso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>Lista Portafogli</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrizione</TableHead>
                <TableHead>Ufficio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Importo</TableHead>
                <TableHead>Periodicità</TableHead>
                <TableHead>Prossima Scadenza</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
              ) : !portafogli?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nessun portafoglio trovato</TableCell></TableRow>
              ) : portafogli.map((p: any) => {
                const badge = statoBadge[p.stato] || statoBadge.attivo;
                return (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/portafoglio/${p.id}`)}>
                    <TableCell className="font-medium">{p.descrizione}</TableCell>
                    <TableCell>{(p.uffici as any)?.nome_ufficio || "-"}</TableCell>
                    <TableCell>{p.profiles ? `${(p.profiles as any).nome || ""} ${(p.profiles as any).cognome || ""}`.trim() : "-"}</TableCell>
                    <TableCell>€{Number(p.importo_atteso).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="capitalize">{p.periodicita?.replace("_", " ")}</TableCell>
                    <TableCell>{format(new Date(p.prossima_scadenza), "dd/MM/yyyy")}</TableCell>
                    <TableCell><Badge variant={badge.variant} className="capitalize">{p.stato}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortafoglioList;
