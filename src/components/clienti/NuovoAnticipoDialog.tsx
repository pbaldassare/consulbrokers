import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";
import { useCreaAnticipo } from "@/hooks/useAnticipiCliente";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clienteId: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function NuovoAnticipoDialog({ open, onOpenChange, clienteId }: Props) {
  const crea = useCreaAnticipo(clienteId);
  const [data, setData] = useState(todayISO());
  const [conto, setConto] = useState<string | null>(null);
  const [importo, setImporto] = useState<string>("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setData(todayISO());
      setConto(null);
      setImporto("");
      setNote("");
    }
  }, [open]);

  const importoN = Number(importo.replace(",", "."));
  const canSubmit = !!data && !!conto && importoN > 0;

  const handleSave = async () => {
    if (!canSubmit) return;
    await crea.mutateAsync({
      data_anticipo: data,
      conto_bancario_id: conto,
      importo: importoN,
      note: note || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuovo Anticipo Cliente</DialogTitle>
          <DialogDescription>Registra un versamento del cliente da utilizzare nelle messe a cassa future.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
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
            <Input
              type="number"
              step="0.01"
              min="0"
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              className="mt-1"
              placeholder="0,00"
            />
          </div>
          <div>
            <Label className="text-xs">Note (opzionale)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={crea.isPending}>Annulla</Button>
          <Button onClick={handleSave} disabled={!canSubmit || crea.isPending}>
            {crea.isPending ? "Salvataggio..." : "Salva Anticipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
