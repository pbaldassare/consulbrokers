import { useState } from "react";
import { SearchableSelect } from "@/components/SearchableSelect";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

/* ────────── Generic CRUD Tab ────────── */

interface SimpleLookupTabProps {
  tableName: string;
  title: string;
  queryKey: string;
}

const SimpleLookupTab = ({ tableName, title, queryKey }: SimpleLookupTabProps) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName as any)
        .select("*")
        .order("codice");
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await (supabase.from(tableName as any) as any).update({ codice, descrizione }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from(tableName as any) as any).insert({ codice, descrizione });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(editing ? `${title} aggiornato` : `${title} creato`);
      closeDialog();
    },
    onError: (e: any) => toast.error("Errore"),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await (supabase.from(tableName as any) as any).update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from(tableName as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${title} eliminato`);
    },
    onError: (e: any) => toast.error("Errore"),
  });

  const openNew = () => { setEditing(null); setCodice(""); setDescrizione(""); setOpen(true); };
  const openEdit = (g: any) => { setEditing(g); setCodice(g.codice); setDescrizione(g.descrizione); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuovo</Button>
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
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nessun elemento inserito</TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-semibold">{item.codice}</TableCell>
                <TableCell>{item.descrizione}</TableCell>
                <TableCell className="text-center">
                  <Switch checked={item.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: item.id, attivo: v })} />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? `Modifica ${title}` : `Nuovo ${title}`}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="es. 01" /></div>
              <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Descrizione..." /></div>
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

/* ────────── Rami Tab (with gruppo_ramo_id relation) ────────── */

const RamiTab = () => {
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
      const payload = { codice, descrizione, gruppo_ramo_id: gruppoId && gruppoId !== "none" ? gruppoId : null };
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
      toast.success(editing ? "Ramo aggiornato" : "Ramo creato");
      closeDialog();
    },
    onError: (e: any) => toast.error("Errore"),
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
      toast.success("Ramo eliminato");
    },
    onError: (e: any) => toast.error("Errore"),
  });

  const openNew = () => { setEditing(null); setCodice(""); setDescrizione(""); setGruppoId(""); setOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setCodice(r.codice); setDescrizione(r.descrizione); setGruppoId(r.gruppo_ramo_id || ""); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Rami</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuovo Ramo</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Codice</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead>Gruppo Ramo</TableHead>
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
                <SearchableSelect
                  value={gruppoId}
                  onValueChange={setGruppoId}
                  placeholder="— Nessun gruppo —"
                  options={[
                    { value: "none", label: "— Nessun gruppo —" },
                    ...gruppi.map((g) => ({ value: g.id, label: `${g.codice} - ${g.descrizione}` })),
                  ]}
                />
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

/* ────────── Gruppi Finanziari Tab ────────── */

const GruppiFinanziariTab = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [nome, setNome] = useState("");
  const [descrizione, setDescrizione] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["gruppi-finanziari"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gruppi_finanziari" as any)
        .select("*")
        .order("codice");
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await (supabase.from("gruppi_finanziari" as any) as any).update({ codice, nome, descrizione }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("gruppi_finanziari" as any) as any).insert({ codice, nome, descrizione });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gruppi-finanziari"] });
      toast.success(editing ? "Gruppo aggiornato" : "Gruppo creato");
      closeDialog();
    },
    onError: (e: any) => toast.error("Errore"),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await (supabase.from("gruppi_finanziari" as any) as any).update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gruppi-finanziari"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("gruppi_finanziari" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gruppi-finanziari"] });
      toast.success("Gruppo eliminato");
    },
    onError: (e: any) => toast.error("Errore"),
  });

  const openNew = () => { setEditing(null); setCodice(""); setNome(""); setDescrizione(""); setOpen(true); };
  const openEdit = (g: any) => { setEditing(g); setCodice(g.codice); setNome(g.nome || ""); setDescrizione(g.descrizione); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Gruppi Finanziari</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuovo</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Codice</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-24 text-center">Attivo</TableHead>
              <TableHead className="w-28 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nessun elemento</TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-semibold">{item.codice}</TableCell>
                <TableCell className="font-medium">{item.nome || "—"}</TableCell>
                <TableCell>{item.descrizione}</TableCell>
                <TableCell className="text-center">
                  <Switch checked={item.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: item.id, attivo: v })} />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifica Gruppo Finanziario" : "Nuovo Gruppo Finanziario"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="es. ISP" /></div>
              <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Intesa Sanpaolo S.p.A." /></div>
              <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Descrizione..." /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={() => save.mutate()} disabled={!codice || !nome || !descrizione || save.isPending}>
                {save.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ────────── Ordered Lookup Tab (with ordine field) ────────── */

interface OrderedLookupTabProps {
  tableName: string;
  title: string;
  queryKey: string;
}

const OrderedLookupTab = ({ tableName, title, queryKey }: OrderedLookupTabProps) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [ordine, setOrdine] = useState(0);

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName as any)
        .select("*")
        .order("ordine");
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await (supabase.from(tableName as any) as any).update({ codice, descrizione, ordine }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from(tableName as any) as any).insert({ codice, descrizione, ordine });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: ["lookup", tableName] });
      toast.success(editing ? `${title} aggiornato` : `${title} creato`);
      closeDialog();
    },
    onError: () => toast.error("Errore"),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await (supabase.from(tableName as any) as any).update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: ["lookup", tableName] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from(tableName as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: ["lookup", tableName] });
      toast.success(`${title} eliminato`);
    },
    onError: () => toast.error("Errore"),
  });

  const openNew = () => { setEditing(null); setCodice(""); setDescrizione(""); setOrdine(items.length + 1); setOpen(true); };
  const openEdit = (g: any) => { setEditing(g); setCodice(g.codice); setDescrizione(g.descrizione); setOrdine(g.ordine ?? 0); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuovo</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Ordine</TableHead>
              <TableHead className="w-32">Codice</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-24 text-center">Attivo</TableHead>
              <TableHead className="w-28 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nessun elemento inserito</TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-center font-mono">{item.ordine}</TableCell>
                <TableCell className="font-mono font-semibold">{item.codice}</TableCell>
                <TableCell>{item.descrizione}</TableCell>
                <TableCell className="text-center">
                  <Switch checked={item.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: item.id, attivo: v })} />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? `Modifica ${title}` : `Nuovo ${title}`}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="es. F01" /></div>
              <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Descrizione..." /></div>
              <div><Label>Ordine</Label><Input type="number" value={ordine} onChange={(e) => setOrdine(Number(e.target.value))} placeholder="1" /></div>
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

const tabConfig: { value: string; label: string; tableName: string; queryKey: string; title: string; custom?: string | boolean }[] = [
  { value: "gruppi_ramo", label: "Gruppi Ramo", tableName: "gruppi_ramo", queryKey: "gruppi-ramo", title: "Gruppo Ramo" },
  { value: "rami", label: "Rami", tableName: "rami", queryKey: "rami-list", title: "Ramo", custom: true },
  { value: "gruppi_statistici", label: "Gruppi Statistici", tableName: "gruppi_statistici", queryKey: "gruppi-statistici", title: "Gruppo Statistico" },
  { value: "gruppi_compagnia", label: "Gruppi Compagnia", tableName: "gruppi_compagnia", queryKey: "gruppi-compagnia-lookup", title: "Gruppo Compagnia" },
  { value: "gruppi_finanziari", label: "Gruppi Finanziari", tableName: "gruppi_finanziari", queryKey: "gruppi-finanziari", title: "Gruppo Finanziario", custom: "gruppi_finanziari" },
  { value: "tipi_mandatario", label: "Tipi Mandatario", tableName: "tipi_mandatario", queryKey: "tipi-mandatario", title: "Tipo Mandatario" },
  { value: "tipi_rinnovo", label: "Tipi Rinnovo", tableName: "tipi_rinnovo", queryKey: "tipi-rinnovo", title: "Tipo Rinnovo" },
  { value: "filiali", label: "Filiali", tableName: "filiali", queryKey: "filiali-lookup", title: "Filiale" },
  { value: "lookup_zone", label: "Zone", tableName: "lookup_zone", queryKey: "lookup-zone", title: "Zona", custom: "ordered" },
  { value: "lookup_indotti", label: "Indotti", tableName: "lookup_indotti", queryKey: "lookup-indotti", title: "Indotto" },
  { value: "lookup_attivita", label: "Attività", tableName: "lookup_attivita", queryKey: "lookup-attivita", title: "Attività" },
  { value: "lookup_settori", label: "Settori", tableName: "lookup_settori", queryKey: "lookup-settori", title: "Settore" },
  { value: "lookup_contratti", label: "Contratti", tableName: "lookup_contratti", queryKey: "lookup-contratti", title: "Contratto" },
  { value: "lookup_fasce_fatturato", label: "Fasce Fatturato", tableName: "lookup_fasce_fatturato", queryKey: "lookup-fasce-fatturato", title: "Fascia Fatturato", custom: "ordered" },
  { value: "lookup_fasce_dipendenti", label: "Fasce Dipendenti", tableName: "lookup_fasce_dipendenti", queryKey: "lookup-fasce-dipendenti", title: "Fascia Dipendenti", custom: "ordered" },
];

const TabelleBasePage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tabelle di Base</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestione delle tabelle di lookup utilizzate nei filtri e nei form
        </p>
      </div>

      <Tabs defaultValue="gruppi_ramo" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          {tabConfig.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {tabConfig.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {t.custom === true || t.custom === "rami" ? (
              <RamiTab />
            ) : t.custom === "gruppi_finanziari" ? (
              <GruppiFinanziariTab />
            ) : t.custom === "ordered" ? (
              <OrderedLookupTab tableName={t.tableName} title={t.title} queryKey={t.queryKey} />
            ) : (
              <SimpleLookupTab tableName={t.tableName} title={t.title} queryKey={t.queryKey} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default TabelleBasePage;
