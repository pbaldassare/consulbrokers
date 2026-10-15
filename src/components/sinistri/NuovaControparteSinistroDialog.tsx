import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export type ControparteSinistroRow = {
  id: string;
  codice: number;
  denominazione: string;
  codice_fiscale: string | null;
  partita_iva: string | null;
  email: string | null;
  telefono: string | null;
  note: string | null;
  attivo: boolean;
};

type Props = {
  trigger: React.ReactNode;
  existing?: ControparteSinistroRow | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: (row: ControparteSinistroRow) => void;
};

const emptyForm = () => ({
  denominazione: "",
  codice_fiscale: "",
  partita_iva: "",
  email: "",
  telefono: "",
  note: "",
});

export function NuovaControparteSinistroDialog({
  trigger,
  existing,
  open: controlledOpen,
  onOpenChange,
  onSaved,
}: Props) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const isEdit = Boolean(existing?.id);

  const [form, setForm] = useState(emptyForm);

  const resetForOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      if (existing) {
        setForm({
          denominazione: existing.denominazione || "",
          codice_fiscale: existing.codice_fiscale || "",
          partita_iva: existing.partita_iva || "",
          email: existing.email || "",
          telefono: existing.telefono || "",
          note: existing.note || "",
        });
      } else {
        setForm(emptyForm());
      }
    }
    setOpen(nextOpen);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const denominazione = form.denominazione.trim();
      if (!denominazione) throw new Error("Inserire la denominazione");

      const payload = {
        denominazione,
        codice_fiscale: form.codice_fiscale.trim() || null,
        partita_iva: form.partita_iva.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        note: form.note.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit && existing) {
        const { data, error } = await supabase
          .from("controparti_sinistri")
          .update(payload)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        return data as ControparteSinistroRow;
      }

      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("controparti_sinistri")
        .insert({ ...payload, created_by: userData.user?.id ?? null })
        .select("*")
        .single();
      if (error) throw error;
      return data as ControparteSinistroRow;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["controparti-sinistri"] });
      toast.success(isEdit ? "Controparte aggiornata" : "Controparte creata");
      resetForOpen(false);
      onSaved?.(row);
    },
    onError: (err: Error) => {
      const msg = err.message.includes("controparti_sinistri_denominazione_norm")
        ? "Esiste già una controparte con la stessa denominazione"
        : err.message;
      toast.error(msg);
    },
  });

  const dialogBody = (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Modifica controparte" : "Nuova controparte sinistro"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="denominazione">Denominazione *</Label>
          <Input
            id="denominazione"
            value={form.denominazione}
            onChange={(e) => setForm((f) => ({ ...f, denominazione: e.target.value }))}
            placeholder="Nome controparte o veicolo coinvolto"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cf">Codice fiscale</Label>
            <Input
              id="cf"
              value={form.codice_fiscale}
              onChange={(e) => setForm((f) => ({ ...f, codice_fiscale: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="piva">P. IVA</Label>
            <Input
              id="piva"
              value={form.partita_iva}
              onChange={(e) => setForm((f) => ({ ...f, partita_iva: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefono">Telefono</Label>
            <Input
              id="telefono"
              value={form.telefono}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Textarea
            id="note"
            rows={2}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => resetForOpen(false)}>
          Annulla
        </Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Salvataggio..." : "Salva"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  if (controlledOpen !== undefined) {
    return (
      <Dialog open={open} onOpenChange={resetForOpen}>
        {dialogBody}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={resetForOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {dialogBody}
    </Dialog>
  );
}
