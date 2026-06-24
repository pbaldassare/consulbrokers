import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Pause, Play, Replace, XCircle, Undo2, FilePlus2, ScrollText,
  FileText, Ban, Banknote, RotateCcw, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fmtEuro } from "@/lib/formatCurrency";
import { annullaPolizza } from "@/lib/annullaPolizza";
import { annullaMessaACassa } from "@/lib/annullaMessaACassa";
import { SospensionePolizzaDialog } from "@/components/polizze/SospensionePolizzaDialog";
import { RiattivazionePolizzaDialog } from "@/components/polizze/RiattivazionePolizzaDialog";
import { SostituzionePolizzaDialog } from "@/components/polizze/SostituzionePolizzaDialog";
import { EstinzionePolizzaDialog } from "@/components/polizze/EstinzionePolizzaDialog";
import { StornoTitoloDialog } from "@/components/polizze/StornoTitoloDialog";
import MessaCassaDialog from "@/components/portafoglio/MessaCassaDialog";

const fmtDate = (d: string | null | undefined) =>
  d ? format(new Date(d), "dd/MM/yyyy") : "—";

const STATO_Q: Record<string, string> = {
  da_incassare: "bg-amber-100 text-amber-800 border-amber-300",
  incassato: "bg-emerald-100 text-emerald-800 border-emerald-300",
  sospesa: "bg-yellow-100 text-yellow-800 border-yellow-300",
  annullata: "bg-red-100 text-red-800 border-red-300",
  stornata: "bg-orange-100 text-orange-800 border-orange-300",
};

export type ToolbarQuietanza = {
  id: string;
  numero_rata: number | null;
  numero_rate_totali: number | null;
  garanzia_da: string | null;
  garanzia_a: string | null;
  data_scadenza: string | null;
  premio_lordo: number | null;
  stato: string;
  data_messa_cassa: string | null;
  titolo_id: string | null;
};

type RataAction = "storno" | "messa_cassa" | "annulla_mc" | "annulla_incasso";

interface Props {
  polizzaId: string;
  numeroPolizza: string;
  statoPolizza: string;
  titoloMadreId: string | null;
  clienteId: string | null;
  uffizioId?: string | null;
  regolazione?: boolean;
  quietanze: ToolbarQuietanza[];
  /** Se valorizzato, le azioni rata-level agiscono direttamente su questa rata */
  currentQuietanza?: ToolbarQuietanza | null;
  onRefresh: () => void;
}

