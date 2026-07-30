import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  addRegolazioneFattoreRiga,
  createRegolazioneFattoreRiga,
  fattoriDisponibiliPerAnno,
  removeRegolazioneFattoreRiga,
  updateRegolazioneFattoreImporto,
  yearSlotsFromDatePresunte,
  type FattoreRegolazioneRef,
  type RegolazioneFattoreRiga,
} from "@/lib/regolazioneFattori";
import { fmtEuro } from "@/lib/formatCurrency";

type Props = {
  ramoId: string | null | undefined;
  datePresunte: string[];
  fattori: FattoreRegolazioneRef[];
  righe: RegolazioneFattoreRiga[];
  onChange: (righe: RegolazioneFattoreRiga[]) => void;
  fallbackAnno?: number;
  /** false = sola lettura */
  editable?: boolean;
  loading?: boolean;
};

/**
 * Lista esplicita importi esposti per fattore/anno.
 * Nessuna precompilazione dei 5 standard: si aggiunge con + e si rimuove con cestino.
 */
export function RegolazioneFattoriImportiGrid({
  ramoId,
  datePresunte,
  fattori,
  righe,
  onChange,
  fallbackAnno,
  editable = true,
  loading = false,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [pickFattoreId, setPickFattoreId] = useState("");
  const [pickAnno, setPickAnno] = useState<string>("");

  const slots = useMemo(
    () => yearSlotsFromDatePresunte(datePresunte, fallbackAnno),
    [datePresunte, fallbackAnno],
  );

  const fattoriById = useMemo(
    () => new Map(fattori.map((f) => [f.id, f])),
    [fattori],
  );

  const annoNum = pickAnno ? Number(pickAnno) : null;
  const fattoriDisponibili = useMemo(() => {
    if (annoNum == null || !Number.isFinite(annoNum)) return fattori;
    return fattoriDisponibiliPerAnno(fattori, righe, annoNum);
  }, [fattori, righe, annoNum]);

  const openAdd = () => {
    const firstSlot = slots[0];
    setPickAnno(firstSlot ? String(firstSlot.anno) : "");
    setPickFattoreId("");
    setAddOpen(true);
  };

  const confirmAdd = () => {
    const slot = slots.find((s) => s.anno === Number(pickAnno));
    const fattore = fattoriById.get(pickFattoreId);
    if (!fattore || !slot) return;
    const riga = createRegolazioneFattoreRiga({
      fattore,
      anno: slot.anno,
      data_presunta: slot.data_presunta,
      importo_esposto: 0,
    });
    onChange(addRegolazioneFattoreRiga(righe, riga));
    setAddOpen(false);
  };

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground md:col-span-3">Caricamento fattori…</p>
    );
  }

  if (!fattori.length) {
    return (
      <div className="space-y-1 md:col-span-3">
        <p className="text-xs text-muted-foreground">
          Nessun fattore disponibile. Verifica il catalogo standard oppure aggiungi fattori custom in{" "}
          <span className="font-medium">Sistema → Tabelle di Base → Fattori regolazione</span>.
        </p>
      </div>
    );
  }

  const canConfirm =
    !!pickFattoreId &&
    !!pickAnno &&
    fattoriDisponibili.some((f) => f.id === pickFattoreId);

  return (
    <div className="space-y-2 md:col-span-3">
      {!ramoId && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Seleziona il sottoramo per salvare gli importi dei fattori di regolazione.
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Importi esposti per fattore / anno</Label>
        {editable && (
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" />
            Aggiungi fattore
          </Button>
        )}
      </div>

      {righe.length === 0 ? (
        <div className="rounded-md border border-dashed bg-background/40 px-3 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            Nessun fattore aggiunto. Usa <span className="font-medium">+</span> per selezionare
            fattore e anno.
          </p>
        </div>
      ) : (
        <div className="rounded-md border bg-background/60 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Anno</TableHead>
                <TableHead>Fattore</TableHead>
                <TableHead className="w-40 text-right">Importo esposto</TableHead>
                {editable && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {righe.map((r) => {
                const f = fattoriById.get(r.fattore_id);
                const desc = r.fattore_descrizione || f?.descrizione || r.fattore_id;
                const codice = r.fattore_codice || f?.codice;
                return (
                  <TableRow key={r.key}>
                    <TableCell className="font-mono text-xs">
                      {r.anno}
                      {r.data_presunta ? (
                        <span className="block text-[10px] text-muted-foreground font-sans">
                          {r.data_presunta}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {desc}
                      {codice ? (
                        <span className="ml-1 text-[10px] text-muted-foreground font-mono">
                          ({codice})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {editable ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 text-right tabular-nums"
                          value={Number.isFinite(r.importo_esposto) ? r.importo_esposto : 0}
                          onChange={(e) => {
                            const n = parseFloat(e.target.value);
                            onChange(
                              updateRegolazioneFattoreImporto(
                                righe,
                                r.key,
                                Number.isFinite(n) ? n : 0,
                              ),
                            );
                          }}
                        />
                      ) : (
                        <span className="tabular-nums text-sm">{fmtEuro(r.importo_esposto)}</span>
                      )}
                    </TableCell>
                    {editable && (
                      <TableCell className="text-right p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label="Rimuovi fattore"
                          onClick={() => onChange(removeRegolazioneFattoreRiga(righe, r.key))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Aggiungi i fattori necessari con +. I 5 standard e i custom del sottoramo sono selezionabili.
      </p>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aggiungi fattore</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Anno / data presunta</Label>
              <Select value={pickAnno} onValueChange={(v) => {
                setPickAnno(v);
                setPickFattoreId("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona anno" />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((s) => (
                    <SelectItem key={s.anno} value={String(s.anno)}>
                      {s.anno}
                      {s.data_presunta ? ` (${s.data_presunta})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fattore</Label>
              <Select
                value={pickFattoreId}
                onValueChange={setPickFattoreId}
                disabled={!pickAnno || fattoriDisponibili.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      fattoriDisponibili.length === 0
                        ? "Nessun fattore disponibile per questo anno"
                        : "Seleziona fattore"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {fattoriDisponibili.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.descrizione} ({f.codice})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={confirmAdd} disabled={!canConfirm}>
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
