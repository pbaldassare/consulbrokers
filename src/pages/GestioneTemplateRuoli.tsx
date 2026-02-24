import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileStack, Pencil, Trash2 } from "lucide-react";

const RUOLI = ["admin", "ufficio", "produttore", "contabilita", "cfo", "cliente"];

const GestioneTemplateRuoli = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome_template: "",
    ruolo_base: "",
    descrizione: "",
    permessi_json: "{}",
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ["ruoli_template"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ruoli_template").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      let permessi;
      try {
        permessi = JSON.parse(form.permessi_json);
      } catch {
        throw new Error("JSON permessi non valido");
      }

      const payload = {
        nome_template: form.nome_template,
        ruolo_base: form.ruolo_base,
        descrizione: form.descrizione,
        permessi_json: permessi,
      };

      if (editId) {
        const { error } = await supabase.from("ruoli_template").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ruoli_template").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ruoli_template"] });
      toast({ title: editId ? "Template aggiornato" : "Template creato" });
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ruoli_template").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ruoli_template"] });
      toast({ title: "Template eliminato" });
    },
  });

  const resetForm = () => {
    setForm({ nome_template: "", ruolo_base: "", descrizione: "", permessi_json: "{}" });
    setEditId(null);
    setOpen(false);
  };

  const openEdit = (t: any) => {
    setEditId(t.id);
    setForm({
      nome_template: t.nome_template || "",
      ruolo_base: t.ruolo_base || "",
      descrizione: t.descrizione || "",
      permessi_json: JSON.stringify(t.permessi_json || {}, null, 2),
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Dashboard</span>
        <span>›</span>
        <span>Impostazioni</span>
        <span>›</span>
        <span>Template Ruoli</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileStack className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Template Ruoli</h1>
            <p className="text-sm text-muted-foreground">Gestione template ruoli preconfigurati</p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nuovo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? "Modifica Template" : "Nuovo Template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Nome Template</Label>
                <Input
                  value={form.nome_template}
                  onChange={(e) => setForm({ ...form, nome_template: e.target.value })}
                  placeholder="Es: Produttore Base"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ruolo Base</Label>
                <Select value={form.ruolo_base} onValueChange={(v) => setForm({ ...form, ruolo_base: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona ruolo" />
                  </SelectTrigger>
                  <SelectContent>
                    {RUOLI.map((r) => (
                      <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Descrizione</Label>
                <Textarea
                  value={form.descrizione}
                  onChange={(e) => setForm({ ...form, descrizione: e.target.value })}
                  placeholder="Descrizione del template"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Permessi (JSON)</Label>
                <Textarea
                  value={form.permessi_json}
                  onChange={(e) => setForm({ ...form, permessi_json: e.target.value })}
                  placeholder='{"dashboard": true, "prospect": true}'
                  rows={5}
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetForm}>Annulla</Button>
                <Button onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending}>
                  {editId ? "Salva Modifiche" : "Crea Template"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Caricamento...</div>
      ) : !templates?.length ? (
        <Card className="p-8 text-center">
          <FileStack className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nessun template</h3>
          <p className="text-sm text-muted-foreground">Crea il primo template per iniziare a gestire i ruoli.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{t.nome_template}</h3>
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {t.ruolo_base}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {t.descrizione && <p className="text-sm text-muted-foreground">{t.descrizione}</p>}
              {t.permessi_json && (
                <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-24 text-muted-foreground">
                  {JSON.stringify(t.permessi_json, null, 2)}
                </pre>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default GestioneTemplateRuoli;
