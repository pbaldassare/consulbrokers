import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";

export interface PremiGaranziaCardShellProps {
  tipoPremio: "firma" | "quietanza";
  /** Etichetta della voce principale (es. "RCA Auto" oppure "Premio") */
  mainLabel?: string;
  /** Gruppo Ramo selezionato sul titolo: filtra il catalogo garanzie selezionabili */
  gruppoRamoId?: string | null;
  /** Codice garanzia selezionata (catalogo rca_garanzie) */
  garanziaCodice?: string;
  onGaranziaChange?: (codice: string, descrizione: string, aliquotaTasse: number) => void;
  premioNetto: string;
  onPremioNettoChange: (v: string) => void;
  addizionali: string;
  onAddizionaliChange: (v: string) => void;
  tasse: string;
  onTasseChange: (v: string) => void;
  provvigioni: number;
  /** Slot opzionale (es. pulsante "Importa con AI") */
  headerExtra?: ReactNode;
  /** Mostra badge "Sincronizzata" sulla Quietanza quando è uno specchio della Firma */
  sincronizzata?: boolean;
}

/**
 * Replica visiva di VociRcaCard pensata per la fase di immissione,
 * dove non esistono ancora righe `premi_garanzia_polizza` su DB.
 * Lavora su state locale (Firma o Quietanza) — nessuna persistenza diretta.
 */
export function PremiGaranziaCardShell({
  tipoPremio,
  mainLabel = "Premio",
  premioNetto,
  onPremioNettoChange,
  addizionali,
  onAddizionaliChange,
  tasse,
  onTasseChange,
  provvigioni,
  headerExtra,
  sincronizzata,
}: PremiGaranziaCardShellProps) {
  const isQuietanza = tipoPremio === "quietanza";
  const titolo = isQuietanza ? "Premi per Garanzia — Quietanza" : "Premi per Garanzia — Firma";
  const netto = parseFloat(premioNetto || "0") || 0;
  const tax = parseFloat(tasse || "0") || 0;
  const add = parseFloat(addizionali || "0") || 0;
  const lordo = netto + tax + add;
  const aliquota = netto > 0 ? (tax / netto) * 100 : 0;

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
                <TableHead className="w-[28%]">Voce</TableHead>
                <TableHead className="text-right">Premio Netto</TableHead>
                <TableHead className="text-right w-[120px]">Aliquota %</TableHead>
                <TableHead className="text-right">Tasse €</TableHead>
                <TableHead className="text-right">Premio Lordo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                className={cn(
                  isQuietanza
                    ? "bg-amber-50/60 dark:bg-amber-950/20"
                    : "bg-teal-50/80 dark:bg-teal-950/30",
                  "font-medium",
                )}
              >
                <TableCell className="flex items-center gap-2">
                  <ShieldCheck className={cn("h-4 w-4", isQuietanza ? "text-amber-700" : "text-teal-700")} />
                  <span>{mainLabel}</span>
                  <Badge
                    className={cn(
                      "ml-1 text-[10px]",
                      isQuietanza ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-600 hover:bg-teal-700",
                    )}
                  >
                    obbligatoria
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={premioNetto}
                    onChange={(e) => onPremioNettoChange(e.target.value)}
                    className="h-8 text-right font-mono ml-auto w-32"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-xs text-muted-foreground font-mono">{aliquota.toFixed(2)}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={tasse}
                    onChange={(e) => onTasseChange(e.target.value)}
                    className="h-8 text-right font-mono ml-auto w-28"
                  />
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">{lordo.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Totali */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border-t bg-muted/20">
          <div className="rounded-md border bg-card p-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Totale Netto</Label>
            <p className="text-sm font-mono font-semibold mt-0.5">{netto.toFixed(2)} €</p>
          </div>
          <div className="rounded-md border bg-card p-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Totale Tasse</Label>
            <p className="text-sm font-mono font-semibold mt-0.5">{tax.toFixed(2)} €</p>
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
