import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Send, CheckCircle } from "lucide-react";
import {
  type SinistroPrescrizioneRow,
  type PrescrizioneDestinatario,
  type PrescrizioneStato,
  PRESCRIZIONE_STATO_LABEL,
  PRESCRIZIONE_STATO_CLASS,
  DESTINATARIO_LABEL,
} from "@/lib/sinistroPrescrizioniReminder";

type FormState = {
  destinatario_tipo: PrescrizioneDestinatario;
  destinatario_label: string;
  oggetto: string;
  corpo: string;
  data_scadenza_risposta: string;
  data_invio: string;
  canale: string;
  note: string;
  stato: PrescrizioneStato;
};

const emptyForm = (): FormState => ({
  destinatario_tipo: "cliente",
  destinatario_label: "",
  oggetto: "",
  corpo: "",
  data_scadenza_risposta: "",
  data_invio: "",
  canale: "",
  note: "",
  stato: "bozza",
});

interface Props {
  sinistroId: string;
  disabled?: boolean;
}

export default function SinistroPrescrizioniPanel({ sinistroId, disabled }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SinistroPrescrizioneRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const { data: prescrizioni = [], isLoading } = useQuery({
    queryKey: ["sinistro-prescrizioni", sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistro_prescrizioni")
        .select("*")
        .eq("sinistro_id", sinistroId)
        .order("data_scadenza_risposta", { ascending: true });
      if (error) throw error;
      return (data || []) as SinistroPrescrizioneRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sinistro-prescrizioni", sinistroId] });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: SinistroPrescrizioneRow) => {
    setEditing(row);
    setForm({
      destinatario_tipo: row.destinatario_tipo,
      destinatario_label: row.destinatario_label || "",
      oggetto: row.oggetto,
      corpo: row.corpo || "",
      data_scadenza_risposta: row.data_scadenza_risposta,
      data_invio: row.data_invio || "",
      canale: row.canale || "",
      note: row.note || "",
      stato: row.stato,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.oggetto.trim() || !form.data_scadenza_risposta) {
      toast.error("Oggetto e scadenza risposta sono obbligatori");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      const payload = {
        sinistro_id: sinistroId,
        destinatario_tipo: form.destinatario_tipo,
        destinatario_label: form.destinatario_label.trim() || null,
        oggetto: form.oggetto.trim(),
        corpo: form.corpo.trim() || null,
        data_scadenza_risposta: form.data_scadenza_risposta,
        data_invio: form.data_invio || null,
        canale: form.canale.trim() || null,
        note: form.note.trim() || null,
        stato: form.stato,
      };

      if (editing) {
        const { error } = await supabase.from("sinistro_prescrizioni").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Prescrizione aggiornata");
      } else {
        const { error } = await supabase.from("sinistro_prescrizioni").insert({ ...payload, creato_da: user.id });
        if (error) throw error;
        toast.success("Prescrizione aggiunta");
      }
      setDialogOpen(false);
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const updateStato = async (id: string, stato: PrescrizioneStato, dataInvio?: string) => {
    try {
      const update: Record<string, unknown> = { stato };
      if (dataInvio) update.data_invio = dataInvio;
      const { error } = await supabase.from("sinistro_prescrizioni").update(update).eq("id", id);
      if (error) throw error;
      toast.success(`Stato aggiornato: ${PRESCRIZIONE_STATO_LABEL[stato]}`);
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore aggiornamento");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questa prescrizione?")) return;
    try {
      const { error } = await supabase.from("sinistro_prescrizioni").delete().eq("id", id);
      if (error) throw error;
      toast.success("Prescrizione eliminata");
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore eliminazione");
    }
  };

  const oggi = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={disabled} onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nuova prescrizione
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Modifica prescrizione" : "Nuova prescrizione perentoria"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Destinatario</Label>
                  <Select
                    value={form.destinatario_tipo}
                    onValueChange={(v) => setForm({ ...form, destinatario_tipo: v as PrescrizioneDestinatario })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DESTINATARIO_LABEL).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Label destinatario (opz.)</Label>
                  <Input
                    value={form.destinatario_label}
                    onChange={(e) => setForm({ ...form, destinatario_label: e.target.value })}
                    placeholder="Es. nome perito"
                  />
                </div>
              </div>
              <div>
                <Label>Oggetto *</Label>
                <Input value={form.oggetto} onChange={(e) => setForm({ ...form, oggetto: e.target.value })} />
              </div>
              <div>
                <Label>Corpo comunicazione</Label>
                <Textarea value={form.corpo} onChange={(e) => setForm({ ...form, corpo: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Scadenza risposta *</Label>
                  <Input
                    type="date"
                    value={form.data_scadenza_risposta}
                    onChange={(e) => setForm({ ...form, data_scadenza_risposta: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Data invio</Label>
                  <Input type="date" value={form.data_invio} onChange={(e) => setForm({ ...form, data_invio: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Canale</Label>
                  <Input value={form.canale} onChange={(e) => setForm({ ...form, canale: e.target.value })} placeholder="PEC, email, raccomandata…" />
                </div>
                {editing && (
                  <div>
                    <Label>Stato</Label>
                    <Select value={form.stato} onValueChange={(v) => setForm({ ...form, stato: v as PrescrizioneStato })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRESCRIZIONE_STATO_LABEL).map(([k, label]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div>
                <Label>Note</Label>
                <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {editing ? "Salva modifiche" : "Aggiungi prescrizione"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Destinatario</TableHead>
            <TableHead>Oggetto</TableHead>
            <TableHead>Scadenza</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Caricamento…</TableCell></TableRow>
          ) : prescrizioni.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nessuna prescrizione registrata</TableCell></TableRow>
          ) : (
            prescrizioni.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">
                  {DESTINATARIO_LABEL[p.destinatario_tipo]}
                  {p.destinatario_label ? <span className="text-muted-foreground block text-xs">{p.destinatario_label}</span> : null}
                </TableCell>
                <TableCell className="max-w-xs truncate" title={p.oggetto}>{p.oggetto}</TableCell>
                <TableCell>{format(new Date(p.data_scadenza_risposta), "dd/MM/yyyy")}</TableCell>
                <TableCell>
                  <Badge className={PRESCRIZIONE_STATO_CLASS[p.stato]}>{PRESCRIZIONE_STATO_LABEL[p.stato]}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {p.stato === "bozza" && !disabled && (
                      <Button size="sm" variant="outline" title="Segna inviata" onClick={() => updateStato(p.id, "inviata", oggi)}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {p.stato === "inviata" && !disabled && (
                      <Button size="sm" variant="outline" title="Risposta ricevuta" onClick={() => updateStato(p.id, "risposta_ricevuta")}>
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!disabled && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
