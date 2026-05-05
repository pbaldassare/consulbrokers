import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Car, Plus, Trash2, ShieldCheck, AlertCircle, CheckCircle2, Lock, RefreshCw, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmtEur = (n: number | null | undefined) =>
  n == null || isNaN(Number(n))
    ? "—"
    : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(round2(Number(n)));

interface Voce {
  id: string;
  titolo_id: string;
  garanzia: string;
  codice_garanzia: string | null;
  firma: number | null;
  aliquota_tasse_pct: number | null;
  lordo_calcolato: number | null;
  is_rca_principale: boolean;
  imposta_provinciale: number | null;
  ssn: number | null;
  ordine: number | null;
  tipo_premio?: "firma" | "quietanza";
  quietanza_personalizzata?: boolean;
  voce_origine_id?: string | null;
}

type TipoPremio = "firma" | "quietanza";

const RCA_LABEL = "RCA Auto";
const RCA_CODE = "RCA";
const SSN_PCT = 10.5;
const ALIQUOTA_ACCESSORIE_DEFAULT = 13.5; // tasse accessorie auto (non-RCA)

function calcolaLordo(
  v: { firma: number | null; aliquota_tasse_pct: number | null; is_rca_principale: boolean },
  aliquotaProv: number,
) {
  const netto = round2(Number(v.firma || 0));
  if (v.is_rca_principale) {
    const imposta = round2(netto * (aliquotaProv / 100));
    const ssn = round2(imposta * (SSN_PCT / 100));
    return { netto, lordo: round2(netto + imposta + ssn), imposta, ssn };
  }
  const aliq = Number(v.aliquota_tasse_pct ?? ALIQUOTA_ACCESSORIE_DEFAULT);
  const tasse = round2(netto * (aliq / 100));
  return { netto, lordo: round2(netto + tasse), imposta: 0, ssn: 0 };
}

