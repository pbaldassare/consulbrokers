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
          <QuietanzaCard
            key={d.idx}
            draft={d}
            total={drafts.length}
            onUpdate={(patch) => updateDraft(d.idx, patch)}
            fmtDate={fmtDate}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Le quietanze vengono salvate insieme alla polizza. Puoi rieditarle anche in seguito dal dettaglio della rata.
      </p>
    </div>
  );
}
