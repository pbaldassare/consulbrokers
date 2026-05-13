import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car, ShieldCheck, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";

export interface GaranziaRow {
  /** Codice del sottoramo (rami.codice) o codice garanzia legacy */
  codice: string | null;
  descrizione: string;
  netto: string;
  tasse: string;
  aliquotaTasse: number;
  /** Id del sottoramo selezionato (rami.id). Usato per derivare titoli.ramo_id in immissione. */
  sottoramoId?: string | null;
}

export const emptyGaranziaRow = (): GaranziaRow => ({
  codice: null,
  descrizione: "",
  netto: "",
  tasse: "",
  aliquotaTasse: 0,
  sottoramoId: null,
});

export interface PremiGaranziaCardShellProps {
  tipoPremio: "firma" | "quietanza";
  /** Gruppo Ramo selezionato sul titolo: filtra il catalogo garanzie selezionabili */
  gruppoRamoId?: string | null;
  rows: GaranziaRow[];
  onRowsChange: (next: GaranziaRow[]) => void;
  addizionali: string;
  onAddizionaliChange: (v: string) => void;
  provvigioni: number;
  /** Slot opzionale (es. pulsante "Importa con AI") */
  headerExtra?: ReactNode;
  /** Mostra badge "Sincronizzata" sulla Quietanza quando è uno specchio della Firma */
  sincronizzata?: boolean;
}