export function VociRcaCard({ titoloId, premioLordoTitolo, provinciaCliente, onTotaliChange, tipoPremio = "firma", titolo }: {
  titoloId: string;
  premioLordoTitolo?: number | null;
  provinciaCliente?: string | null;
  onTotaliChange?: (t: { netto: number; tasse: number; lordo: number }) => void;
  tipoPremio?: TipoPremio;
  titolo?: string;
}) {
  const qc = useQueryClient();
  const isQuietanza = tipoPremio === "quietanza";
  const [aliquotaProv, setAliquotaProv] = useState<number>(16);
  const [toDelete, setToDelete] = useState<Voce | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!provinciaCliente) return;
    supabase.from("aliquote_provinciali_rca" as any)
      .select("aliquota_pct")
      .eq("provincia", provinciaCliente.toUpperCase())
      .maybeSingle()
      .then(({ data }: any) => { if (data?.aliquota_pct) setAliquotaProv(Number(data.aliquota_pct)); });
  }, [provinciaCliente]);

  const { data: voci = [], isLoading } = useQuery({
    queryKey: ["voci-rca", titoloId, tipoPremio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("premi_garanzia_polizza" as any)
        .select("*")
        .eq("titolo_id", titoloId)
        .eq("tipo_premio", tipoPremio)
        .order("is_rca_principale", { ascending: false })
        .order("ordine", { ascending: true });
      if (error) throw error;
      return (data as any as Voce[]) || [];
    },
  });

  const { data: catalogo = [] } = useQuery({
    queryKey: ["rca-garanzie-catalogo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rca_garanzie" as any)
        .select("codice, descrizione, aliquota_tasse")
        .eq("attivo", true)
        .order("codice");
      return (data as any[]) || [];
    },
  });

  const invalidateBoth = () => {
    qc.invalidateQueries({ queryKey: ["voci-rca", titoloId, "firma"] });
    qc.invalidateQueries({ queryKey: ["voci-rca", titoloId, "quietanza"] });
  };

  useEffect(() => {
    if (isLoading) return;
    if (isQuietanza) return; // la riga RCA Quietanza viene creata dal trigger
    const hasRca = voci.some((v) => v.is_rca_principale);
    if (!hasRca) {
      supabase.from("premi_garanzia_polizza" as any).insert({
        titolo_id: titoloId,
        garanzia: RCA_LABEL,
        codice_garanzia: RCA_CODE,
        is_rca_principale: true,
        firma: 0,
        ordine: 0,
        tipo_premio: "firma",
      }).then(() => invalidateBoth());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, voci, titoloId, isQuietanza]);

  const upsertMut = useMutation({
    mutationFn: async (v: Partial<Voce> & { id: string }) => {
      const { id, ...rest } = v;
      // Se sto modificando una riga Quietanza, marcala come personalizzata
      if (isQuietanza && (rest as any).quietanza_personalizzata === undefined) {
        (rest as any).quietanza_personalizzata = true;
      }
      const { error } = await supabase.from("premi_garanzia_polizza" as any).update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateBoth(),
    onError: (e: any) => toast.error("Salvataggio fallito: " + e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("premi_garanzia_polizza" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateBoth();
      toast.success("Voce rimossa");
      setToDelete(null);
    },
    onError: (e: any) => toast.error("Rimozione fallita: " + e.message),
  });

  const addMut = useMutation({
    mutationFn: async (g: { codice: string; descrizione: string; aliquota_tasse: number | null }) => {
      const { error } = await supabase.from("premi_garanzia_polizza" as any).insert({
        titolo_id: titoloId,
        garanzia: g.descrizione,
        codice_garanzia: g.codice,
        aliquota_tasse_pct: g.aliquota_tasse ?? ALIQUOTA_ACCESSORIE_DEFAULT,
        is_rca_principale: false,
        firma: 0,
        ordine: (voci.length || 0) + 1,
        tipo_premio: tipoPremio,
        quietanza_personalizzata: isQuietanza ? true : false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateBoth();
      toast.success("Voce aggiunta");
    },
  });

  const resetQuietanzaMut = useMutation({
    mutationFn: async () => {
      // Reset all quietanza rows for this titolo to non-personalizzato, then run sync RPC
      const { error: e1 } = await supabase
        .from("premi_garanzia_polizza" as any)
        .update({ quietanza_personalizzata: false })
        .eq("titolo_id", titoloId)
        .eq("tipo_premio", "quietanza");
      if (e1) throw e1;
      const { error: e2 } = await supabase.rpc("sync_quietanza_da_firma" as any, { p_titolo_id: titoloId });
      if (e2) throw e2;
    },
    onSuccess: () => {
      invalidateBoth();
      toast.success("Quietanza riallineata alla Firma");
      setConfirmReset(false);
    },
    onError: (e: any) => toast.error("Reset fallito: " + e.message),
  });

  const handleNettoBlur = (v: Voce, value: number) => {
    const netto = round2(value);
    const calc = calcolaLordo({ ...v, firma: netto }, aliquotaProv);
    upsertMut.mutate({
      id: v.id,
      firma: netto,
      lordo_calcolato: calc.lordo,
      imposta_provinciale: v.is_rca_principale ? calc.imposta : null,
      ssn: v.is_rca_principale ? calc.ssn : null,
    });
  };

  const handleAliquotaBlur = (v: Voce, value: number) => {
    const calc = calcolaLordo({ ...v, aliquota_tasse_pct: value }, aliquotaProv);
    upsertMut.mutate({
      id: v.id,
      aliquota_tasse_pct: value,
      lordo_calcolato: calc.lordo,
    });
  };

  const handleAliquotaProvChange = (val: number) => {
    setAliquotaProv(val);
    const rca = voci.find((v) => v.is_rca_principale);
    if (rca) {
      const calc = calcolaLordo(rca, val);
      upsertMut.mutate({
        id: rca.id,
        lordo_calcolato: calc.lordo,
        imposta_provinciale: calc.imposta,
        ssn: calc.ssn,
      });
    }
  };

  const totali = useMemo(() => {
    let netto = 0, lordo = 0, imposta = 0, ssn = 0, tasseAcc = 0;
    voci.forEach((v) => {
      const c = calcolaLordo(v, aliquotaProv);
      netto = round2(netto + c.netto);
      lordo = round2(lordo + c.lordo);
      imposta = round2(imposta + c.imposta);
      ssn = round2(ssn + c.ssn);
      if (!v.is_rca_principale) tasseAcc = round2(tasseAcc + (c.lordo - c.netto));
    });
    return { netto, lordo, tasse: round2(lordo - netto), imposta, ssn, tasseAcc };
  }, [voci, aliquotaProv]);

  useEffect(() => {
    if (isLoading) return;
    onTotaliChange?.({ netto: totali.netto, tasse: totali.tasse, lordo: totali.lordo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totali.netto, totali.tasse, totali.lordo, isLoading]);

  const codiciPresenti = new Set(voci.map((v) => (v.codice_garanzia || "").toUpperCase()));
  const catalogoDisponibile = (catalogo as any[]).filter(
    (g) => !codiciPresenti.has(String(g.codice).toUpperCase()) && String(g.codice).toUpperCase() !== RCA_CODE,
  );

  const delta = premioLordoTitolo == null ? 0 : round2(totali.lordo - Number(premioLordoTitolo));
  const quadra = premioLordoTitolo == null || Math.abs(delta) < 0.01;

  return (
    <>
      <Card className={cn("border-l-4 shadow-sm", isQuietanza ? "border-l-amber-500" : "border-l-teal-600")}>
        <CardHeader className={cn("border-b py-3", isQuietanza ? "bg-amber-50/60 dark:bg-amber-950/20" : "bg-teal-50/60 dark:bg-teal-950/20")}>
          <div className="flex items-start sm:items-center justify-between flex-wrap gap-2">
            <CardTitle className={cn("flex items-center gap-2 text-base sm:text-lg", isQuietanza ? "text-amber-900 dark:text-amber-100" : "text-teal-900 dark:text-teal-100")}>
              <Car className="h-5 w-5" />
              {titolo ?? (isQuietanza ? "Composizione Premio RCA — Quietanza" : "Composizione Premio RCA — Firma")}
              {isQuietanza && voci.some((v) => v.quietanza_personalizzata) && (
                <Badge variant="outline" className="ml-1 text-[10px] gap-1 border-amber-400 text-amber-800">
                  <PencilLine className="h-3 w-3" /> Personalizzata
                </Badge>
              )}
              {isQuietanza && !voci.some((v) => v.quietanza_personalizzata) && (
                <Badge variant="outline" className="ml-1 text-[10px] border-emerald-400 text-emerald-800">
                  Sincronizzata
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              {isQuietanza && (
                <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setConfirmReset(true)}
                  disabled={!voci.some((v) => v.quietanza_personalizzata)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Risincronizza
                </Button>
              )}
              <span className="text-muted-foreground hidden sm:inline">Imposta provinciale:</span>
              <span className="text-muted-foreground sm:hidden">IPT:</span>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="h-8 w-16 sm:w-20 text-right"
                defaultValue={aliquotaProv}
                onBlur={(e) => handleAliquotaProvChange(Number(e.target.value || 0))}
              />
              <span className="text-muted-foreground">%</span>
              {provinciaCliente && <Badge variant="outline" className="text-[10px]">{provinciaCliente}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop / tablet table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[35%]">Voce</TableHead>
                  <TableHead className="text-right">Premio Netto</TableHead>
                  <TableHead className="text-right w-[120px]">Aliquota %</TableHead>
                  <TableHead className="text-right">Premio Lordo</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {voci.map((v, idx) => {
                  const calc = calcolaLordo(v, aliquotaProv);
                  return (
                    <>
                      <TableRow
                        key={v.id}
                        className={cn(
                          idx % 2 === 1 && "bg-muted/20",
                          v.is_rca_principale && "bg-teal-50/80 dark:bg-teal-950/30 hover:bg-teal-50 font-medium",
                        )}
                      >
                        <TableCell className="flex items-center gap-2">
                          {v.is_rca_principale && <ShieldCheck className="h-4 w-4 text-teal-700" />}
                          {v.garanzia}
                          {v.is_rca_principale && <Badge className="ml-1 bg-teal-600 hover:bg-teal-700 text-[10px]">obbligatoria</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number" step="0.01" inputMode="decimal"
                            defaultValue={v.firma ?? 0}
                            onBlur={(e) => handleNettoBlur(v, Number(e.target.value || 0))}
                            className="h-8 text-right ml-auto w-32"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {v.is_rca_principale ? (
                            <span className="text-xs text-muted-foreground">{aliquotaProv}% + SSN</span>
                          ) : (
                            <Input
                              type="number" step="0.01" inputMode="decimal"
                              defaultValue={v.aliquota_tasse_pct ?? ALIQUOTA_ACCESSORIE_DEFAULT}
                              onBlur={(e) => handleAliquotaBlur(v, Number(e.target.value || 0))}
                              className="h-8 text-right ml-auto w-20"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{fmtEur(calc.lordo)}</TableCell>
                        <TableCell>
                          {v.is_rca_principale ? (
                            <span title="RCA Auto non rimovibile" className="inline-flex">
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                            </span>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => setToDelete(v)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {v.is_rca_principale && (
                        <>
                          <TableRow className="bg-muted/30 text-xs text-muted-foreground">
                            <TableCell className="pl-10">↳ Imposta provinciale ({aliquotaProv}%)</TableCell>
                            <TableCell colSpan={2}></TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{fmtEur(calc.imposta)}</TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/30 text-xs text-muted-foreground">
                            <TableCell className="pl-10">↳ Contributo SSN ({SSN_PCT}% sull'imposta)</TableCell>
                            <TableCell colSpan={2}></TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{fmtEur(calc.ssn)}</TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {voci.map((v) => {
              const calc = calcolaLordo(v, aliquotaProv);
              return (
                <div
                  key={v.id}
                  className={cn(
                    "p-3 space-y-2",
                    v.is_rca_principale && "bg-teal-50/80 dark:bg-teal-950/30 border-l-4 border-l-teal-600",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-medium text-sm min-w-0">
                      {v.is_rca_principale && <ShieldCheck className="h-4 w-4 text-teal-700 shrink-0" />}
                      <span className="truncate">{v.garanzia}</span>
                    </div>
                    {v.is_rca_principale ? (
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                        onClick={() => setToDelete(v)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-muted-foreground">
                      Premio Netto
                      <Input
                        type="number" step="0.01" inputMode="decimal"
                        defaultValue={v.firma ?? 0}
                        onBlur={(e) => handleNettoBlur(v, Number(e.target.value || 0))}
                        className="h-8 text-right mt-0.5"
                      />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      Aliquota %
                      {v.is_rca_principale ? (
                        <div className="h-8 mt-0.5 flex items-center justify-end text-xs text-muted-foreground">
                          {aliquotaProv}% + SSN
                        </div>
                      ) : (
                        <Input
                          type="number" step="0.01" inputMode="decimal"
                          defaultValue={v.aliquota_tasse_pct ?? ALIQUOTA_ACCESSORIE_DEFAULT}
                          onBlur={(e) => handleAliquotaBlur(v, Number(e.target.value || 0))}
                          className="h-8 text-right mt-0.5"
                        />
                      )}
                    </label>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t">
                    <span className="text-[11px] text-muted-foreground uppercase">Lordo</span>
                    <span className="font-mono font-semibold tabular-nums text-sm">{fmtEur(calc.lordo)}</span>
                  </div>
                  {v.is_rca_principale && (
                    <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t">
                      <div className="flex justify-between"><span>↳ Imposta {aliquotaProv}%</span><span className="font-mono">{fmtEur(calc.imposta)}</span></div>
                      <div className="flex justify-between"><span>↳ SSN {SSN_PCT}%</span><span className="font-mono">{fmtEur(calc.ssn)}</span></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 w-full sm:w-auto" disabled={catalogoDisponibile.length === 0}>
                  <Plus className="h-4 w-4" /> Aggiungi voce
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-80" align="start">
                <Command>
                  <CommandInput placeholder="Cerca garanzia…" />
                  <CommandList>
                    <CommandEmpty>Nessuna voce disponibile</CommandEmpty>
                    <CommandGroup>
                      {catalogoDisponibile.map((g: any) => (
                        <CommandItem key={g.codice} value={`${g.codice} ${g.descrizione}`} onSelect={() => addMut.mutate(g)}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">{g.codice}</span>
                          {g.descrizione}
                          {g.aliquota_tasse && <span className="ml-auto text-xs text-muted-foreground">{g.aliquota_tasse}%</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Totali */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-br from-teal-50/40 to-transparent border-t">
            <div className="rounded-lg border bg-card p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Totale Netto</p>
              <p className="text-base sm:text-xl font-bold font-mono tabular-nums">{fmtEur(totali.netto)}</p>
            </div>
            <div className="rounded-lg border bg-card p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Totale Tasse</p>
              <p className="text-base sm:text-xl font-bold font-mono tabular-nums">{fmtEur(totali.tasse)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                IPT {fmtEur(totali.imposta)} · SSN {fmtEur(totali.ssn)} · Acc. {fmtEur(totali.tasseAcc)}
              </p>
            </div>
            <div className={cn(
              "col-span-2 md:col-span-1 rounded-lg border-2 p-2 sm:p-3",
              quadra ? "border-emerald-400 bg-emerald-50/50" : "border-amber-400 bg-amber-50/50",
            )}>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                Premio Lordo
                {quadra
                  ? <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  : <AlertCircle className="h-3 w-3 text-amber-600" />}
              </p>
              <p className="text-base sm:text-xl font-bold font-mono tabular-nums text-teal-900">{fmtEur(totali.lordo)}</p>
              {premioLordoTitolo != null && !quadra && (
                <p className="text-[11px] text-amber-700 mt-1">Δ vs polizza: {fmtEur(delta)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere la voce «{toDelete?.garanzia}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa operazione elimina la voce dal calcolo del premio. La riga RCA Auto non è mai eliminabile.
              {toDelete && Number(toDelete.firma || 0) > 0 && (
                <span className="block mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  ⚠ La voce ha un premio netto di <b>{fmtEur(toDelete.firma)}</b>: rimuovendola il totale lordo si ridurrà di circa{" "}
                  <b>{fmtEur(calcolaLordo(toDelete, aliquotaProv).lordo)}</b>.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => toDelete && deleteMut.mutate(toDelete.id)}>
              Rimuovi voce
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
