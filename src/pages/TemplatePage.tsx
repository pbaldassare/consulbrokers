import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Eye, Tag, Mail, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const PLACEHOLDER_VARS = [
  { label: "Nome cliente", value: "{{cliente_nome}}" },
  { label: "Cognome cliente", value: "{{cliente_cognome}}" },
  { label: "Email cliente", value: "{{cliente_email}}" },
  { label: "Codice Fiscale", value: "{{cliente_codice_fiscale}}" },
  { label: "Ragione Sociale", value: "{{azienda_ragione_sociale}}" },
  { label: "N° Polizza", value: "{{polizza_numero}}" },
  { label: "Scadenza Polizza", value: "{{polizza_scadenza}}" },
  { label: "Premio Polizza", value: "{{polizza_premio}}" },
  { label: "Compagnia", value: "{{compagnia_nome}}" },
  { label: "Sede", value: "{{sede_nome}}" },
  { label: "Data Oggi", value: "{{data_oggi}}" },
];

const EXAMPLE_DATA: Record<string, string> = {
  "{{cliente_nome}}": "Mario",
  "{{cliente_cognome}}": "Rossi",
  "{{cliente_email}}": "mario.rossi@email.it",
  "{{cliente_codice_fiscale}}": "RSSMRA80A01H501Z",
  "{{azienda_ragione_sociale}}": "Rossi S.r.l.",
  "{{polizza_numero}}": "POL-2026-001234",
  "{{polizza_scadenza}}": "30/06/2026",
  "{{polizza_premio}}": "1.250,00",
  "{{compagnia_nome}}": "Allianz",
  "{{sede_nome}}": "Sede di Milano",
  "{{data_oggi}}": new Date().toLocaleDateString("it-IT"),
};

function replaceVars(text: string): string {
  let result = text;
  for (const [key, val] of Object.entries(EXAMPLE_DATA)) {
    result = result.replaceAll(key, val);
  }
  return result;
}

interface Categoria { id: string; nome: string; descrizione: string | null; }
interface Template { id: string; categoria_id: string; nome: string; oggetto: string; corpo: string; attivo: boolean; created_at: string; }

