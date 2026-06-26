import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import {
  emptyRipartoRow,
  parseQuotaPercentuale,
  type RipartoCoassicurazioneRow,
} from "@/lib/coassicurazione";
import { cn } from "@/lib/utils";

interface CompagniaItem {
  id: string;
  nome?: string | null;
  codice?: string | null;
  tipo?: string | null;
  gruppo_compagnia_id?: string | null;
  gruppo_compagnia?: string | null;
}

interface GruppoCompagniaItem {
  id: string;
  codice?: string | null;
  nome?: string | null;
}

export interface CoassicurazioneContrattoPanelProps {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  rows: RipartoCoassicurazioneRow[];
  onRowsChange: (rows: RipartoCoassicurazioneRow[]) => void;
  compagnieList: CompagniaItem[];
  gruppiCompagniaList: GruppoCompagniaItem[];
  brokerPluriPerGruppo: string[];
  rapportiMap: Map<string, string[]>;
}

function isBrokerLike(tipo: string) {
  const t = tipo.toLowerCase();
  return t === "broker" || t === "plurimandataria";
}

export function CoassicurazioneContrattoPanel({
  enabled,
  onEnabledChange,
  rows,
  onRowsChange,
  compagnieList,
  gruppiCompagniaList,
  brokerPluriPerGruppo,
  rapportiMap,
}: CoassicurazioneContrattoPanelProps) {
  const { data: allRapporti = [] } = useQuery({
    queryKey: ["compagnia_rapporti_coassicurazione"],
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnia_rapporti")
        .select("id, compagnia_id, gruppo_compagnia_id, codice_rapporto, nome_rapporto, tipo_rapporto, attivo")
        .eq("attivo", true);
      return data || [];
    },
    staleTime: 60_000,
  });

  const quotaSum = useMemo(
    () => rows.reduce((s, r) => s + parseQuotaPercentuale(r.quotaPercentuale), 0),
    [rows],
  );
  const quotaOk = Math.abs(quotaSum - 100) <= 0.01;

  const updateRow = (idx: number, patch: Partial<RipartoCoassicurazioneRow>) => {
    onRowsChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const rapportiForRow = (row: RipartoCoassicurazioneRow) => {
    if (!row.compagniaId || !row.gruppoCompagniaId) return [];
    return (allRapporti as any[]).filter(
      (r) =>
        r.compagnia_id === row.compagniaId &&
        r.gruppo_compagnia_id === row.gruppoCompagniaId &&
        r.attivo !== false,
    );
  };

  const agenziaOptionsForRow = (row: RipartoCoassicurazioneRow) =>
    (compagnieList || [])
      .filter((c) => {
        const tipo = (c.tipo || "").toLowerCase();
        if (row.gruppoCompagniaId) {
          if (tipo === "agenzia" || tipo === "direzione") {
            return c.gruppo_compagnia_id === row.gruppoCompagniaId;
          }
          if (isBrokerLike(tipo)) {
            return (brokerPluriPerGruppo || []).includes(c.id);
          }
          return false;
        }
        return tipo === "agenzia" || tipo === "direzione" || isBrokerLike(tipo);
      })
      .map((c) => {
        const tipo = (c.tipo || "").toLowerCase();
        const tipoLabel = tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : "";
        return {
          value: c.id,
          label: `${c.codice || ""} - ${c.nome || ""}`,
          description: tipoLabel,
          searchText: `${c.tipo || ""} ${c.gruppo_compagnia || ""}`,
        };
      });

  const gruppoOptionsForRow = (row: RipartoCoassicurazioneRow) => {
    const ag = (compagnieList || []).find((c) => c.id === row.compagniaId);
    const tipoSel = (ag?.tipo || "").toLowerCase();
    let allowed: string[] | null = null;
    if (ag && isBrokerLike(tipoSel)) {
      allowed = rapportiMap?.get(row.compagniaId) || [];
    }
    return (gruppiCompagniaList || [])
      .filter((g) => !allowed || allowed.includes(g.id))
      .map((g) => ({
        value: g.id,
        label: g.nome || g.codice || "—",
      }));
  };

  return (
    <div className="space-y-3 rounded-md border border-teal-200/80 bg-teal-50/30 dark:bg-teal-950/10 p-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="coassicurazione-flag"
          checked={enabled}
          onCheckedChange={(v) => {
            const on = v === true;
            onEnabledChange(on);
            if (on && rows.length === 0) {
              onRowsChange([emptyRipartoRow(), emptyRipartoRow()]);
            }
          }}
        />
        <Label htmlFor="coassicurazione-flag" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-teal-700" />
          Coassicurazione
        </Label>
        {enabled && (
          <span
            className={cn(
              "ml-auto text-[11px] font-mono font-semibold px-2 py-0.5 rounded",
              quotaOk
                ? "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
            )}
          >
            Somma quote: {quotaSum.toFixed(2)}%
          </span>
        )}
      </div>

      {enabled && (
        <>
          <p className="text-[11px] text-muted-foreground">
            Ripartisci il premio tra più compagnie/agenzie. La prima riga è il <strong>leader</strong> (compagnia principale del titolo).
            Le quote devono sommare esattamente <strong>100%</strong>.
          </p>
          <div className="overflow-x-auto rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs min-w-[160px]">Compagnia Assicurativa</TableHead>
                  <TableHead className="text-xs min-w-[180px]">Agenzia</TableHead>
                  <TableHead className="text-xs min-w-[140px]">Rapporto</TableHead>
                  <TableHead className="text-xs w-24 text-right">Quota %</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  const ag = (compagnieList || []).find((c) => c.id === row.compagniaId);
                  const brokerRow = isBrokerLike(ag?.tipo || "");
                  const rapporti = rapportiForRow(row);
                  return (
                    <TableRow key={row.localId}>
                      <TableCell className="py-1.5">
                        {idx === 0 && (
                          <span className="text-[9px] uppercase font-bold text-teal-700 block mb-0.5">Leader</span>
                        )}
                        <SearchableSelect
                          className="h-8 text-xs"
                          value={row.gruppoCompagniaId}
                          onValueChange={(v) => {
                            updateRow(idx, { gruppoCompagniaId: v, rapportoId: "" });
                          }}
                          placeholder="— Compagnia —"
                          options={gruppoOptionsForRow(row)}
                        />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <SearchableSelect
                          className="h-8 text-xs"
                          value={row.compagniaId}
                          onValueChange={(v) => {
                            const agSel = (compagnieList || []).find((c) => c.id === v);
                            const tipo = (agSel?.tipo || "").toLowerCase();
                            let gruppo = row.gruppoCompagniaId;
                            if ((tipo === "agenzia" || tipo === "direzione") && agSel?.gruppo_compagnia_id) {
                              gruppo = agSel.gruppo_compagnia_id;
                            } else if (isBrokerLike(tipo)) {
                              const gruppi = rapportiMap?.get(v) || [];
                              if (gruppi.length === 1) gruppo = gruppi[0];
                              else if (gruppi.length > 1 && gruppo && !gruppi.includes(gruppo)) gruppo = "";
                            }
                            updateRow(idx, {
                              compagniaId: v,
                              gruppoCompagniaId: gruppo,
                              rapportoId: "",
                            });
                          }}
                          placeholder="— Agenzia —"
                          options={agenziaOptionsForRow(row)}
                        />
                      </TableCell>
                      <TableCell className="py-1.5">
                        {brokerRow && row.compagniaId && row.gruppoCompagniaId ? (
                          rapporti.length === 0 ? (
                            <span className="text-[10px] text-destructive">Nessun rapporto</span>
                          ) : rapporti.length === 1 ? (
                            <span className="text-xs text-muted-foreground">
                              {rapporti[0].nome_rapporto || rapporti[0].codice_rapporto || "—"}
                            </span>
                          ) : (
                            <SearchableSelect
                              className={cn("h-8 text-xs", !row.rapportoId && "ring-1 ring-amber-500")}
                              value={row.rapportoId}
                              onValueChange={(v) => updateRow(idx, { rapportoId: v })}
                              placeholder="— Rapporto —"
                              options={rapporti.map((r: any) => ({
                                value: r.id,
                                label: r.nome_rapporto || r.codice_rapporto || "—",
                                description: [r.tipo_rapporto, r.codice_rapporto].filter(Boolean).join(" · ") || undefined,
                              }))}
                            />
                          )
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-8 text-xs font-mono text-right"
                          value={row.quotaPercentuale}
                          onChange={(e) => updateRow(idx, { quotaPercentuale: e.target.value })}
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={rows.length <= 1}
                          onClick={() => onRowsChange(rows.filter((_, i) => i !== idx))}
                          aria-label="Rimuovi coassicuratore"
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs border-teal-300 text-teal-800 hover:bg-teal-50"
            onClick={() => onRowsChange([...rows, emptyRipartoRow()])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi coassicuratore
          </Button>
        </>
      )}
    </div>
  );
}

export default CoassicurazioneContrattoPanel;