export function PremiGaranziaCardShell({
  tipoPremio,
  gruppoRamoId,
  rows,
  onRowsChange,
  addizionali,
  onAddizionaliChange,
  provvigioni,
  headerExtra,
  sincronizzata,
}: PremiGaranziaCardShellProps) {
  const isQuietanza = tipoPremio === "quietanza";
  const titolo = isQuietanza ? "Premi per Garanzia — Quietanza" : "Premi per Garanzia — Firma";

  const totNetto = rows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const totTasse = rows.reduce((s, r) => s + (parseFloat(r.tasse || "0") || 0), 0);
  const add = parseFloat(addizionali || "0") || 0;
  const lordo = totNetto + totTasse + add;

  // Catalogo sottorami filtrato per gruppo ramo selezionato.
  // I sottorami compongono le righe garanzia che formano il premio.
  const { data: catalogo = [] } = useQuery({
    queryKey: ["sottorami-catalogo-shell", gruppoRamoId || "none"],
    enabled: !!gruppoRamoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("rami")
        .select("id, codice, descrizione, aliquota_tasse_ramo")
        .eq("attivo", true)
        .eq("gruppo_ramo_id", gruppoRamoId!)
        .order("codice");
      return (data as any[]) || [];
    },
  });

  const garanziaOptions = (catalogo as any[]).map((s: any) => ({
    value: s.id as string,
    label: `${s.codice} — ${s.descrizione}`,
  }));

  const updateRow = (idx: number, patch: Partial<GaranziaRow>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onRowsChange(next);
  };

  const addRow = () => onRowsChange([...rows, emptyGaranziaRow()]);

  const removeRow = (idx: number) => {
    const r = rows[idx];
    const isEmpty = !r.codice && !r.descrizione && !r.netto && !r.tasse;
    if (!isEmpty) {
      const ok = window.confirm("Rimuovere questa garanzia?");
      if (!ok) return;
    }
    const next = rows.filter((_, i) => i !== idx);
    onRowsChange(next.length ? next : [emptyGaranziaRow()]);
  };

  const handleGaranziaSelect = (idx: number, sottoramoId: string) => {
    const sel = (catalogo as any[]).find((s: any) => s.id === sottoramoId);
    if (!sel) return;
    const aliquota = Number(sel.aliquota_tasse_ramo) || 0;
    const netto = parseFloat(rows[idx]?.netto || "0") || 0;
    updateRow(idx, {
      sottoramoId: sel.id,
      codice: sel.codice,
      descrizione: sel.descrizione,
      aliquotaTasse: aliquota,
      tasse: netto > 0 && aliquota > 0 ? ((netto * aliquota) / 100).toFixed(2) : rows[idx]?.tasse || "",
    });
  };

  const handleNettoChange = (idx: number, value: string) => {
    const r = rows[idx];
    const netto = parseFloat(value || "0") || 0;
    const aliquota = r?.aliquotaTasse || 0;
    updateRow(idx, {
      netto: value,
      tasse: aliquota > 0 ? ((netto * aliquota) / 100).toFixed(2) : r?.tasse || "",
    });
  };

  return (
    <Card className={cn("border-l-4 shadow-sm", isQuietanza ? "border-l-amber-500" : "border-l-teal-600")}>
      <CardHeader
        className={cn(
          "border-b py-3",
          isQuietanza ? "bg-amber-50/60 dark:bg-amber-950/20" : "bg-teal-50/60 dark:bg-teal-950/20",
        )}
      >
        <div className="flex items-start sm:items-center justify-between flex-wrap gap-2">
          <CardTitle
            className={cn(
              "flex items-center gap-2 text-sm sm:text-base",
              isQuietanza ? "text-amber-900 dark:text-amber-100" : "text-teal-900 dark:text-teal-100",
            )}
          >
            {isQuietanza ? <ShieldCheck className="h-4 w-4" /> : <Car className="h-4 w-4" />}
            {titolo}
            {isQuietanza && sincronizzata && (
              <Badge variant="outline" className="ml-1 text-[10px] border-emerald-400 text-emerald-800">
                Sincronizzata
              </Badge>
            )}
          </CardTitle>
          {headerExtra && <div className="flex items-center gap-2">{headerExtra}</div>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[34%]">Voce</TableHead>
                <TableHead className="text-right">Premio Netto</TableHead>
                <TableHead className="text-right w-[110px]">Aliquota %</TableHead>
                <TableHead className="text-right">Tasse €</TableHead>
                <TableHead className="text-right">Premio Lordo</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => {
                const netto = parseFloat(r.netto || "0") || 0;
                const tax = parseFloat(r.tasse || "0") || 0;
                const aliquotaCalc = netto > 0 ? (tax / netto) * 100 : (r.aliquotaTasse || 0);
                const lordoRow = netto + tax;
                const zebra = idx % 2 === 0
                  ? (isQuietanza ? "bg-amber-50/40 dark:bg-amber-950/10" : "bg-teal-50/50 dark:bg-teal-950/15")
                  : "bg-card";
                return (
                  <TableRow key={idx} className={cn(zebra)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className={cn("h-4 w-4 flex-shrink-0", isQuietanza ? "text-amber-700" : "text-teal-700")} />
                        {gruppoRamoId ? (
                          <SearchableSelect
                            options={garanziaOptions}
                            value={r.sottoramoId || ""}
                            onValueChange={(v) => handleGaranziaSelect(idx, v)}
                            placeholder={garanziaOptions.length ? "Seleziona sottoramo…" : "Caricamento…"}
                            className="min-w-[220px]"
                          />
                        ) : (
                          <Input
                            value={r.descrizione}
                            onChange={(e) => updateRow(idx, { descrizione: e.target.value })}
                            placeholder="Seleziona prima il Ramo"
                            disabled
                            className="h-8 text-xs flex-1 min-w-[140px]"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={r.netto}
                        onChange={(e) => handleNettoChange(idx, e.target.value)}
                        className="h-8 text-right font-mono ml-auto w-28"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs text-muted-foreground font-mono">{aliquotaCalc.toFixed(2)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={r.tasse}
                        onChange={(e) => updateRow(idx, { tasse: e.target.value })}
                        className="h-8 text-right font-mono ml-auto w-24"
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">{lordoRow.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(idx)}
                        aria-label="Rimuovi garanzia"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="px-3 py-2 border-t">
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" /> Aggiungi voce
          </Button>
        </div>

        {/* Totali */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border-t bg-muted/20">
          <div className="rounded-md border bg-card p-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Totale Netto</Label>
            <p className="text-sm font-mono font-semibold mt-0.5">{totNetto.toFixed(2)} €</p>
          </div>
          <div className="rounded-md border bg-card p-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Totale Tasse</Label>
            <p className="text-sm font-mono font-semibold mt-0.5">{totTasse.toFixed(2)} €</p>
          </div>
          <div className="rounded-md border bg-card p-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Addizionali</Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={addizionali}
              onChange={(e) => onAddizionaliChange(e.target.value)}
              className="h-7 text-right font-mono mt-0.5"
            />
          </div>
          <div
            className={cn(
              "rounded-md border p-2",
              isQuietanza
                ? "bg-amber-50/60 border-amber-300 dark:bg-amber-950/20"
                : "bg-teal-50/60 border-teal-300 dark:bg-teal-950/20",
            )}
          >
            <Label
              className={cn(
                "text-[10px] uppercase",
                isQuietanza ? "text-amber-800 dark:text-amber-200" : "text-teal-800 dark:text-teal-200",
              )}
            >
              Premio Lordo
            </Label>
            <p
              className={cn(
                "text-sm font-mono font-bold mt-0.5",
                isQuietanza ? "text-amber-900 dark:text-amber-100" : "text-teal-900 dark:text-teal-100",
              )}
            >
              {lordo.toFixed(2)} €
            </p>
          </div>
        </div>

        {/* Provvigioni footer */}
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-3 py-2 border-t",
            isQuietanza ? "bg-amber-50/30 dark:bg-amber-950/10" : "bg-teal-50/30 dark:bg-teal-950/10",
          )}
        >
          <div>
            <p
              className={cn(
                "text-xs font-bold uppercase",
                isQuietanza ? "text-amber-800 dark:text-amber-200" : "text-teal-800 dark:text-teal-200",
              )}
            >
              Provvigioni {isQuietanza ? "Quietanza" : "Firma"}
            </p>
            <p className="text-[10px] text-muted-foreground">Importo dovuto al commerciale (€)</p>
          </div>
          <div className="text-sm font-mono font-semibold">{provvigioni.toFixed(2)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PremiGaranziaCardShell;