export default function TemplatePage() {
  const qc = useQueryClient();
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState({ nome: "", oggetto: "", corpo: "", categoria_id: "", attivo: true });
  const [newCatNome, setNewCatNome] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const corpoRef = useRef<HTMLTextAreaElement>(null);
  const oggettoRef = useRef<HTMLInputElement>(null);
  const [insertTarget, setInsertTarget] = useState<"corpo" | "oggetto">("corpo");

  const { data: categorie = [] } = useQuery({
    queryKey: ["template_categorie"],
    queryFn: async () => {
      const { data, error } = await supabase.from("template_categorie" as any).select("*").order("nome");
      if (error) throw error;
      return (data || []) as unknown as Categoria[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["template_email"],
    queryFn: async () => {
      const { data, error } = await supabase.from("template_email" as any).select("*").order("nome");
      if (error) throw error;
      return (data || []) as unknown as Template[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (t: typeof form & { id?: string }) => {
      if (t.id) {
        const { error } = await supabase.from("template_email" as any).update({ nome: t.nome, oggetto: t.oggetto, corpo: t.corpo, categoria_id: t.categoria_id, attivo: t.attivo } as any).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("template_email" as any).insert({ nome: t.nome, oggetto: t.oggetto, corpo: t.corpo, categoria_id: t.categoria_id, attivo: t.attivo } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["template_email"] }); setDialogOpen(false); toast.success("Template salvato"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("template_email" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["template_email"] }); toast.success("Template eliminato"); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveCatMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("template_categorie" as any).insert({ nome: newCatNome, descrizione: newCatDesc || null } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["template_categorie"] }); setCatDialogOpen(false); setNewCatNome(""); setNewCatDesc(""); toast.success("Categoria creata"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("template_email" as any).update({ attivo } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template_email"] }),
  });

  const filtered = selectedCat === "all" ? templates : templates.filter(t => t.categoria_id === selectedCat);
  const catMap = Object.fromEntries(categorie.map(c => [c.id, c.nome]));

  function openNew() {
    setEditTemplate(null);
    setForm({ nome: "", oggetto: "", corpo: "", categoria_id: categorie[0]?.id || "", attivo: true });
    setDialogOpen(true);
  }

  function openEdit(t: Template) {
    setEditTemplate(t);
    setForm({ nome: t.nome, oggetto: t.oggetto, corpo: t.corpo, categoria_id: t.categoria_id, attivo: t.attivo });
    setDialogOpen(true);
  }

  function insertVar(v: string) {
    if (insertTarget === "oggetto" && oggettoRef.current) {
      const el = oggettoRef.current;
      const start = el.selectionStart || form.oggetto.length;
      const newVal = form.oggetto.slice(0, start) + v + form.oggetto.slice(start);
      setForm(f => ({ ...f, oggetto: newVal }));
    } else if (corpoRef.current) {
      const el = corpoRef.current;
      const start = el.selectionStart || form.corpo.length;
      const newVal = form.corpo.slice(0, start) + v + form.corpo.slice(start);
      setForm(f => ({ ...f, corpo: newVal }));
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Mail className="h-6 w-6" /> Template Email</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestisci modelli di email con variabili automatiche per clienti e polizze</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCatDialogOpen(true)}><Tag className="h-4 w-4 mr-1" /> Nuova Categoria</Button>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuovo Template</Button>
        </div>
      </div>

      <Tabs value={selectedCat} onValueChange={setSelectedCat}>
        <TabsList>
          <TabsTrigger value="all">Tutti</TabsTrigger>
          {categorie.map(c => <TabsTrigger key={c.id} value={c.id}>{c.nome}</TabsTrigger>)}
        </TabsList>

        <TabsContent value={selectedCat} className="mt-4">
          {filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun template in questa categoria</CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Oggetto</TableHead>
                    <TableHead className="text-center">Attivo</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell><Badge variant="secondary">{catMap[t.categoria_id] || "—"}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">{t.oggetto}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={t.attivo} onCheckedChange={v => toggleMut.mutate({ id: t.id, attivo: v })} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <TooltipProvider><Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => { setPreviewTemplate(t); setPreviewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                          </TooltipTrigger><TooltipContent>Anteprima</TooltipContent></Tooltip></TooltipProvider>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("Eliminare questo template?")) deleteMut.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog crea/modifica */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTemplate ? "Modifica Template" : "Nuovo Template"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome template</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Es. Sollecito pagamento" />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.categoria_id} onValueChange={v => setForm(f => ({ ...f, categoria_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>{categorie.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Oggetto email</Label>
              <Input ref={oggettoRef} value={form.oggetto} onChange={e => setForm(f => ({ ...f, oggetto: e.target.value }))} onFocus={() => setInsertTarget("oggetto")} placeholder="Es. Sollecito pagamento polizza {{polizza_numero}}" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Corpo email</Label>
                <div className="flex items-center gap-1">
                  <Switch checked={form.attivo} onCheckedChange={v => setForm(f => ({ ...f, attivo: v }))} />
                  <span className="text-xs text-muted-foreground">Attivo</span>
                </div>
              </div>
              <Textarea ref={corpoRef} value={form.corpo} onChange={e => setForm(f => ({ ...f, corpo: e.target.value }))} onFocus={() => setInsertTarget("corpo")} className="min-h-[200px] font-mono text-sm" placeholder="Scrivi il corpo dell'email con le variabili..." />
            </div>

            {/* Barra variabili */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Inserisci variabile (clicca per aggiungere nel campo {insertTarget})</Label>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDER_VARS.map(v => (
                  <Button key={v.value} type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => insertVar(v.value)}>
                    <Copy className="h-3 w-3 mr-1" />{v.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={() => saveMut.mutate({ ...form, id: editTemplate?.id })} disabled={!form.nome || !form.categoria_id}>
              {editTemplate ? "Salva modifiche" : "Crea template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog anteprima */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Anteprima: {previewTemplate?.nome}</DialogTitle></DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Oggetto</Label>
                <p className="font-medium">{replaceVars(previewTemplate.oggetto)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Corpo</Label>
                <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm border">{replaceVars(previewTemplate.corpo)}</div>
              </div>
              <p className="text-xs text-muted-foreground italic">I dati mostrati sono di esempio. Le variabili verranno sostituite con i dati reali al momento dell'invio.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog nuova categoria */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuova Categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={newCatNome} onChange={e => setNewCatNome(e.target.value)} placeholder="Es. Conferma" /></div>
            <div className="space-y-1.5"><Label>Descrizione</Label><Input value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} placeholder="Opzionale" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Annulla</Button>
            <Button onClick={() => saveCatMut.mutate()} disabled={!newCatNome.trim()}>Crea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
