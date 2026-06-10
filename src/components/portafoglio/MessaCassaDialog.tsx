import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, Wallet } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";
import { fmtEuro } from "@/lib/formatCurrency";

interface TitoloMin {
  id: string;
  numero_titolo?: string | null;
  premio_lordo?: number | null;
  cliente_anagrafica_id?: string | null;
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
  // Map anticipoId -> importoDaUsare
  const [anticipiSel, setAnticipiSel] = useState<Record<string, number>>({});

  // Single-cliente only: usa anticipi solo se tutti i titoli appartengono allo stesso cliente
  const clienteUnico = useMemo(() => {
    const ids = Array.from(new Set(titoli.map((t) => t.cliente_anagrafica_id).filter(Boolean)));
    return ids.length === 1 ? (ids[0] as string) : null;
  }, [titoli]);

  const { data: anticipi = [] } = useQuery({
    queryKey: ["cliente-anticipi-disponibili", clienteUnico],
    enabled: !!clienteUnico && open,
    queryFn: async () => {
      const { data, error } = await (supabase.from("cliente_anticipi") as any)
        .select("id, data_anticipo, importo, importo_residuo, conto:conti_bancari(etichetta)")
        .eq("cliente_id", clienteUnico)
        .gt("importo_residuo", 0)
        .order("data_anticipo", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    if (open) {
      const t = todayISO();
      setForm({ dataMessaCassa: t, dataPagamento: t, dataDecorrenza: t, tipoPagamento: "contanti", banca: "" });
      setAnticipiSel({});
    }
  }, [open]);

  const isMulti = titoli.length > 1;
  const totaleLordo = titoli.reduce((s, t) => s + (Number(t.premio_lordo) || 0), 0);
  const totaleAnticipiUsati = Object.values(anticipiSel).reduce((s, v) => s + (Number(v) || 0), 0);
  const daIncassare = Math.max(0, totaleLordo - totaleAnticipiUsati);
  const totalmenteCoperto = daIncassare === 0 && totaleAnticipiUsati > 0;

  // Toggle selezione anticipo: imposta default = min(residuo, residuoDaCoprire)
  const toggleAnticipo = (aId: string, residuo: number) => {
    setAnticipiSel((prev) => {
      if (prev[aId] !== undefined) {
        const { [aId]: _, ...rest } = prev;
        return rest;
      }
      const giaUsato = Object.values(prev).reduce((s, v) => s + v, 0);
      const daCoprire = Math.max(0, totaleLordo - giaUsato);
      return { ...prev, [aId]: Math.min(residuo, daCoprire) };
    });
  };

  const setImportoAnticipo = (aId: string, val: string, residuo: number) => {
    const n = Math.max(0, Math.min(residuo, Number(val.replace(",", ".")) || 0));
    setAnticipiSel((prev) => ({ ...prev, [aId]: n }));
  };

  const handleConferma = async () => {
    if (titoli.length === 0) return;
    if (daIncassare > 0 && form.tipoPagamento === "bonifico" && !form.banca) {
      toast.error("Seleziona la banca per il bonifico");
      return;
    }
    if (totaleAnticipiUsati > totaleLordo + 0.01) {
      toast.error("L'anticipo utilizzato eccede il premio lordo");
      return;
    }
    setLoading(true);

    // Per multi-titolo: distribuisci l'anticipo proporzionalmente (FIFO sui titoli in ordine).
    // Calcoliamo per ogni titolo quanto anticipo "logico" lo copre.
    const anticipiOrdered = Object.entries(anticipiSel).filter(([, v]) => v > 0).map(([id, v]) => ({ id, residuo: v }));

    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp.user?.id ?? null;

    let ok = 0, ko = 0;

    for (const t of titoli) {
      const lordo = Number(t.premio_lordo) || 0;
      let daCoprireT = lordo;
      const utilizziPerTitolo: Array<{ anticipo_id: string; importo_utilizzato: number }> = [];

      for (const a of anticipiOrdered) {
        if (daCoprireT <= 0 || a.residuo <= 0) continue;
        const usato = Math.min(daCoprireT, a.residuo);
        if (usato > 0) {
          utilizziPerTitolo.push({ anticipo_id: a.id, importo_utilizzato: Number(usato.toFixed(2)) });
          a.residuo -= usato;
          daCoprireT -= usato;
        }
      }

      const usatoTitolo = utilizziPerTitolo.reduce((s, u) => s + u.importo_utilizzato, 0);
      const residuoCash = lordo - usatoTitolo;
      const tipoPag = usatoTitolo > 0 ? (residuoCash > 0 ? "anticipo_misto" : "anticipo") : form.tipoPagamento;

      let bancaLabel: string | null = null;
      if (residuoCash > 0 && form.tipoPagamento === "bonifico" && form.banca) {
        const { data: conto } = await (supabase.from("conti_bancari") as any)
          .select("etichetta, banca, iban").eq("id", form.banca).maybeSingle();
        bancaLabel = conto?.etichetta || conto?.banca || form.banca;
      }

      const payload: any = {
        stato: "incassato",
        data_messa_cassa: form.dataMessaCassa,
        data_pagamento: form.dataPagamento,
        data_decorrenza_rinnovo: form.dataDecorrenza,
        data_incasso: form.dataMessaCassa,
        tipo_pagamento: tipoPag,
        importo_incassato: lordo,
        updated_at: new Date().toISOString(),
      };
      if (bancaLabel) payload.banca_pagamento = bancaLabel;

      const { error } = await (supabase.from("titoli") as any).update(payload).eq("id", t.id);
      if (error) { ko++; continue; }

      // Insert utilizzi anticipi
      if (utilizziPerTitolo.length > 0) {
        const rows = utilizziPerTitolo.map((u) => ({
          ...u,
          titolo_id: t.id,
          data_utilizzo: form.dataMessaCassa,
          creato_da: userId,
        }));
        const { error: errU } = await (supabase.from("cliente_anticipi_utilizzi") as any).insert(rows);
        if (errU) {
          toast.error(`Errore registrazione anticipi su ${t.numero_titolo ?? t.id}: ${errU.message}`);
        }
      }

      ok++;
      await logAttivita({
        azione: "messa_a_cassa",
        entita_tipo: "titolo",
        entita_id: t.id,
        dettagli_json: {
          data_messa_cassa: form.dataMessaCassa,
          tipo_pagamento: tipoPag,
          anticipi_usati: utilizziPerTitolo,
          residuo_cash: residuoCash,
          bulk: isMulti,
        },
      });
      supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: t.id } }).catch(() => {});
      supabase.functions.invoke("notifica-messa-cassa-agenzia", { body: { titolo_id: t.id } })
        .then((res: any) => { if (res?.error) toast.warning(`Notifica non inviata (${t.numero_titolo ?? t.id})`); })
        .catch(() => {});
    }

