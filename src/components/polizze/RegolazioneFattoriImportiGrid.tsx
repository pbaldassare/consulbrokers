import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildRegolazioneFattoriRows,
  regolazioneFattoreKey,
  type FattoreRegolazioneRef,
  type RegolazioneFattoreExisting,
} from "@/lib/regolazioneFattori";
import { fmtEuro } from "@/lib/formatCurrency";

type Props = {
  ramoId: string | null | undefined;
  datePresunte: string[];
  fattori: FattoreRegolazioneRef[];
  importiMap: Record<string, number>;
  onImportoChange: (fattoreId: string, anno: number, value: number) => void;
  existing?: RegolazioneFattoreExisting[];
  fallbackAnno?: number;
  /** false = sola lettura */
  editable?: boolean;
  loading?: boolean;
};

/**
 * Griglia Anno | Fattore | Importo esposto per regolazione premio.
 * I 5 fattori standard sono sempre mostrati (anche senza sottoramo);
 * il sottoramo resta obbligatorio solo per la persistenza (ramo_id NOT NULL).
 */
export function RegolazioneFattoriImportiGrid({
  ramoId,
  datePresunte,
  fattori,
  importiMap,
  onImportoChange,
  existing,
  fallbackAnno,
  editable = true,
  loading = false,
}: Props) {
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

  const rows = buildRegolazioneFattoriRows({
    datePresunte,
    fattori,
    existing,
    importiMap,
    fallbackAnno,
  });

  return (
    <div className="space-y-2 md:col-span-3">
      {!ramoId && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Seleziona il sottoramo per salvare gli importi dei fattori di regolazione.
        </p>
      )}
      <Label className="text-xs">Importi esposti per fattore / anno</Label>
      <div className="rounded-md border bg-background/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Anno</TableHead>
              <TableHead>Fattore</TableHead>
              <TableHead className="w-40 text-right">Importo esposto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const key = regolazioneFattoreKey(r.fattore_id, r.anno);
              const val = importiMap[key] ?? r.importo_esposto;
              return (
                <TableRow key={key}>
                  <TableCell className="font-mono text-xs">
                    {r.anno}
                    {r.data_presunta ? (
                      <span className="block text-[10px] text-muted-foreground font-sans">
                        {r.data_presunta}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.fattore_descrizione}
                    <span className="ml-1 text-[10px] text-muted-foreground font-mono">
                      ({r.fattore_codice})
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {editable ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-right tabular-nums"
                        value={Number.isFinite(val) ? val : 0}
                        onChange={(e) => {
                          const n = parseFloat(e.target.value);
                          onImportoChange(r.fattore_id, r.anno, Number.isFinite(n) ? n : 0);
                        }}
                      />
                    ) : (
                      <span className="tabular-nums text-sm">{fmtEuro(val)}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        I 5 fattori standard sono sempre disponibili. Fattori custom aggiuntivi per sottoramo:{" "}
        <span className="font-medium">Tabelle di Base → Fattori regolazione</span>.
      </p>
    </div>
  );
}
