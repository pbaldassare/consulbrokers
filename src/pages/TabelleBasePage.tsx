import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FolderTree, GitBranch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ────────── Gruppi Ramo ────────── */

const GruppiRamoTab = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");

  const { data: gruppi = [], isLoading } = useQuery({
    queryKey: ["gruppi-ramo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gruppi_ramo")
        .select("*")
        .order("codice");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("gruppi_ramo")
          .update({ codice, descrizione })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("gruppi_ramo")
          .insert({ codice, descrizione });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gruppi-ramo"] });
      toast({ title: editing ? "Gruppo aggiornato" : "Gruppo creato" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("gruppi_ramo").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gruppi-ramo"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gruppi_ramo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gruppi-ramo"] });
      toast({ title: "Gruppo eliminato" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const openNew = () => { setEditing(null); setCodice(""); setDescrizione(""); setOpen(true); };
  const openEdit = (g: any) => { setEditing(g); setCodice(g.codice); setDescrizione(g.descrizione); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2"><FolderTree className="w-5 h-5" /> Gruppi Ramo</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuovo Gruppo</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Codice</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-24 text-center">Attivo</TableHead>
              <TableHead className="w-28 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>
            ) : gruppi.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nessun gruppo ramo inserito</TableCell></TableRow>
            ) : gruppi.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-mono font-semibold">{g.codice}</TableCell>
                <TableCell>{g.descrizione}</TableCell>
                <TableCell className="text-center">
                  <Switch checked={g.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: g.id, attivo: v })} />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(g)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(g.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifica Gruppo Ramo" : "Nuovo Gruppo Ramo"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="es. AUTO" /></div>
              <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="es. Rami Auto" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={() => save.mutate()} disabled={!codice || !descrizione || save.isPending}>
                {save.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ────────── Rami ────────── */

const RamiTab = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [gruppoId, setGruppoId] = useState("");

  const { data: rami = [], isLoading } = useQuery({
    queryKey: ["rami-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rami")
        .select("*, gruppi_ramo(codice, descrizione)")
        .order("codice");
      if (error) throw error;
      return data;
    },
  });

  const { data: gruppi = [] } = useQuery({
    queryKey: ["gruppi-ramo"],
    queryFn: async () => {
      const { data } = await supabase.from("gruppi_ramo").select("id, codice, descrizione").eq("attivo", true).order("codice");
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { codice, descrizione, gruppo_ramo_id: gruppoId || null };
      if (editing) {
        const { error } = await supabase.from("rami").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rami").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rami-list"] });
      toast({ title: editing ? "Ramo aggiornato" : "Ramo creato" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("rami").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rami-list"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rami").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rami-list"] });
      toast({ title: "Ramo eliminato" });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const openNew = () => { setEditing(null); setCodice(""); setDescrizione(""); setGruppoId(""); setOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setCodice(r.codice); setDescrizione(r.descrizione); setGruppoId(r.gruppo_ramo_id || ""); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2"><GitBranch className="w-5 h-5" /> Rami</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuovo Ramo</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Codice</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead>Gruppo</TableHead>
              <TableHead className="w-24 text-center">Attivo</TableHead>
              <TableHead className="w-28 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>
            ) : rami.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nessun ramo inserito</TableCell></TableRow>
            ) : rami.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono font-semibold">{r.codice}</TableCell>
                <TableCell>{r.descrizione}</TableCell>
                <TableCell>
                  {r.gruppi_ramo ? (
                    <Badge variant="secondary">{r.gruppi_ramo.codice} - {r.gruppi_ramo.descrizione}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Switch checked={r.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: r.id, attivo: v })} />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifica Ramo" : "Nuovo Ramo"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="es. 01" /></div>
              <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="es. Infortuni" /></div>
              <div>
                <Label>Gruppo Ramo</Label>
                <Select value={gruppoId} onValueChange={setGruppoId}>
                  <SelectTrigger><SelectValue placeholder="— Nessun gruppo —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nessun gruppo —</SelectItem>
                    {gruppi.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.codice} - {g.descrizione}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={() => save.mutate()} disabled={!codice || !descrizione || save.isPending}>
                {save.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ────────── Page ────────── */

const TabelleBasePage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tabelle di Base</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestione delle tabelle di lookup utilizzate nei filtri e nei form (Rami, Gruppi Ramo, ecc.)
        </p>
      </div>

      <Tabs defaultValue="gruppi" className="space-y-4">
        <TabsList>
          <TabsTrigger value="gruppi">Gruppi Ramo</TabsTrigger>
          <TabsTrigger value="rami">Rami</TabsTrigger>
        </TabsList>
        <TabsContent value="gruppi"><GruppiRamoTab /></TabsContent>
        <TabsContent value="rami"><RamiTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default TabelleBasePage;