    setLoading(false);
    if (ok > 0) {
      toast.success(isMulti ? `${ok} polizze incassate${ko > 0 ? `, ${ko} errori` : ""}` : "Polizza incassata");
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["cliente-anticipi"] });
      queryClient.invalidateQueries({ queryKey: ["cliente-anticipi-disponibili"] });
      onSuccess?.();
      onOpenChange(false);
    } else {
      toast.error("Operazione fallita");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conferma Messa a Cassa</DialogTitle>
          <DialogDescription>
            {isMulti ? (
              <>Incasso multiplo: <strong>{titoli.length} polizze</strong> — totale lordo {fmtEuro(totaleLordo)}</>
            ) : (
              <>Polizza {titoli[0]?.numero_titolo || titoli[0]?.id?.slice(0, 8) || ""} — Lordo {fmtEuro(totaleLordo)}</>
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

          {clienteUnico && anticipi.length > 0 && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Wallet className="w-4 h-4" /> Anticipi disponibili del cliente
              </div>
              {anticipi.map((a) => {
                const selected = anticipiSel[a.id] !== undefined;
                return (
                  <div key={a.id} className="flex items-center gap-2 bg-background/60 rounded px-2 py-1.5">
                    <Checkbox checked={selected} onCheckedChange={() => toggleAnticipo(a.id, Number(a.importo_residuo))} />
                    <div className="flex-1 text-xs">
                      <div className="font-medium">{new Date(a.data_anticipo).toLocaleDateString("it-IT")} — {a.conto?.etichetta || "n/d"}</div>
                      <div className="text-muted-foreground">Residuo: {fmtEuro(Number(a.importo_residuo))}</div>
                    </div>
                    {selected && (
                      <Input
                        type="number" step="0.01" min="0" max={Number(a.importo_residuo)}
                        value={anticipiSel[a.id]}
                        onChange={(e) => setImportoAnticipo(a.id, e.target.value, Number(a.importo_residuo))}
                        className="w-24 h-8 text-xs"
                      />
                    )}
                  </div>
                );
              })}
              <div className="border-t border-primary/20 pt-2 text-xs space-y-0.5">
                <div className="flex justify-between"><span>Premio lordo:</span><span>{fmtEuro(totaleLordo)}</span></div>
                <div className="flex justify-between text-primary"><span>Anticipo utilizzato:</span><span>− {fmtEuro(totaleAnticipiUsati)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-1"><span>Da incassare ora:</span><span>{fmtEuro(daIncassare)}</span></div>
                {totalmenteCoperto && (
                  <div className="text-green-700 dark:text-green-400 font-medium text-center pt-1">✅ Coperto interamente da anticipo</div>
                )}
              </div>
            </div>
          )}

          {daIncassare > 0 && (
            <>
              <div>
                <Label className="text-xs">Tipo Pagamento {totaleAnticipiUsati > 0 && <span className="text-muted-foreground">(parte residua)</span>}</Label>
                <Select value={form.tipoPagamento} onValueChange={(v) => setForm(f => ({ ...f, tipoPagamento: v, banca: "" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contanti">Contanti</SelectItem>
                    <SelectItem value="pos">POS</SelectItem>
                    <SelectItem value="bonifico">Bonifico</SelectItem>
                    <SelectItem value="assegno">Assegno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.tipoPagamento === "bonifico" && (
                <div>
                  <Label className="text-xs">Conto Consulbrokers</Label>
                  <ContoBancarioSelect
                    tipi={["generico"]}
                    value={form.banca || null}
                    onChange={(id) => setForm(f => ({ ...f, banca: id || "" }))}
                    placeholder="Cerca conto..."
                    showPreview
                    className="mt-1"
                  />
                </div>
              )}
            </>
          )}

          {isMulti && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              L'importo incassato di ogni polizza sarà impostato automaticamente al rispettivo premio lordo.
              {Object.keys(anticipiSel).length > 0 && " Gli anticipi vengono distribuiti FIFO sulle polizze in ordine."}
            </div>
          )}

          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">
              ⚠️ Operazione irreversibile senza privilegi admin.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annulla</Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={loading || (daIncassare > 0 && form.tipoPagamento === "bonifico" && !form.banca)}
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
