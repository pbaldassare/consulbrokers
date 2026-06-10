import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";
import { useCreaAnticipo } from "@/hooks/useAnticipiCliente";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useClientiSearch } from "@/hooks/useAnticipiGlobale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Se passato, il cliente è bloccato. Altrimenti viene mostrato selettore. */
  clienteId?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function NuovoAnticipoDialog({ open, onOpenChange, clienteId }: Props) {
  const qc = useQueryClient();
  const fixedCliente = !!clienteId;
  const creaFixed = useCreaAnticipo(clienteId || "__none__");

  // Variante globale (cliente selezionabile)
  const creaGlobal = useMutation({
    mutationFn: async (input: { cliente_id: string; data_anticipo: string; conto_bancario_id: string | null; importo: number; note: string | null }) => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await (supabase.from("cliente_anticipi") as any)
        .insert({
          cliente_id: input.cliente_id,
          data_anticipo: input.data_anticipo,
          conto_bancario_id: input.conto_bancario_id,
          importo: input.importo,
          note: input.note,
          creato_da: user.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await logAttivita({
        azione: "anticipo_creato",
        entita_tipo: "cliente",
        entita_id: input.cliente_id,
        dettagli_json: { anticipo_id: data.id, importo: input.importo, data: input.data_anticipo },
      });
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["cliente-anticipi", vars.cliente_id] });
      qc.invalidateQueries({ queryKey: ["cliente-anticipi-disponibili", vars.cliente_id] });
      qc.invalidateQueries({ queryKey: ["anticipi-globale"] });
      qc.invalidateQueries({ queryKey: ["anticipi-residuo-by-clienti"] });
      toast.success("Anticipo creato");
    },
    onError: (e: any) => toast.error(e?.message || "Errore creazione anticipo"),
  });

  const [data, setData] = useState(todayISO());
  const [conto, setConto] = useState<string | null>(null);
  const [importo, setImporto] = useState<string>("");
  const [note, setNote] = useState("");
  const [clienteSel, setClienteSel] = useState<string>("");
  const [clienteSearch, setClienteSearch] = useState("");
  const { data: clientiOpts = [] } = useClientiSearch(clienteSearch);

  useEffect(() => {
    if (open) {
      setData(todayISO());
      setConto(null);
      setImporto("");
      setNote("");
      setClienteSel("");
      setClienteSearch("");
    }
  }, [open]);

  const importoN = Number(importo.replace(",", "."));
  const canSubmit = !!data && !!conto && importoN > 0 && (fixedCliente || !!clienteSel);
  const isPending = fixedCliente ? creaFixed.isPending : creaGlobal.isPending;

  const handleSave = async () => {
    if (!canSubmit) return;
    if (fixedCliente) {
      await creaFixed.mutateAsync({
        data_anticipo: data,
        conto_bancario_id: conto,
        importo: importoN,
        note: note || null,
      });
    } else {
      await creaGlobal.mutateAsync({
        cliente_id: clienteSel,
        data_anticipo: data,
        conto_bancario_id: conto,
        importo: importoN,
        note: note || null,
      });
    }
    onOpenChange(false);
  };

  const labelCliente = (c: any) =>
    c.tipo_cliente === "azienda" || c.tipo_cliente === "ente"
      ? c.ragione_sociale || "—"
      : `${c.cognome || ""} ${c.nome || ""}`.trim() || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuovo Anticipo Cliente</DialogTitle>
          <DialogDescription>Registra un versamento del cliente da utilizzare nelle messe a cassa future.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!fixedCliente && (
            <div>
              <Label className="text-xs">Cliente</Label>
              <SearchableSelect
                className="mt-1"
                value={clienteSel}
                onValueChange={setClienteSel}
                searchValue={clienteSearch}
                onSearchChange={setClienteSearch}
                searchPlaceholder="Cerca per nome, ragione sociale, CF, P.IVA…"
                placeholder="Seleziona cliente…"
                emptyText={clienteSearch.length < 2 ? "Digita almeno 2 caratteri" : "Nessun cliente"}
                options={clientiOpts.map((c: any) => ({
                  value: c.id,
                  label: labelCliente(c),
                  description: c.codice_fiscale || c.partita_iva || undefined,
                }))}
              />
            </div>
          )}
          <div>
            <Label className="text-xs">Data Versamento</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Conto Consulbrokers</Label>
            <ContoBancarioSelect
              value={conto}
              onChange={setConto}
              tipi={["incasso_clienti", "generico"]}
              placeholder="Seleziona conto..."
              className="mt-1"
              showPreview
            />
          </div>
          <div>
            <Label className="text-xs">Importo (€)</Label>
            <Input type="number" step="0.01" min="0" value={importo} onChange={(e) => setImporto(e.target.value)} className="mt-1" placeholder="0,00" />
          </div>
          <div>
            <Label className="text-xs">Note (opzionale)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Annulla</Button>
          <Button onClick={handleSave} disabled={!canSubmit || isPending}>
            {isPending ? "Salvataggio..." : "Salva Anticipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