export function AzioniPolizzaToolbar({
  polizzaId,
  numeroPolizza,
  statoPolizza,
  titoloMadreId,
  clienteId,
  uffizioId,
  regolazione,
  quietanze,
  currentQuietanza,
  onRefresh,
}: Props) {
  const navigate = useNavigate();
  const locked = ["annullata", "estinta", "sostituita"].includes(statoPolizza);

  // polizza-level dialogs
  const [sospensioneOpen, setSospensioneOpen] = useState(false);
  const [riattivazioneOpen, setRiattivazioneOpen] = useState(false);
  const [sostituzioneOpen, setSostituzioneOpen] = useState(false);
  const [estinzioneOpen, setEstinzioneOpen] = useState(false);
  const [annullaLoading, setAnnullaLoading] = useState(false);

  // rata-level
  const [stornoOpen, setStornoOpen] = useState(false);
  const [stornoTitoloId, setStornoTitoloId] = useState<string | null>(null);
  const [cassaOpen, setCassaOpen] = useState(false);
  const [cassaTitoli, setCassaTitoli] = useState<any[]>([]);
  const [annullaMcLoading, setAnnullaMcLoading] = useState(false);

  // selector dialog
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<RataAction | null>(null);

  async function handleAnnullaPolizza() {
    if (!titoloMadreId) {
      toast.error("Polizza senza titolo collegato: impossibile annullare.");
      return;
    }
    setAnnullaLoading(true);
    const res = await annullaPolizza(titoloMadreId);
    setAnnullaLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Errore durante l'annullamento");
      return;
    }
    toast.success(`Polizza annullata · ${res.quietanzeEliminate ?? 0} quietanze rimosse`);
    onRefresh();
  }

  async function runAnnullaMc(titoloId: string) {
    setAnnullaMcLoading(true);
    const res = await annullaMessaACassa(titoloId);
    setAnnullaMcLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Errore annullamento messa a cassa");
      return;
    }
    const extra = res.rataSuccessivaEliminata ? " · rata successiva rimossa" : "";
    toast.success(`Messa a cassa annullata · ${res.provvigioniEliminate ?? 0} provvigioni rimosse${extra}`);
    onRefresh();
  }

  async function runAnnullaIncasso(titoloId: string) {
    setAnnullaMcLoading(true);
    const res = await annullaMessaACassa(titoloId);
    setAnnullaMcLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Errore annullamento incasso");
      return;
    }
    const extra = res.rataSuccessivaEliminata ? " · rata successiva rimossa" : "";
    toast.success(`Incasso annullato · ${res.provvigioniEliminate ?? 0} provv., ${res.movimentiEliminati ?? 0} mov.${extra}`);
    onRefresh();
  }

  function startRataAction(action: RataAction) {
    if (currentQuietanza) {
      executeRataAction(action, currentQuietanza);
    } else {
      setPendingAction(action);
      setSelectorOpen(true);
    }
  }

  function executeRataAction(action: RataAction, q: ToolbarQuietanza) {
    if (!q.titolo_id) {
      toast.error("Quietanza senza titolo collegato");
      return;
    }
    if (action === "storno") {
      setStornoTitoloId(q.titolo_id);
      setStornoOpen(true);
    } else if (action === "messa_cassa") {
      setCassaTitoli([{
        id: q.titolo_id,
        numero_titolo: numeroPolizza,
        premio_lordo: q.premio_lordo,
        cliente_anagrafica_id: clienteId,
        ufficio_id: uffizioId ?? null,
      }]);
      setCassaOpen(true);
    } else if (action === "annulla_mc") {
      runAnnullaMc(q.titolo_id);
    } else if (action === "annulla_incasso") {
      runAnnullaIncasso(q.titolo_id);
    }
  }

  function pickQuietanza(q: ToolbarQuietanza) {
    setSelectorOpen(false);
    if (pendingAction) executeRataAction(pendingAction, q);
    setPendingAction(null);
  }

  // Available rata-level actions filter (when selecting from polizza)
  const eligibleForAction = (q: ToolbarQuietanza, action: RataAction | null): boolean => {
    if (!action) return true;
    const locked = ["annullata", "stornata"].includes(q.stato);
    if (action === "storno") return !locked;
    if (action === "messa_cassa") return !q.data_messa_cassa && !locked;
    if (action === "annulla_mc") return !!q.data_messa_cassa && q.stato !== "incassato";
    if (action === "annulla_incasso") return q.stato === "incassato";
    return true;
  };

  const onQuietanza = !!currentQuietanza;
  const qLocked = currentQuietanza ? ["annullata", "stornata"].includes(currentQuietanza.stato) : false;
  const qIsMC = !!currentQuietanza?.data_messa_cassa;
  const qIncassata = currentQuietanza?.stato === "incassato";

  return (
    <>
      <Card>
        <CardContent className="py-2.5 px-3 flex flex-wrap gap-1.5">
          {/* Rata-level */}
          <Button
            size="sm"
            onClick={() => startRataAction("messa_cassa")}
            disabled={!titoloMadreId || (onQuietanza && (qIsMC || qLocked))}
            title={onQuietanza && qIsMC ? "Già messa a cassa" : undefined}
          >
            <Banknote className="h-4 w-4 mr-1" /> Messa a cassa
          </Button>
          {onQuietanza && qIncassata ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-orange-600 border-orange-400 hover:bg-orange-50"
                  disabled={!titoloMadreId || annullaMcLoading}
                >
                  <RotateCcw className="h-4 w-4 mr-1" /> Annulla incasso
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Annullare l&apos;incasso?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Verranno eliminate provvigioni non pagate, movimenti contabili, rimesse in bozza
                    e l&apos;eventuale rata successiva auto-generata. La polizza madre non viene toccata.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={() => currentQuietanza?.titolo_id && runAnnullaIncasso(currentQuietanza.titolo_id)}>
                    {annullaMcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conferma"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : onQuietanza ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!titoloMadreId || !qIsMC || qIncassata || annullaMcLoading}
                  title={!qIsMC ? "Non messa a cassa" : undefined}
                >
                  <RotateCcw className="h-4 w-4 mr-1" /> Annulla messa a cassa
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Annullare la messa a cassa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Verranno eliminate provvigioni non pagate e movimenti contabili collegati.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={() => currentQuietanza?.titolo_id && runAnnullaMc(currentQuietanza.titolo_id)}>
                    {annullaMcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conferma"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => startRataAction("annulla_mc")}
              disabled={!titoloMadreId || locked}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Annulla messa a cassa
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => startRataAction("storno")}
            disabled={!titoloMadreId || (onQuietanza ? qLocked : locked)}
          >
            <Undo2 className="h-4 w-4 mr-1" /> Storno
          </Button>

          {/* Polizza-level */}
          {statoPolizza === "sospesa" ? (
            <Button size="sm" onClick={() => setRiattivazioneOpen(true)} disabled={!titoloMadreId}>
              <Play className="h-4 w-4 mr-1" /> Riattiva
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setSospensioneOpen(true)} disabled={locked || !titoloMadreId}>
              <Pause className="h-4 w-4 mr-1" /> Sospendi
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setSostituzioneOpen(true)} disabled={locked || !titoloMadreId}>
            <Replace className="h-4 w-4 mr-1" /> Sostituisci
          </Button>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setEstinzioneOpen(true)} disabled={locked || !titoloMadreId}>
            <XCircle className="h-4 w-4 mr-1" /> Estingui
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(numeroPolizza)}&clienteId=${encodeURIComponent(clienteId || "")}&titoloId=${encodeURIComponent(titoloMadreId || "")}`)}
            disabled={!titoloMadreId}
          >
            <FilePlus2 className="h-4 w-4 mr-1" /> Appendici
          </Button>
          {regolazione && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/portafoglio/immissione?mode=regolazione&titoloMadreId=${titoloMadreId}&quietanzaRefId=${titoloMadreId}`)}
              disabled={!titoloMadreId}
            >
              <ScrollText className="h-4 w-4 mr-1" /> Regolazione
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/portafoglio/doc-precontrattuale?titoloId=${encodeURIComponent(titoloMadreId || "")}&clienteId=${encodeURIComponent(clienteId || "")}`)}
            disabled={!titoloMadreId}
          >
            <FileText className="h-4 w-4 mr-1" /> Precontrattuale
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={locked || !titoloMadreId || annullaLoading}>
                <Ban className="h-4 w-4 mr-1" /> Annulla polizza (irreversibile)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Conferma annullamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Verranno rimosse tutte le quietanze, provvigioni, rimesse e movimenti collegati a questa polizza.
                  L'operazione è irreversibile.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleAnnullaPolizza}>
                  {annullaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conferma"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Quietanza selector */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Seleziona la quietanza</DialogTitle>
            <DialogDescription>
              Su quale rata vuoi eseguire l'operazione?
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto divide-y border rounded-md">
            {quietanze.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nessuna quietanza disponibile</div>
            ) : quietanze.map((q) => {
              const ok = eligibleForAction(q, pendingAction);
              return (
                <button
                  key={q.id}
                  disabled={!ok}
                  onClick={() => pickQuietanza(q)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed text-left"
                >
                  <span className="font-mono font-semibold w-12">
                    {q.numero_rata}{q.numero_rate_totali ? `/${q.numero_rate_totali}` : ""}
                  </span>
                  <span className="text-muted-foreground w-24 text-xs">{fmtDate(q.garanzia_da)}</span>
                  <span className="text-muted-foreground w-24 text-xs">{fmtDate(q.garanzia_a || q.data_scadenza)}</span>
                  <span className="flex-1 text-right tabular-nums">{fmtEuro(q.premio_lordo)}</span>
                  <Badge variant="outline" className={STATO_Q[q.stato] || ""}>
                    {q.stato.replace("_", " ")}
                  </Badge>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Polizza-level dialogs */}
      {titoloMadreId && (
        <>
          <SospensionePolizzaDialog open={sospensioneOpen} onOpenChange={setSospensioneOpen} titoloId={titoloMadreId} numeroPolizza={numeroPolizza} onDone={onRefresh} />
          <RiattivazionePolizzaDialog open={riattivazioneOpen} onOpenChange={setRiattivazioneOpen} titoloId={titoloMadreId} numeroPolizza={numeroPolizza} onDone={onRefresh} />
          <SostituzionePolizzaDialog open={sostituzioneOpen} onOpenChange={setSostituzioneOpen} titoloId={titoloMadreId} numeroPolizza={numeroPolizza} onDone={onRefresh} />
          <EstinzionePolizzaDialog open={estinzioneOpen} onOpenChange={setEstinzioneOpen} titoloId={titoloMadreId} numeroPolizza={numeroPolizza} onDone={onRefresh} />
        </>
      )}

      {/* Rata-level dialogs */}
      {stornoTitoloId && (
        <StornoTitoloDialog
          open={stornoOpen}
          onOpenChange={(o) => { setStornoOpen(o); if (!o) setStornoTitoloId(null); }}
          titoloId={stornoTitoloId}
          numeroPolizza={numeroPolizza}
          onDone={onRefresh}
        />
      )}
      {cassaTitoli.length > 0 && (
        <MessaCassaDialog
          open={cassaOpen}
          onOpenChange={(o) => { setCassaOpen(o); if (!o) setCassaTitoli([]); }}
          titoli={cassaTitoli}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
}
