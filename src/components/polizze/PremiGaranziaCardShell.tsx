import { ReactNode, useEffect, useState } from "react";
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
import { isRcaPrincipaleCodice, SSN_PCT } from "@/lib/rcaPrincipaleCodes";

export interface GaranziaRow {
  /** Codice del sottoramo (rami.codice) o codice garanzia legacy */
  codice: string | null;
  descrizione: string;
  netto: string;
  tasse: string;
  aliquotaTasse: number;
  /** Id del sottoramo selezionato (rami.id). Usato per derivare titoli.ramo_id in immissione. */
  sottoramoId?: string | null;
  /** True se il sottoramo è una RCA principale (Auto/Natanti/Corpi Nautica): formula IPT+SSN */
  isRcaPrincipale?: boolean;
  /** Imposta provinciale RCA (€) — solo righe principali */
  imposta?: string;
  /** Contributo SSN (€) — solo righe principali */
  ssn?: string;
  /** Aliquota provinciale RCA (%) usata al momento del calcolo — solo righe principali */
  aliquotaProvinciale?: number;
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
  /** Provincia del cliente (sigla, es. "MI") per leggere l'aliquota provinciale RCA */
  provinciaCliente?: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

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
  provinciaCliente,
}: PremiGaranziaCardShellProps) {
  const isQuietanza = tipoPremio === "quietanza";
  const titolo = isQuietanza ? "Premi per Garanzia — Quietanza" : "Premi per Garanzia — Firma";

  // Aliquota provinciale RCA (default 16%) — letta da aliquote_provinciali_rca
  const [aliquotaProv, setAliquotaProv] = useState<number>(16);
  useEffect(() => {
    if (!provinciaCliente) {
      console.info("[RCA] provincia cliente non disponibile, uso default 16%");
      return;
    }
    const prov = String(provinciaCliente).toUpperCase();
    supabase
      .from("aliquote_provinciali_rca" as any)
      .select("aliquota_pct")
      .eq("provincia", prov)
      .maybeSingle()
      .then(({ data, error }: any) => {
        if (error) {
          console.warn("[RCA] errore lookup aliquote_provinciali_rca", error);
          return;
        }
        const a = Number(data?.aliquota_pct);
        if (Number.isFinite(a) && a > 0) {
          console.info(`[RCA] provincia=${prov} aliquota=${a}%`);
          setAliquotaProv(a);
        } else {
          console.info(`[RCA] provincia=${prov} senza aliquota, uso default 16%`);
        }
      });
  }, [provinciaCliente]);

  // Auto-ricalcolo righe RCA principale già marcate ma con IPT/SSN vuoti (es. ripristino bozza)
  useEffect(() => {
    let dirty = false;
    const next = rows.map((r) => {
      if (!r.isRcaPrincipale) return r;
      const netto = parseFloat(r.netto || "0") || 0;
      const hasImposta = r.imposta != null && r.imposta !== "";
      const hasSsn = r.ssn != null && r.ssn !== "";
      if (netto > 0 && (!hasImposta || !hasSsn)) {
        const aliqProv = r.aliquotaProvinciale ?? aliquotaProv;
        const imposta = round2(netto * (aliqProv / 100));
        const ssn = round2(netto * (SSN_PCT / 100));
        dirty = true;
        return {
          ...r,
          imposta: imposta.toFixed(2),
          ssn: ssn.toFixed(2),
          tasse: (imposta + ssn).toFixed(2),
          aliquotaProvinciale: aliqProv,
        };
      }
      return r;
    });
    if (dirty) onRowsChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliquotaProv]);

  // Totali: per le righe RCA principale, il "lordo" è netto + IPT + SSN.
  // Per le altre, lordo = netto + tasse.
  const totNetto = rows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const totTasse = rows.reduce((s, r) => {
    if (r.isRcaPrincipale) {
      return s + (parseFloat(r.imposta || "0") || 0) + (parseFloat(r.ssn || "0") || 0);
    }
    return s + (parseFloat(r.tasse || "0") || 0);
  }, 0);
  const add = parseFloat(addizionali || "0") || 0;
  const lordo = totNetto + totTasse + add;

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
    const codice = String(sel.codice || "");
    const isRca = isRcaPrincipaleCodice(codice);
    const netto = parseFloat(rows[idx]?.netto || "0") || 0;

    if (isRca) {
      const imposta = round2(netto * (aliquotaProv / 100));
      const ssn = round2(netto * (SSN_PCT / 100));
      updateRow(idx, {
        sottoramoId: sel.id,
        codice,
        descrizione: sel.descrizione,
        aliquotaTasse: aliquota,
        isRcaPrincipale: true,
        aliquotaProvinciale: aliquotaProv,
        imposta: imposta.toFixed(2),
        ssn: ssn.toFixed(2),
        tasse: (imposta + ssn).toFixed(2),
      });
    } else {
      const aliqEffettiva = aliquota || rows[idx]?.aliquotaTasse || 0;
      updateRow(idx, {
        sottoramoId: sel.id,
        codice,
        descrizione: sel.descrizione,
        aliquotaTasse: aliquota,
        isRcaPrincipale: false,
        imposta: undefined,
        ssn: undefined,
        aliquotaProvinciale: undefined,
        tasse: netto > 0 && aliqEffettiva > 0 ? ((netto * aliqEffettiva) / 100).toFixed(2) : rows[idx]?.tasse || "",
      });
    }
  };

  const handleNettoChange = (idx: number, value: string) => {
    const r = rows[idx];
    const netto = parseFloat(value || "0") || 0;
    if (r?.isRcaPrincipale) {
      const aliqProv = r.aliquotaProvinciale ?? aliquotaProv;
      const imposta = round2(netto * (aliqProv / 100));
      const ssn = round2(netto * (SSN_PCT / 100));
      updateRow(idx, {
        netto: value,
        imposta: imposta.toFixed(2),
        ssn: ssn.toFixed(2),
        tasse: (imposta + ssn).toFixed(2),
        aliquotaProvinciale: aliqProv,
      });
      return;
    }
    const aliquota = r?.aliquotaTasse || 0;
    updateRow(idx, {
      netto: value,
      tasse: aliquota > 0 ? ((netto * aliquota) / 100).toFixed(2) : r?.tasse || "",
    });
  };

  const handleLordoChange = (idx: number, value: string) => {
    const r = rows[idx];
    const lordoVal = parseFloat(value || "0") || 0;
    if (r?.isRcaPrincipale) {
      const aliqProv = r.aliquotaProvinciale ?? aliquotaProv;
      const factor = 1 + aliqProv / 100 + SSN_PCT / 100;
      const netto = factor > 0 ? lordoVal / factor : lordoVal;
      const imposta = round2(netto * (aliqProv / 100));
      const ssn = round2(netto * (SSN_PCT / 100));
      updateRow(idx, {
        netto: netto.toFixed(2),
        imposta: imposta.toFixed(2),
        ssn: ssn.toFixed(2),
        tasse: (imposta + ssn).toFixed(2),
        aliquotaProvinciale: aliqProv,
      });
      return;
    }
    const aliquota = r?.aliquotaTasse || 0;
    if (aliquota > 0) {
      const netto = lordoVal / (1 + aliquota / 100);
      const tasse = lordoVal - netto;
      updateRow(idx, { netto: netto.toFixed(2), tasse: tasse.toFixed(2) });
    } else {
      updateRow(idx, { netto: lordoVal.toFixed(2), tasse: "0.00" });
    }
  };

  const handleImpostaChange = (idx: number, value: string) => {
    const r = rows[idx];
    const imposta = parseFloat(value || "0") || 0;
    const ssn = parseFloat(r?.ssn || "0") || 0;
    updateRow(idx, { imposta: value, tasse: round2(imposta + ssn).toFixed(2) });
  };

  const handleSsnChange = (idx: number, value: string) => {
    const r = rows[idx];
    const ssn = parseFloat(value || "0") || 0;
    const imposta = parseFloat(r?.imposta || "0") || 0;
    updateRow(idx, { ssn: value, tasse: round2(imposta + ssn).toFixed(2) });
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
                <TableHead className="text-right w-[160px]">Tasse / IPT + SSN €</TableHead>
                <TableHead className="text-right">Tasse €</TableHead>
                <TableHead className="text-right">Premio Lordo</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => {
                const netto = parseFloat(r.netto || "0") || 0;
                const tax = r.isRcaPrincipale
                  ? (parseFloat(r.imposta || "0") || 0) + (parseFloat(r.ssn || "0") || 0)
                  : parseFloat(r.tasse || "0") || 0;
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
                        {r.isRcaPrincipale && (
                          <Badge variant="outline" className="text-[9px] border-teal-500 text-teal-800">
                            RCA
                          </Badge>
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
                      {r.isRcaPrincipale ? (
                        <div className="flex flex-col gap-1 items-end">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground w-8 text-right">IPT</span>
                            <Input
                              type="number"
                              step="0.01"
                              inputMode="decimal"
                              value={r.imposta ?? ""}
                              onChange={(e) => handleImpostaChange(idx, e.target.value)}
                              className="h-7 text-right font-mono w-20"
                              title={`Aliquota provinciale ${(r.aliquotaProvinciale ?? aliquotaProv).toFixed(2)}%`}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground w-8 text-right">SSN</span>
                            <Input
                              type="number"
                              step="0.01"
                              inputMode="decimal"
                              value={r.ssn ?? ""}
                              onChange={(e) => handleSsnChange(idx, e.target.value)}
                              className="h-7 text-right font-mono w-20"
                              title={`SSN ${SSN_PCT}%`}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">{aliquotaCalc.toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.isRcaPrincipale ? (
                        <span className="text-xs font-mono">{tax.toFixed(2)}</span>
                      ) : (
                        <Input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={r.tasse}
                          onChange={(e) => updateRow(idx, { tasse: e.target.value })}
                          className="h-8 text-right font-mono ml-auto w-24"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={lordoRow ? lordoRow.toFixed(2) : ""}
                        onChange={(e) => handleLordoChange(idx, e.target.value)}
                        className="h-8 text-right font-mono font-semibold ml-auto w-28"
                      />
                    </TableCell>
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
