import { useEffect, useMemo, useState } from "react";
import { Receipt, Copy, Calendar as CalendarIcon, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeQuietanzePlan, type QuietanzaPlanRow } from "@/lib/quietanzePlan";
import { toast } from "sonner";

export type QuietanzaDraft = {
  idx: number;
  garanzia_da: string;
  garanzia_a: string;
  data_competenza: string;
  data_scadenza: string;
  premio_netto: string;
  tasse: string;
  ssn: string;
  addizionali: string;
  premio_lordo: string;
  provvigioni_firma: string;
  provvigioni_quietanza: string;
};

const toNum = (s: string) => parseFloat(String(s || "").replace(",", ".")) || 0;
const fmtTotal = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function makeDraft(row: QuietanzaPlanRow, base: Partial<QuietanzaDraft>): QuietanzaDraft {
  return {
    idx: row.idx,
    garanzia_da: row.garanzia_da,
    garanzia_a: row.garanzia_a,
    data_competenza: row.data_competenza || row.garanzia_da,
    data_scadenza: row.garanzia_a,
    premio_netto: base.premio_netto ?? "",
    tasse: base.tasse ?? "",
    ssn: base.ssn ?? "",
    addizionali: base.addizionali ?? "",
    premio_lordo: "0.00",
    provvigioni_firma: base.provvigioni_firma ?? "",
    provvigioni_quietanza: base.provvigioni_quietanza ?? "",
  };
}

function recomputeLordo(d: QuietanzaDraft): QuietanzaDraft {
  const lordo = toNum(d.premio_netto) + toNum(d.tasse) + toNum(d.ssn) + toNum(d.addizionali);
  return { ...d, premio_lordo: lordo.toFixed(2) };
}

type Props = {
  frazionamento: string;
  anniDurata: number;
  garanziaDa: string;
  garanziaA: string;
  dataCompetenza: string;
  defaultsFirstRata?: Partial<QuietanzaDraft>;
  onChange: (drafts: QuietanzaDraft[]) => void;
};

/**
 * Editor card-per-rata. Calcola N quietanze da durata+frazionamento e permette
 * di editare importi/date di ognuna. La prima rata e' pre-compilata dai defaults
 * (premio netto della form padre). Pulsante "Applica rata 1 a tutte" per propagare.
 */
