import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string;
  numeroPolizza?: string;
  onDone?: () => void;
}

const addMonthsISO = (iso: string, months: number) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

export const SospensionePolizzaDialog = ({ open, onOpenChange, titoloId, numeroPolizza, onDone }: Props) => {
  const queryClient = useQueryClient();
  const todayISO = new Date().toISOString().slice(0, 10);

  const [dataSospensione, setDataSospensione] = useState(todayISO);
  const [limiteRiattivazione, setLimiteRiattivazione] = useState(addMonthsISO(todayISO, 3));
  const [limiteManual, setLimiteManual] = useState(false);
  const [motivo, setMotivo] = useState("Sospensione su richiesta cliente");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDataSospensione(todayISO);
      setLimiteRiattivazione(addMonthsISO(todayISO, 3));
      setLimiteManual(false);
      setMotivo("Sospensione su richiesta cliente");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!limiteManual && dataSospensione) {
      setLimiteRiattivazione(addMonthsISO(dataSospensione, 3));
    }
  }, [dataSospensione, limiteManual]);

  const sospensioneMutation = useMutation({
    mutationFn: async () => {
      if (!dataSospensione) throw new Error("Data sospensione obbligatoria");
      if (!titoloId) throw new Error("Specificare una polizza");

      const { data: titoloRow, error: errFetch } = await supabase
        .from("titoli")
        .select("id, numero_titolo, riga")
        .eq("id", titoloId)
        .single();
      if (errFetch) throw errFetch;

      let quietanzeEliminate: string[] = [];
      if (titoloRow?.numero_titolo && titoloRow.riga != null) {
        const { data: future } = await supabase
          .from("titoli")
          .select("id, riga")
          .eq("numero_titolo", titoloRow.numero_titolo)
          .gt("riga", titoloRow.riga)
          .neq("stato", "incassato")
          .is("data_messa_cassa", null);
        const ids = (future || []).map((r: any) => r.id);
        if (ids.length > 0) {
          await supabase.from("movimenti_polizza").delete().in("titolo_id", ids);
          await supabase.from("premi_garanzia_polizza").delete().in("titolo_id", ids);
          const { error: errDel } = await supabase.from("titoli").delete().in("id", ids);
          if (errDel) throw errDel;
          quietanzeEliminate = ids;
        }
      }

      const { error: errUp } = await supabase
        .from("titoli")
        .update({
          stato: "sospeso",
          data_sospensione: dataSospensione,
          limite_riattivazione: limiteRiattivazione || null,
          motivo_sospensione: motivo || null,
        } as any)
        .eq("id", titoloId);
      if (errUp) throw errUp;

      await supabase.from("movimenti_polizza").insert({
        titolo_id: titoloId,
        tipo_documento: "SO",
        data_movimento: dataSospensione,
        descrizione: `Sospensione polizza${motivo ? ": " + motivo : ""}`,
        stato: "sospeso",
      } as any);

      await logAttivita({
        azione: "sospensione_polizza",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: {
          data_sospensione: dataSospensione,
          limite_riattivazione: limiteRiattivazione,
          motivo,
          quietanze_eliminate: quietanzeEliminate,
        },
      });

      return { quietanzeEliminate };
    },
    onSuccess: ({ quietanzeEliminate }) => {
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-attive"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-storico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      const msg = quietanzeEliminate.length > 0
        ? `Polizza sospesa. ${quietanzeEliminate.length} quietanze future rimosse.`
        : "Polizza sospesa con successo";
      toast.success(msg);
      onOpenChange(false);
      onDone?.();
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore durante la sospensione");
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sospensione Polizza</DialogTitle>
            <DialogDescription>
              {numeroPolizza ? `Polizza ${numeroPolizza}` : "Sospendi la polizza corrente"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data-sosp-dlg">Data Sospensione *</Label>
                <Input id="data-sosp-dlg" type="date" value={dataSospensione} onChange={(e) => setDataSospensione(e.target.value)} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="limite-riatt-dlg">Limite Riattivazione</Label>
                <Input id="limite-riatt-dlg" type="date" value={limiteRiattivazione} onChange={(e) => { setLimiteRiattivazione(e.target.value); setLimiteManual(true); }} className="tabular-nums" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motivo-sosp-dlg">Motivo</Label>
              <Textarea id="motivo-sosp-dlg" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo della sospensione (opzionale)" rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={sospensioneMutation.isPending}>Annulla</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={sospensioneMutation.isPending || !dataSospensione}>
              {sospensioneMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma sospensione polizza</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>Stai per sospendere la polizza <strong>{numeroPolizza || "—"}</strong>.</div>
                <div>Data sospensione: <strong>{dataSospensione || "—"}</strong></div>
                <div>Limite riattivazione: <strong>{limiteRiattivazione || "—"}</strong></div>
                <div className="text-destructive">Attenzione: tutte le quietanze future non incassate verranno eliminate.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmOpen(false); sospensioneMutation.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Conferma sospensione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SospensionePolizzaDialog;
