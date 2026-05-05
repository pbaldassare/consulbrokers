import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/SearchableSelect";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, XCircle, Network } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  compagniaId: string | null;
  compagniaNome: string;
}

const TIPI_RAPPORTO = [
  "Mandato diretto",
  "Mandato principale",
  "Sub-agenzia",
  "Convenzione broker",
  "Coverholder",
  "Altro",
];

interface RapportoForm {
  id?: string;
  gruppo_compagnia_id: string;
  codice_rapporto: string;
  tipo_rapporto: string;
  rami_abilitati: string;
  data_inizio: string;
  data_fine: string;
  attivo: boolean;
  percentuale_provvigione: string;
  conto_bancario_id: string | null;
  referente_compagnia: string;
  email_referente: string;
  telefono_referente: string;
  note: string;
}

const emptyForm: RapportoForm = {
  gruppo_compagnia_id: "",
  codice_rapporto: "",
  tipo_rapporto: "Mandato diretto",
  rami_abilitati: "",
  data_inizio: new Date().toISOString().slice(0, 10),
  data_fine: "",
  attivo: true,
  percentuale_provvigione: "",
  conto_bancario_id: null,
  referente_compagnia: "",
  email_referente: "",
  telefono_referente: "",
  note: "",
};

export default function RapportiCompagniaDialog({ open, onOpenChange, compagniaId, compagniaNome }: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<RapportoForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rapporti = [], isLoading } = useQuery({
    queryKey: ["compagnia_rapporti", compagniaId],
    queryFn: async () => {
      if (!compagniaId) return [];
      const { data, error } = await supabase
        .from("compagnia_rapporti" as any)
        .select("*, gruppi_compagnia:gruppo_compagnia_id(id, descrizione, codice)")
        .eq("compagnia_id", compagniaId)
        .order("attivo", { ascending: false })
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!compagniaId && open,
  });

  const { data: gruppi = [] } = useQuery({
    queryKey: ["gruppi_compagnia_for_rapporti"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_compagnia" as any)
        .select("id, descrizione, codice")
        .eq("attivo", true)
        .order("descrizione");
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!compagniaId) throw new Error("Compagnia non valida");
      if (!form.gruppo_compagnia_id) throw new Error("Seleziona la compagnia");
      const payload: any = {
        compagnia_id: compagniaId,
        gruppo_compagnia_id: form.gruppo_compagnia_id,
        codice_rapporto: form.codice_rapporto || null,
        tipo_rapporto: form.tipo_rapporto || null,
        rami_abilitati: form.rami_abilitati
          ? form.rami_abilitati.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        data_inizio: form.data_inizio || null,
        data_fine: form.data_fine || null,
        attivo: form.attivo,
        percentuale_provvigione: form.percentuale_provvigione ? Number(form.percentuale_provvigione) : null,
        conto_bancario_id: form.conto_bancario_id || null,
        referente_compagnia: form.referente_compagnia || null,
        email_referente: form.email_referente || null,
        telefono_referente: form.telefono_referente || null,
        note: form.note || null,
      };
      if (form.id) {
        const { error } = await supabase.from("compagnia_rapporti" as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("compagnia_rapporti" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti", compagniaId] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti_counts"] });
      setFormOpen(false);
      setForm(emptyForm);
      toast.success("Rapporto salvato");
    },
    onError: (e: any) => toast.error(e.message || "Errore nel salvataggio"),
  });

  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("compagnia_rapporti" as any)
        .update({ attivo: false, data_fine: new Date().toISOString().slice(0, 10) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti", compagniaId] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti_counts"] });
      toast.success("Rapporto chiuso");
    },
    onError: () => toast.error("Errore"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compagnia_rapporti" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti", compagniaId] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti_counts"] });
      setDeleteId(null);
      toast.success("Rapporto eliminato");
    },
    onError: () => toast.error("Errore eliminazione"),
  });

  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      gruppo_compagnia_id: r.gruppo_compagnia_id || "",
      codice_rapporto: r.codice_rapporto || "",
      tipo_rapporto: r.tipo_rapporto || "Mandato diretto",
      rami_abilitati: Array.isArray(r.rami_abilitati) ? r.rami_abilitati.join(", ") : "",
      data_inizio: r.data_inizio || "",
      data_fine: r.data_fine || "",
      attivo: r.attivo ?? true,
      percentuale_provvigione: r.percentuale_provvigione?.toString() || "",
      conto_bancario_id: r.conto_bancario_id || null,
      referente_compagnia: r.referente_compagnia || "",
      email_referente: r.email_referente || "",
      telefono_referente: r.telefono_referente || "",
      note: r.note || "",
    });
    setFormOpen(true);
  };

  const openNew = () => {
    setForm(emptyForm);
    setFormOpen(true);
  };

  const gruppiOptions = (gruppi as any[]).map((g) => ({
    value: g.id,
    label: g.descrizione,
    description: g.codice || undefined,
  }));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              Rapporti con agenzie — <span className="text-primary">{compagniaNome}</span>
              <Badge variant="secondary" className="ml-2">{rapporti.length}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNew} className="gap-2">
                <Plus className="w-4 h-4" /> Nuovo Rapporto
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <p className="text-muted-foreground text-sm">Caricamento...</p>
                ) : rapporti.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Nessun rapporto registrato. Clicca "Nuovo Rapporto" per crearne uno.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agenzia</TableHead>
                        <TableHead>Codice</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Rami</TableHead>
                        <TableHead>Inizio</TableHead>
                        <TableHead>Fine</TableHead>
                        <TableHead className="text-right">% Provv.</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(rapporti as any[]).map((r, idx) => (
                        <TableRow key={r.id} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                          <TableCell className="font-medium">
                            {r.gruppi_compagnia?.descrizione || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.codice_rapporto || "—"}</TableCell>
                          <TableCell className="text-sm">{r.tipo_rapporto || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                            {Array.isArray(r.rami_abilitati) && r.rami_abilitati.length
                              ? r.rami_abilitati.join(", ")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm">{r.data_inizio || "—"}</TableCell>
                          <TableCell className="text-sm">{r.data_fine || "—"}</TableCell>
                          <TableCell className="text-right text-sm">
                            {r.percentuale_provvigione != null ? `${r.percentuale_provvigione}%` : "—"}
                          </TableCell>
                          <TableCell>
                            {r.attivo ? (
                              <Badge className="bg-primary/10 text-primary border-primary/30">Attivo</Badge>
                            ) : (
                              <Badge variant="secondary">Chiuso</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Modifica">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {r.attivo && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => closeMutation.mutate(r.id)}
                                  title="Chiudi rapporto"
                                >
                                  <XCircle className="w-4 h-4 text-amber-600" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteId(r.id)}
                                title="Elimina"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form create/edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifica Rapporto" : "Nuovo Rapporto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Agenzia *</Label>
              <SearchableSelect
                options={gruppiOptions}
                value={form.gruppo_compagnia_id}
                onValueChange={(v) => setForm((p) => ({ ...p, gruppo_compagnia_id: v }))}
                placeholder="Seleziona compagnia..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Codice Rapporto</Label>
                <Input
                  value={form.codice_rapporto}
                  onChange={(e) => setForm((p) => ({ ...p, codice_rapporto: e.target.value }))}
                  placeholder="es. AG12345"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo Rapporto</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.tipo_rapporto}
                  onChange={(e) => setForm((p) => ({ ...p, tipo_rapporto: e.target.value }))}
                >
                  {TIPI_RAPPORTO.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rami abilitati (separati da virgola)</Label>
              <Input
                value={form.rami_abilitati}
                onChange={(e) => setForm((p) => ({ ...p, rami_abilitati: e.target.value }))}
                placeholder="es. RCA, Property, Vita"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data Inizio</Label>
                <Input
                  type="date"
                  value={form.data_inizio}
                  onChange={(e) => setForm((p) => ({ ...p, data_inizio: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data Fine</Label>
                <Input
                  type="date"
                  value={form.data_fine}
                  onChange={(e) => setForm((p) => ({ ...p, data_fine: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">% Provvigione</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.percentuale_provvigione}
                  onChange={(e) => setForm((p) => ({ ...p, percentuale_provvigione: e.target.value }))}
                  placeholder="es. 12.5"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Conto bancario dedicato</Label>
              <ContoBancarioSelect
                value={form.conto_bancario_id}
                onChange={(id) => setForm((p) => ({ ...p, conto_bancario_id: id }))}
                tipi={["compagnia", "generico"]}
                placeholder="Usa il conto della agenzia"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Se valorizzato, sostituisce l'IBAN della agenzia per questo specifico rapporto. Gestisci i conti in <span className="font-medium">Anagrafiche → Conti Bancari</span>.
              </p>
            </div>

            <div className="border-t pt-3 space-y-3">
              <Label className="text-sm font-medium">Referente in Agenzia</Label>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  placeholder="Nome referente"
                  value={form.referente_compagnia}
                  onChange={(e) => setForm((p) => ({ ...p, referente_compagnia: e.target.value }))}
                />
                <Input
                  placeholder="Email"
                  value={form.email_referente}
                  onChange={(e) => setForm((p) => ({ ...p, email_referente: e.target.value }))}
                />
                <Input
                  placeholder="Telefono"
                  value={form.telefono_referente}
                  onChange={(e) => setForm((p) => ({ ...p, telefono_referente: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Note</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Annulla</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!form.gruppo_compagnia_id || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Salvataggio..." : "Salva Rapporto"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare definitivamente questo rapporto?</AlertDialogTitle>
            <AlertDialogDescription>
              Verrà rimossa ogni traccia del rapporto. Per mantenere lo storico,
              usa invece "Chiudi rapporto".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
