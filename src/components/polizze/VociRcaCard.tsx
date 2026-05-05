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
import { Car, Plus, Trash2, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fmtEur = (n: number | null | undefined) =>
  n == null || isNaN(Number(n))
    ? "—"
    : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(Number(n));

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
}

const RCA_LABEL = "RCA Auto";
const RCA_CODE = "RCA";
const SSN_PCT = 10.5;
const ALIQUOTA_ACCESSORIE_DEFAULT = 22.25;

function calcolaLordo(v: { firma: number | null; aliquota_tasse_pct: number | null; is_rca_principale: boolean }, aliquotaProv: number) {
  const netto = Number(v.firma || 0);
  if (v.is_rca_principale) {
    const imposta = netto * (aliquotaProv / 100);
    const ssn = imposta * (SSN_PCT / 100);
    return { lordo: netto + imposta + ssn, imposta, ssn };
  }
  const aliq = Number(v.aliquota_tasse_pct ?? ALIQUOTA_ACCESSORIE_DEFAULT);
  return { lordo: netto * (1 + aliq / 100), imposta: 0, ssn: 0 };
}

export function VociRcaCard({ titoloId, premioLordoTitolo, provinciaCliente }: {
  titoloId: string;
  premioLordoTitolo?: number | null;
  provinciaCliente?: string | null;
}) {
  const qc = useQueryClient();
  const [aliquotaProv, setAliquotaProv] = useState<number>(16);

  // Carica aliquota provinciale
  useEffect(() => {
    if (!provinciaCliente) return;
    supabase.from("aliquote_provinciali_rca" as any)
      .select("aliquota_pct")
      .eq("provincia", provinciaCliente.toUpperCase())
      .maybeSingle()
      .then(({ data }: any) => { if (data?.aliquota_pct) setAliquotaProv(Number(data.aliquota_pct)); });
  }, [provinciaCliente]);

  const { data: voci = [], isLoading } = useQuery({
    queryKey: ["voci-rca", titoloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("premi_garanzia_polizza" as any)
        .select("*")
        .eq("titolo_id", titoloId)
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

  // Auto-crea riga RCA se mancante
  useEffect(() => {
    if (isLoading) return;
    const hasRca = voci.some((v) => v.is_rca_principale);
    if (!hasRca) {
      supabase.from("premi_garanzia_polizza" as any).insert({
        titolo_id: titoloId,
        garanzia: RCA_LABEL,
        codice_garanzia: RCA_CODE,
        is_rca_principale: true,
        firma: 0,
        ordine: 0,
      }).then(() => qc.invalidateQueries({ queryKey: ["voci-rca", titoloId] }));
    }
  }, [isLoading, voci, titoloId, qc]);

  const upsertMut = useMutation({
    mutationFn: async (v: Partial<Voce> & { id: string }) => {
      const { id, ...rest } = v;
      const { error } = await supabase.from("premi_garanzia_polizza" as any).update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voci-rca", titoloId] }),
    onError: (e: any) => toast.error("Salvataggio fallito: " + e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("premi_garanzia_polizza" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voci-rca", titoloId] });
      toast.success("Voce rimossa");
    },
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voci-rca", titoloId] });
      toast.success("Voce aggiunta");
    },
  });

  // Persisti aliquota_tasse_pct/lordo/imposta/ssn quando cambiano i dati
  const handleNettoBlur = (v: Voce, value: number) => {
    const calc = calcolaLordo({ ...v, firma: value }, aliquotaProv);
    upsertMut.mutate({
      id: v.id,
      firma: value,
      lordo_calcolato: Number(calc.lordo.toFixed(2)),
      imposta_provinciale: v.is_rca_principale ? Number(calc.imposta.toFixed(2)) : null,
      ssn: v.is_rca_principale ? Number(calc.ssn.toFixed(2)) : null,
    });
  };

  const handleAliquotaBlur = (v: Voce, value: number) => {
    const calc = calcolaLordo({ ...v, aliquota_tasse_pct: value }, aliquotaProv);
    upsertMut.mutate({
      id: v.id,
      aliquota_tasse_pct: value,
      lordo_calcolato: Number(calc.lordo.toFixed(2)),
    });
  };

  const handleAliquotaProvChange = (val: number) => {
    setAliquotaProv(val);
    const rca = voci.find((v) => v.is_rca_principale);
    if (rca) {
      const calc = calcolaLordo(rca, val);
      upsertMut.mutate({
        id: rca.id,
        lordo_calcolato: Number(calc.lordo.toFixed(2)),
        imposta_provinciale: Number(calc.imposta.toFixed(2)),
        ssn: Number(calc.ssn.toFixed(2)),
      });
    }
  };

  const totali = useMemo(() => {
    let netto = 0, lordo = 0;
    voci.forEach((v) => {
      const c = calcolaLordo(v, aliquotaProv);
      netto += Number(v.firma || 0);
      lordo += c.lordo;
    });
    return { netto, lordo, tasse: lordo - netto };
  }, [voci, aliquotaProv]);

  const codiciPresenti = new Set(voci.map((v) => (v.codice_garanzia || "").toUpperCase()));
  const catalogoDisponibile = (catalogo as any[]).filter(
    (g) => !codiciPresenti.has(String(g.codice).toUpperCase()) && String(g.codice).toUpperCase() !== RCA_CODE
  );

  const quadra = premioLordoTitolo == null || Math.abs(totali.lordo - Number(premioLordoTitolo)) < 0.5;

  return (
    <Card className="border-l-4 border-l-teal-600 shadow-sm">
      <CardHeader className="bg-teal-50/60 dark:bg-teal-950/20 border-b">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-teal-900 dark:text-teal-100">
            <Car className="h-5 w-5" />
            Composizione Premio RCA Auto
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Aliquota imposta provinciale:</span>
            <Input
              type="number"
              step="0.01"
              className="h-8 w-20 text-right"
              defaultValue={aliquotaProv}
              onBlur={(e) => handleAliquotaProvChange(Number(e.target.value || 0))}
            />
            <span className="text-muted-foreground">%</span>
            {provinciaCliente && <Badge variant="outline" className="text-xs">prov. {provinciaCliente}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
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
                      v.is_rca_principale && "bg-teal-50/80 dark:bg-teal-950/30 hover:bg-teal-50 font-medium"
                    )}
                  >
                    <TableCell className="flex items-center gap-2">
                      {v.is_rca_principale && <ShieldCheck className="h-4 w-4 text-teal-700" />}
                      {v.garanzia}
                      {v.is_rca_principale && <Badge className="ml-1 bg-teal-600 hover:bg-teal-700 text-[10px]">obbligatoria</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
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
                          type="number"
                          step="0.01"
                          defaultValue={v.aliquota_tasse_pct ?? ALIQUOTA_ACCESSORIE_DEFAULT}
                          onBlur={(e) => handleAliquotaBlur(v, Number(e.target.value || 0))}
                          className="h-8 text-right ml-auto w-20"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {fmtEur(calc.lordo)}
                    </TableCell>
                    <TableCell>
                      {!v.is_rca_principale && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(v.id)}>
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

        <div className="p-3 border-t">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1" disabled={catalogoDisponibile.length === 0}>
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
                      <CommandItem
                        key={g.codice}
                        value={`${g.codice} ${g.descrizione}`}
                        onSelect={() => addMut.mutate(g)}
                      >
                        <span className="font-mono text-xs text-muted-foreground mr-2">{g.codice}</span>
                        {g.descrizione}
                        {g.aliquota_tasse && (
                          <span className="ml-auto text-xs text-muted-foreground">{g.aliquota_tasse}%</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Totali */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-gradient-to-br from-teal-50/40 to-transparent border-t">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Totale Netto</p>
            <p className="text-xl font-bold font-mono tabular-nums">{fmtEur(totali.netto)}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Totale Tasse</p>
            <p className="text-xl font-bold font-mono tabular-nums">{fmtEur(totali.tasse)}</p>
          </div>
          <div className={cn("rounded-lg border-2 p-3", quadra ? "border-emerald-400 bg-emerald-50/50" : "border-amber-400 bg-amber-50/50")}>
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              Premio Lordo
              {quadra ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <AlertCircle className="h-3 w-3 text-amber-600" />}
            </p>
            <p className="text-xl font-bold font-mono tabular-nums text-teal-900">{fmtEur(totali.lordo)}</p>
            {premioLordoTitolo != null && !quadra && (
              <p className="text-[11px] text-amber-700 mt-1">
                Δ vs polizza: {fmtEur(totali.lordo - Number(premioLordoTitolo))}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
