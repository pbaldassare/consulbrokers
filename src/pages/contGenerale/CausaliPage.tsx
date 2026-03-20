import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, BookOpen } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";

const TIPI_TABELLA = [
  { key: "causale_primanota", label: "Causali Primanota" },
  { key: "assoggettamento_iva", label: "Assogg. IVA" },
  { key: "formato", label: "Formato" },
  { key: "divisione", label: "Divisioni" },
  { key: "modalita_consegna", label: "Mod. Consegna" },
  { key: "tipo_compenso", label: "Tipo Compenso" },
  { key: "categoria_fido", label: "Cat. Fido" },
  { key: "codice_descrizione", label: "Cod. Descrizione" },
  { key: "budget_report", label: "Budget Report" },
];

interface CausaleForm {
  codice: string;
  descrizione: string;
  attivo: boolean;
}

const CausaliPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(TIPI_TABELLA[0].key);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CausaleForm>({ codice: "", descrizione: "", attivo: true });

  const { data: causali = [], isLoading } = useQuery({
    queryKey: ["causali_contabili", activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("causali_contabili")
        .select("*")
        .eq("tipo_tabella", activeTab)
        .order("codice");
      if (error) throw error;
      return data;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: CausaleForm & { id?: string }) => {
      if (values.id) {
        const { error } = await supabase.from("causali_contabili").update({
          codice: values.codice,
          descrizione: values.descrizione,
          attivo: values.attivo,
        }).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("causali_contabili").insert({
          tipo_tabella: activeTab,
          codice: values.codice,
          descrizione: values.descrizione,
          attivo: values.attivo,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["causali_contabili"] });
      setDialogOpen(false);
      toast.success(editingId ? "Causale aggiornata" : "Causale creata");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditingId(null);
    setForm({ codice: "", descrizione: "", attivo: true });
    setDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setEditingId(row.id);
    setForm({ codice: row.codice, descrizione: row.descrizione, attivo: row.attivo });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.codice || !form.descrizione) { toast.error("Compila tutti i campi"); return; }
    upsertMutation.mutate({ ...form, id: editingId ?? undefined });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageBreadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Causali e Tabelle di Servizio</h1>
            <p className="text-sm text-muted-foreground">Gestione codici e tabelle di base contabilità generale</p>
          </div>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nuova Voce</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/60 p-1.5">
          {TIPI_TABELLA.map(t => (
            <TabsTrigger key={t.key} value={t.key} className="text-xs">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {TIPI_TABELLA.map(t => (
          <TabsContent key={t.key} value={t.key}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Caricamento...</p>
                ) : causali.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nessuna voce presente. Clicca "Nuova Voce" per aggiungere.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Codice</TableHead>
                        <TableHead>Descrizione</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {causali.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-sm">{c.codice}</TableCell>
                          <TableCell>{c.descrizione}</TableCell>
                          <TableCell>
                            <Badge variant={c.attivo ? "default" : "secondary"}>
                              {c.attivo ? "Attivo" : "Disattivo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifica Voce" : "Nuova Voce"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Codice</Label>
              <Input value={form.codice} onChange={e => setForm(f => ({ ...f, codice: e.target.value }))} />
            </div>
            <div>
              <Label>Descrizione</Label>
              <Input value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.attivo} onChange={e => setForm(f => ({ ...f, attivo: e.target.checked }))} />
              <Label>Attivo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CausaliPage;
