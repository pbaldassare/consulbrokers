import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  addRegolazioneFattoriRighe,
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
  const [pickFattoreIds, setPickFattoreIds] = useState<string[]>([]);
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
    setPickFattoreIds([]);
    setAddOpen(true);
  };

  const toggleFattore = (id: string) => {
    setPickFattoreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const allDisponibiliSelected =
    fattoriDisponibili.length > 0 &&
    fattoriDisponibili.every((f) => pickFattoreIds.includes(f.id));

  const toggleSelectAll = () => {
    if (allDisponibiliSelected) {
      setPickFattoreIds([]);
    } else {
      setPickFattoreIds(fattoriDisponibili.map((f) => f.id));
    }
  };

  const confirmAdd = () => {
    const slot = slots.find((s) => s.anno === Number(pickAnno));
    if (!slot || pickFattoreIds.length === 0) return;
    const nuove = pickFattoreIds
      .map((fid) => fattoriById.get(fid))
      .filter((f): f is FattoreRegolazioneRef => !!f)
      .map((fattore) =>
        createRegolazioneFattoreRiga({
          fattore,
          anno: slot.anno,
          data_presunta: slot.data_presunta,
          importo_esposto: 0,
        }),
      );
    onChange(addRegolazioneFattoriRighe(righe, nuove));
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
    !!pickAnno &&
    pickFattoreIds.length > 0 &&
    pickFattoreIds.every((id) => fattoriDisponibili.some((f) => f.id === id));

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
        Aggiungi i fattori necessari con +. Puoi selezionarne più di uno per lo stesso anno.
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
                setPickFattoreIds([]);
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
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Fattori</Label>
                {pickAnno && fattoriDisponibili.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={toggleSelectAll}
                  >
                    {allDisponibiliSelected ? "Deseleziona tutto" : "Seleziona tutto"}
                  </Button>
                )}
              </div>
              {!pickAnno ? (
                <p className="text-xs text-muted-foreground">Seleziona prima l&apos;anno.</p>
              ) : fattoriDisponibili.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nessun fattore disponibile per questo anno
                </p>
              ) : (
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">
                  {fattoriDisponibili.map((f) => {
                    const checked = pickFattoreIds.includes(f.id);
                    return (
                      <label
                        key={f.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleFattore(f.id)}
                          aria-label={f.descrizione}
                        />
                        <span className="truncate">
                          {f.descrizione}{" "}
                          <span className="font-mono text-[10px] text-muted-foreground">
                            ({f.codice})
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={confirmAdd} disabled={!canConfirm}>
              {pickFattoreIds.length > 1 ? `Aggiungi (${pickFattoreIds.length})` : "Aggiungi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
