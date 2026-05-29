import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";

const bancheItaliane = [
  "Intesa Sanpaolo", "UniCredit", "BNL - BNP Paribas", "BPER Banca", "Banco BPM",
  "Monte dei Paschi di Siena", "Crédit Agricole Italia", "Poste Italiane",
  "Banca Mediolanum", "Banca Sella", "Fineco Bank", "CheBanca!", "ING Italia",
  "Deutsche Bank Italia", "Banca Popolare di Sondrio", "Altro",
];

interface TitoloMin {
  id: string;
  numero_titolo?: string | null;
  premio_lordo?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoli: TitoloMin[];
  onSuccess?: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export const MessaCassaDialog = ({ open, onOpenChange, titoli, onSuccess }: Props) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    dataMessaCassa: todayISO(),
    dataPagamento: todayISO(),
    dataDecorrenza: todayISO(),
    tipoPagamento: "contanti",
    banca: "",
  });

  useEffect(() => {
    if (open) {
      const t = todayISO();
      setForm({ dataMessaCassa: t, dataPagamento: t, dataDecorrenza: t, tipoPagamento: "contanti", banca: "" });
    }
  }, [open]);

  const isMulti = titoli.length > 1;
  const totaleLordo = titoli.reduce((s, t) => s + (Number(t.premio_lordo) || 0), 0);

  const handleConferma = async () => {
    if (titoli.length === 0) return;
    if (form.tipoPagamento === "bonifico" && !form.banca) {
      toast.error("Seleziona la banca per il bonifico");
      return;
    }
    setLoading(true);
    let ok = 0, ko = 0;
    for (const t of titoli) {
      const payload: any = {
        stato: "incassato",
        data_messa_cassa: form.dataMessaCassa,
        data_pagamento: form.dataPagamento,
        data_decorrenza_rinnovo: form.dataDecorrenza,
        data_incasso: form.dataMessaCassa,
        tipo_pagamento: form.tipoPagamento,
        importo_incassato: t.premio_lordo ?? null,
        updated_at: new Date().toISOString(),
      };
      if (form.tipoPagamento === "bonifico" && form.banca) {
        payload.banca_pagamento = form.banca;
      }
      const { error } = await (supabase.from("titoli") as any).update(payload).eq("id", t.id);
      if (error) {
        ko++;
      } else {
        ok++;
        await logAttivita({
          azione: "messa_a_cassa",
          entita_tipo: "titolo",
          entita_id: t.id,
          dettagli_json: {
            data_messa_cassa: form.dataMessaCassa,
            data_pagamento: form.dataPagamento,
            data_decorrenza_rinnovo: form.dataDecorrenza,
            tipo_pagamento: form.tipoPagamento,
            banca: form.banca || null,
            bulk: isMulti,
          },
        });
        supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: t.id } }).catch(() => {});
        supabase.functions.invoke("notifica-messa-cassa-agenzia", { body: { titolo_id: t.id } })
          .then((res: any) => {
            if (res?.error) toast.warning(`Notifica non inviata (${t.numero_titolo ?? t.id}): ${res.error.message ?? res.error}`);
          })
          .catch((e) => toast.warning(`Notifica fallita (${t.numero_titolo ?? t.id}): ${e?.message ?? e}`));
      }
    }
    setLoading(false);
    if (ok > 0) {
      toast.success(isMulti ? `${ok} polizze incassate${ko > 0 ? `, ${ko} errori` : ""}` : "Polizza incassata");
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      onSuccess?.();
      onOpenChange(false);
    } else {
      toast.error("Operazione fallita");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conferma Messa a Cassa</DialogTitle>
          <DialogDescription>
            {isMulti ? (
              <>Incasso multiplo: <strong>{titoli.length} polizze</strong> — totale lordo € {totaleLordo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</>
            ) : (
              <>Polizza {titoli[0]?.numero_titolo || titoli[0]?.id?.slice(0, 8) || ""}</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Data Messa a Cassa</Label>
              <Input type="date" value={form.dataMessaCassa} onChange={(e) => setForm(f => ({ ...f, dataMessaCassa: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Data Pagamento</Label>
              <Input type="date" value={form.dataPagamento} onChange={(e) => setForm(f => ({ ...f, dataPagamento: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Data Decorrenza Rinnovo</Label>
              <Input type="date" value={form.dataDecorrenza} onChange={(e) => setForm(f => ({ ...f, dataDecorrenza: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Tipo Pagamento</Label>
            <Select value={form.tipoPagamento} onValueChange={(v) => setForm(f => ({ ...f, tipoPagamento: v, banca: "" }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contanti">Contanti</SelectItem>
                <SelectItem value="pos">POS</SelectItem>
                <SelectItem value="bonifico">Bonifico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.tipoPagamento === "bonifico" && (
            <div>
              <Label className="text-xs">Banca</Label>
              <Select value={form.banca} onValueChange={(v) => setForm(f => ({ ...f, banca: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleziona banca..." /></SelectTrigger>
                <SelectContent>
                  {bancheItaliane.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {isMulti && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              L'importo incassato di ogni polizza sarà impostato automaticamente al rispettivo premio lordo.
            </div>
          )}
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">
              ⚠️ Attenzione: questa operazione è irreversibile. Una volta confermata, non sarà possibile annullare l'incasso senza privilegi admin.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annulla</Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={loading || (form.tipoPagamento === "bonifico" && !form.banca)}
            onClick={handleConferma}
          >
            <CheckSquare className="w-4 h-4 mr-1" />
            {loading ? "In corso..." : isMulti ? `Conferma Incasso (${titoli.length})` : "Conferma Incasso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MessaCassaDialog;
