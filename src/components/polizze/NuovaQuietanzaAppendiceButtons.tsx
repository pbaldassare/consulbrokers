import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { AppendiceDialog } from "@/components/polizze/azioni/AppendiceDialog";
import { creaNuovaQuietanza } from "@/lib/copiaDatiQuietanzaDb";
import { isAppendice, type TitoloLike } from "@/lib/quietanze";

type TitoloCliente = TitoloLike & {
  id: string;
  numero_titolo?: string | null;
  stato?: string | null;
  riga?: number | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
};

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("it-IT") : "—");
const chiuso = (t: TitoloCliente) => ["annullato", "stornato"].includes(String(t.stato || "").toLowerCase());

/** Quietanze e appendici nascono sempre da una polizza (o quietanza) del cliente: la scelta è obbligatoria. */
export function NuovaQuietanzaAppendiceButtons({ clienteId, titoli }: { clienteId: string; titoli: TitoloCliente[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<"quietanza" | "appendice" | null>(null);
  const [sceltaId, setSceltaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [appendiceSu, setAppendiceSu] = useState<TitoloCliente | null>(null);

  const attivi = titoli.filter((t) => !isAppendice(t) && !chiuso(t));
  const opzioni = (tipo === "quietanza" ? attivi.filter((t) => !t.sostituisce_polizza) : attivi).map((t) => ({
    value: t.id,
    label: t.sostituisce_polizza
      ? `${t.numero_titolo} · quietanza ${fmtDate(t.garanzia_da)} → ${fmtDate(t.garanzia_a)}`
      : `${t.numero_titolo} · polizza`,
  }));

  const chiudi = () => {
    setTipo(null);
    setSceltaId("");
  };

  const conferma = async () => {
    if (!sceltaId) return;
    if (tipo === "appendice") {
      setAppendiceSu(titoli.find((t) => t.id === sceltaId) ?? null);
      chiudi();
      return;
    }
    setSaving(true);
    try {
      const nuovaId = await creaNuovaQuietanza(sceltaId);
      await queryClient.invalidateQueries({ queryKey: ["polizze_cliente", clienteId] });
      toast.success("Quietanza creata: completa i dati nella scheda");
      chiudi();
      navigate(`/titoli/${nuovaId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore nella creazione della quietanza");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setTipo("quietanza")}>
        <Plus className="h-4 w-4" /> Nuova Quietanza
      </Button>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setTipo("appendice")}>
        <FilePlus2 className="h-4 w-4" /> Nuova Appendice
      </Button>

      <Dialog open={!!tipo} onOpenChange={(o) => !o && !saving && chiudi()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tipo === "quietanza" ? "Nuova quietanza" : "Nuova appendice"}</DialogTitle>
            <DialogDescription>
              {tipo === "quietanza"
                ? "La quietanza è la rata successiva della polizza madre: ne riprende dati e premi, poi la completi nella scheda."
                : "L'appendice va sempre collegata a una polizza o a una quietanza."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>
              {tipo === "quietanza" ? "Polizza madre" : "Polizza o quietanza"} <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              value={sceltaId}
              onValueChange={(v) => setSceltaId(v || "")}
              options={opzioni}
              placeholder={opzioni.length ? "— Seleziona —" : "Nessuna polizza attiva per questo cliente"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={chiudi} disabled={saving}>Annulla</Button>
            <Button onClick={conferma} disabled={!sceltaId || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tipo === "quietanza" ? "Crea quietanza" : "Continua"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppendiceDialog
        open={!!appendiceSu}
        onOpenChange={(o) => !o && setAppendiceSu(null)}
        titoloId={appendiceSu?.id ?? null}
        numeroTitolo={appendiceSu?.numero_titolo}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["polizze_cliente", clienteId] });
          setAppendiceSu(null);
        }}
      />
    </>
  );
}