export function QuietanzeEditor({
  frazionamento,
  anniDurata,
  garanziaDa,
  garanziaA,
  dataCompetenza,
  defaultsFirstRata,
  onChange,
}: Props) {
  const plan = useMemo(
    () => computeQuietanzePlan({ frazionamento, anniDurata, garanziaDa, garanziaA, dataCompetenza }),
    [frazionamento, anniDurata, garanziaDa, garanziaA, dataCompetenza],
  );

  const [drafts, setDrafts] = useState<QuietanzaDraft[]>([]);

  useEffect(() => {
    setDrafts((prev) => {
      return plan.map((row, i) => {
        const existing = prev.find((p) => p.idx === row.idx);
        if (existing) {
          return recomputeLordo({
            ...existing,
            garanzia_da: row.garanzia_da,
            garanzia_a: row.garanzia_a,
            data_competenza: row.data_competenza || existing.data_competenza,
            data_scadenza: row.garanzia_a,
          });
        }
        const base = i === 0 ? defaultsFirstRata || {} : {};
        return recomputeLordo(makeDraft(row, base));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  useEffect(() => {
    onChange(drafts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts]);

  if (plan.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
        Compila <b>Garanzia Da/A</b>, <b>Frazionamento</b> e <b>Anni Durata</b> per vedere le quietanze.
      </div>
    );
  }

  const updateDraft = (idx: number, patch: Partial<QuietanzaDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.idx === idx ? recomputeLordo({ ...d, ...patch }) : d)));
  };

  const applyFirstToAll = () => {
    if (drafts.length < 2) return;
    const first = drafts[0];
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i === 0) return d;
        return recomputeLordo({
          ...d,
          premio_netto: first.premio_netto,
          tasse: first.tasse,
          ssn: first.ssn,
          addizionali: first.addizionali,
          provvigioni_firma: first.provvigioni_firma,
          provvigioni_quietanza: first.provvigioni_quietanza,
        });
      }),
    );
    toast.success(`Importi della rata 1 applicati alle altre ${drafts.length - 1} rate`);
  };

  const totLordo = drafts.reduce((s, d) => s + toNum(d.premio_lordo), 0);
  const totProvF = drafts.reduce((s, d) => s + toNum(d.provvigioni_firma), 0);
  const totProvQ = drafts.reduce((s, d) => s + toNum(d.provvigioni_quietanza), 0);

  const fmtDate = (s: string) => {
    if (!s) return "—";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border border-quietanza/40 bg-quietanza/10 p-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4" />
          <span className="font-semibold">
            {drafts.length} quietanz{drafts.length === 1 ? "a" : "e"} da creare
          </span>
        </div>
        <div>Lordo totale: <b className="tabular-nums">€ {fmtTotal(totLordo)}</b></div>
        <div>Provv. firma: <b className="tabular-nums">€ {fmtTotal(totProvF)}</b></div>
        <div>Provv. quietanza: <b className="tabular-nums">€ {fmtTotal(totProvQ)}</b></div>
        {drafts.length > 1 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto h-7 text-xs"
            onClick={applyFirstToAll}
          >
            <Copy className="w-3 h-3 mr-1" /> Applica rata 1 a tutte
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {drafts.map((d) => (
          <Card key={d.idx} className="border-l-4 border-l-quietanza/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                <Badge variant="outline">Rata {d.idx}/{drafts.length}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {fmtDate(d.garanzia_da)} → {fmtDate(d.garanzia_a)}
                </span>
                <span className="ml-auto text-xs tabular-nums">
                  € <b>{fmtTotal(toNum(d.premio_lordo))}</b>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Garanzia Da</Label>
                  <Input type="date" value={d.garanzia_da} onChange={(e) => updateDraft(d.idx, { garanzia_da: e.target.value })} className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Garanzia A</Label>
                  <Input type="date" value={d.garanzia_a} onChange={(e) => updateDraft(d.idx, { garanzia_a: e.target.value, data_scadenza: e.target.value })} className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Competenza</Label>
                  <Input type="date" value={d.data_competenza} onChange={(e) => updateDraft(d.idx, { data_competenza: e.target.value })} className="h-7 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Scadenza</Label>
                  <Input type="date" value={d.data_scadenza} onChange={(e) => updateDraft(d.idx, { data_scadenza: e.target.value })} className="h-7 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1 border-t">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Netto</Label>
                  <Input type="number" step="0.01" value={d.premio_netto} onChange={(e) => updateDraft(d.idx, { premio_netto: e.target.value })} className="h-7 text-xs text-right tabular-nums" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Tasse</Label>
                  <Input type="number" step="0.01" value={d.tasse} onChange={(e) => updateDraft(d.idx, { tasse: e.target.value })} className="h-7 text-xs text-right tabular-nums" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">SSN</Label>
                  <Input type="number" step="0.01" value={d.ssn} onChange={(e) => updateDraft(d.idx, { ssn: e.target.value })} className="h-7 text-xs text-right tabular-nums" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Addiz.</Label>
                  <Input type="number" step="0.01" value={d.addizionali} onChange={(e) => updateDraft(d.idx, { addizionali: e.target.value })} className="h-7 text-xs text-right tabular-nums" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Provv. Firma</Label>
                  <Input type="number" step="0.01" value={d.provvigioni_firma} onChange={(e) => updateDraft(d.idx, { provvigioni_firma: e.target.value })} className="h-7 text-xs text-right tabular-nums" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Provv. Quietanza</Label>
                  <Input type="number" step="0.01" value={d.provvigioni_quietanza} onChange={(e) => updateDraft(d.idx, { provvigioni_quietanza: e.target.value })} className="h-7 text-xs text-right tabular-nums" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Le quietanze vengono salvate insieme alla polizza. Puoi rieditarle anche in seguito dal dettaglio della rata.
      </p>
    </div>
  );
}
