import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { AppendiceDialog } from "@/components/polizze/azioni/AppendiceDialog";
import { NuovaQuietanzaDettaglio } from "@/components/polizze/NuovaQuietanzaDettaglio";
import { anteprimaNuovaQuietanza, creaNuovaQuietanza, eliminaNuovaQuietanza, type DatiNuovaQuietanza } from "@/lib/copiaDatiQuietanzaDb";
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
  const [dati, setDati] = useState<DatiNuovaQuietanza | null>(null);
  const [erroreMadre, setErroreMadre] = useState("");
  // Secondo passo: quietanza creata, si completano garanzie e produttori
  const [nuovaId, setNuovaId] = useState<string | null>(null);

  // Scelta la polizza madre: proponi periodo e importi della rata successiva
  useEffect(() => {
    setDati(null);
    setErroreMadre("");
    if (tipo !== "quietanza" || !sceltaId) return;
    let attivo = true;
    anteprimaNuovaQuietanza(sceltaId)
      .then((d) => attivo && setDati(d))
      .catch((e) => attivo && setErroreMadre(e instanceof Error ? e.message : "Polizza non utilizzabile"));
    return () => {
      attivo = false;
    };
  }, [tipo, sceltaId]);

  const setCampo = (k: keyof DatiNuovaQuietanza, v: string) => setDati((d) => (d ? { ...d, [k]: v } : d));

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
    setNuovaId(null);
  };

  // Chiusura con X / Esc al secondo passo = Annulla: la quietanza appena creata viene eliminata
  const annullaDaChiusura = async () => {
    if (!nuovaId) return;
    try {
      await eliminaNuovaQuietanza(nuovaId);
      toast.info("Creazione annullata");
    } catch (e) {
      toast.error("Quietanza creata ma non annullata: eliminala dalla sua scheda", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["polizze_cliente", clienteId] });
    chiudi();
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
      if (!dati) return;
      setNuovaId(await creaNuovaQuietanza(sceltaId, dati));
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

      <Dialog open={!!tipo} onOpenChange={(o) => !o && !saving && (nuovaId ? annullaDaChiusura() : chiudi())}>
        <DialogContent className={nuovaId ? "max-w-5xl max-h-[90vh] overflow-y-auto" : "max-h-[90vh] overflow-y-auto"}>
          <DialogHeader>
            <DialogTitle>{tipo === "quietanza" ? "Nuova quietanza" : "Nuova appendice"}</DialogTitle>
            <DialogDescription>
              {nuovaId
                ? "Passo 2 di 2 · garanzie, accessori, tasse e produttori sono copiati dalla polizza madre: correggili se serve."
                : tipo === "quietanza"
                ? "Passo 1 di 2 · la quietanza è la rata successiva della polizza madre: periodo e date sono proposti dalla polizza."
                : "L'appendice va sempre collegata a una polizza o a una quietanza."}
            </DialogDescription>
          </DialogHeader>
          {nuovaId ? (
            <NuovaQuietanzaDettaglio
              quietanzaId={nuovaId}
              madreId={sceltaId}
              onSalvata={() => {
                queryClient.invalidateQueries({ queryKey: ["polizze_cliente", clienteId] });
                const id = nuovaId;
                chiudi();
                navigate(`/titoli/${id}`);
              }}
              onAnnullata={() => {
                queryClient.invalidateQueries({ queryKey: ["polizze_cliente", clienteId] });
                chiudi();
              }}
            />
          ) : (
          <>
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
          {tipo === "quietanza" && sceltaId && !dati && !erroreMadre && (
            <p className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calcolo della rata…
            </p>
          )}
          {erroreMadre && <p className="text-sm text-destructive">{erroreMadre}</p>}
          {tipo === "quietanza" && dati && (
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["garanzia_da", "Inizio garanzia"],
                  ["garanzia_a", "Fine garanzia"],
                  ["data_competenza", "Data competenza"],
                  ["data_scadenza", "Data scadenza"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="space-y-1.5">
                  <Label htmlFor={`nq-${k}`}>{label}</Label>
                  <Input id={`nq-${k}`} type="date" value={dati[k]} onChange={(e) => setCampo(k, e.target.value)} />
                </div>
              ))}
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="nq-note">Note</Label>
                <Textarea id="nq-note" rows={2} value={dati.note} onChange={(e) => setCampo("note", e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={chiudi} disabled={saving}>Annulla</Button>
            <Button onClick={conferma} disabled={!sceltaId || saving || (tipo === "quietanza" && !dati)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tipo === "quietanza" ? "Avanti: garanzie e produttori" : "Continua"}
            </Button>
          </DialogFooter>
          </>
          )}
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
