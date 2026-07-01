import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Bell } from "lucide-react";
import type { SinistroReminderRow } from "@/lib/sinistroPrescrizioniReminder";

interface Props {
  sinistroId: string;
  apertoDaUserId: string | null;
  currentUserId: string;
  disabled?: boolean;
}

export default function SinistroReminderPanel({ sinistroId, apertoDaUserId, currentUserId, disabled }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testo, setTesto] = useState("");
  const [dataPromemoria, setDataPromemoria] = useState("");
  const [saving, setSaving] = useState(false);

  const isCreator = apertoDaUserId === currentUserId;

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["sinistro-reminder", sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistro_reminder")
        .select("*")
        .eq("sinistro_id", sinistroId)
        .order("data_promemoria", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as SinistroReminderRow[];
    },
    enabled: isCreator,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sinistro-reminder", sinistroId] });

  if (!isCreator) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        I reminder personali sono visibili solo al creatore della pratica.
      </p>
    );
  }

  const handleAdd = async () => {
    if (!testo.trim()) {
      toast.error("Inserisci il testo del promemoria");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("sinistro_reminder").insert({
        sinistro_id: sinistroId,
        user_id: currentUserId,
        testo: testo.trim(),
        data_promemoria: dataPromemoria || null,
      });
      if (error) throw error;
      toast.success("Reminder aggiunto");
      setTesto("");
      setDataPromemoria("");
      setDialogOpen(false);
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const toggleCompletato = async (row: SinistroReminderRow) => {
    try {
      const { error } = await supabase
        .from("sinistro_reminder")
        .update({ completato: !row.completato })
        .eq("id", row.id);
      if (error) throw error;
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore aggiornamento");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Bell className="h-4 w-4" /> Promemoria personali visibili solo a te
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={disabled}>
              <Plus className="h-4 w-4 mr-1" /> Aggiungi reminder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo reminder personale</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Testo *</Label>
                <Textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={3} placeholder="Cosa ricordare…" />
              </div>
              <div>
                <Label>Data promemoria (opz.)</Label>
                <Input type="date" value={dataPromemoria} onChange={(e) => setDataPromemoria(e.target.value)} />
              </div>
              <Button onClick={handleAdd} disabled={saving} className="w-full">Salva reminder</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-6">Caricamento…</p>
      ) : reminders.length === 0 ? (
        <p className="text-center text-muted-foreground py-6">Nessun reminder personale</p>
      ) : (
        <div className="space-y-2">
          {reminders.map((r) => (
            <div
              key={r.id}
              className={`flex items-start gap-3 p-3 border rounded-lg ${r.completato ? "bg-muted/50 opacity-70" : ""}`}
            >
              <Checkbox
                checked={r.completato}
                onCheckedChange={() => toggleCompletato(r)}
                disabled={disabled}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${r.completato ? "line-through text-muted-foreground" : ""}`}>{r.testo}</p>
                {r.data_promemoria && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Promemoria: {format(new Date(r.data_promemoria), "dd/MM/yyyy")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
