import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Percent, Copy, ClipboardPaste, Upload, Sparkles, Save, Plus, Trash2, Download,
  ChevronDown, ChevronRight, Search, ChevronLeft, ChevronsUpDown, Wand2, RotateCcw,
  AlertCircle, FileText, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import RamiAbilitatiEditor from "./RamiAbilitatiEditor";

const TIPI_RAPPORTO = ["Direzione", "Agenzia", "Broker", "Plurimandataria", "Mandato diretto", "Sub-agenzia", "Convenzione broker", "Coverholder", "Altro"];
const LS_KEY = "provv-rapporti-ui-v1";
type FilterStato = "all" | "configured" | "missing" | "only_default";


type Props = {
  /** Se valorizzato, il componente si "blocca" su un singolo rapporto:
   *  nasconde l'elenco rapporti, il selettore prev/next e non persiste su localStorage. */
  fixedRapportoId?: string;
};

export default function ProvvigioniRapportiTab({ fixedRapportoId }: Props = {}) {
  const qc = useQueryClient();
  const isFixed = !!fixedRapportoId;
  // Stato UI (con persistenza localStorage solo in modalità globale)
  const persisted = useMemo(() => {
    if (isFixed) return {} as any;
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
  }, [isFixed]);
  const [rapportoIdState, setRapportoIdState] = useState<string>(persisted.rapportoId || "");
  const rapportoId = isFixed ? (fixedRapportoId as string) : rapportoIdState;
  const setRapportoId = (v: string) => { if (!isFixed) setRapportoIdState(v); };
  const [pasteOpen, setPasteOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [search, setSearch] = useState<string>("");
  const [filterStato, setFilterStato] = useState<FilterStato>(persisted.filterStato || "all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(persisted.expanded || {});
  const [bulkConfirm, setBulkConfirm] = useState<{ kind: "apply" | "reset"; gruppoId: string; perc?: number; overwrite?: boolean } | null>(null);

  useEffect(() => {
    if (isFixed) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ rapportoId, filterStato, expanded }));
    } catch {}
  }, [isFixed, rapportoId, filterStato, expanded]);


  // Rapporti elenco
  const { data: rapporti = [] } = useQuery({
    queryKey: ["all-compagnia-rapporti"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnia_rapporti")
        .select("id, nome_rapporto, tipo_rapporto, attivo, compagnia_id, gruppo_compagnia_id, compagnie(nome), gruppi_compagnia(descrizione)")
        .eq("attivo", true)
        .order("nome_rapporto");
      if (error) throw error;
      return data || [];
    },
  });

  const rapportoOptions = useMemo(
    () =>
      rapporti.map((r: any) => ({
        value: r.id,
        label: `${r.gruppi_compagnia?.descrizione || "?"} — ${r.nome_rapporto}${r.compagnie?.nome ? ` (${r.compagnie.nome})` : ""} · ${r.tipo_rapporto || "—"}`,
      })),
    [rapporti]
  );

  // Aggregato: conteggio righe provvigione attive per rapporto (per pannello "Elenco rapporti")
  const { data: provvCountByRapporto = {} } = useQuery({
    queryKey: ["provv-count-by-rapporto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("compagnia_rapporto_id")
        .eq("attiva", true);
      if (error) throw error;
      const m: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        if (!r.compagnia_rapporto_id) return;
        m[r.compagnia_rapporto_id] = (m[r.compagnia_rapporto_id] || 0) + 1;
      });
      return m;
    },
  });

  const rapportoSelected = rapporti.find((r: any) => r.id === rapportoId) as any;

  // Gruppi ramo + rami (sottorami)
  const { data: gruppiRamo = [] } = useQuery({
    queryKey: ["gruppi-ramo-all"],
    queryFn: async () => {
      const { data } = await supabase.from("gruppi_ramo").select("id, codice, descrizione").eq("attivo", true).order("codice");
      return data || [];
    },
  });
  const { data: rami = [] } = useQuery({
    queryKey: ["rami-all"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione, gruppo_ramo_id").eq("attivo", true).order("codice");
      return data || [];
    },
  });

  // Rami abilitati per il rapporto selezionato (compagnia_rapporto_rami)
  const { data: ramiAbilitati = [] } = useQuery({
    queryKey: ["rapporto-rami-abilitati", rapportoId],
    enabled: !!rapportoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnia_rapporto_rami" as any)
        .select("gruppo_ramo_id, ramo_id")
        .eq("rapporto_id", rapportoId);
      if (error) throw error;
      return ((data || []) as unknown) as { gruppo_ramo_id: string; ramo_id: string | null }[];
    },
  });
  // Set di gruppi abilitati + map sottorami specifici per gruppo
  const enabledGruppoIds = new Set<string>(ramiAbilitati.map((x) => x.gruppo_ramo_id));
  const specificSottoByGruppo: Record<string, Set<string>> = {};
  const gruppoHasAll: Record<string, boolean> = {};
  ramiAbilitati.forEach((x) => {
    if (x.ramo_id === null) gruppoHasAll[x.gruppo_ramo_id] = true;
    else {
      specificSottoByGruppo[x.gruppo_ramo_id] = specificSottoByGruppo[x.gruppo_ramo_id] || new Set();
      specificSottoByGruppo[x.gruppo_ramo_id].add(x.ramo_id);
    }
  });

  // Provvigioni del rapporto selezionato
  const { data: provvigioni = [], refetch: refetchProvv } = useQuery({
    queryKey: ["provv-rapporto", rapportoId],
    enabled: !!rapportoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("id, gruppo_ramo_id, ramo_id, percentuale_provvigione")
        .eq("compagnia_rapporto_id", rapportoId)
        .eq("attiva", true);
      if (error) throw error;
      return data || [];
    },
  });

  const provvMap = useMemo(() => {
    const m: Record<string, { id: string; perc: number }> = {};
    provvigioni.forEach((p: any) => {
      const key = `${p.gruppo_ramo_id || ""}|${p.ramo_id || ""}`;
      m[key] = { id: p.id, perc: Number(p.percentuale_provvigione) };
    });
    return m;
  }, [provvigioni]);

  // Default tipo rapporto
  const { data: defaultTipo = [] } = useQuery({
    queryKey: ["provv-default-tipo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("provvigioni_default_tipo" as any)
        .select("id, tipo_rapporto, gruppo_ramo_id, ramo_id, percentuale")
        .eq("attiva", true);
      return data || [];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (rows: { gruppo_ramo_id: string; ramo_id: string | null; percentuale: number; id?: string }[]) => {
      if (!rapportoId) throw new Error("Seleziona un rapporto");
      if (!rows.length) return { inserted: 0, updated: 0 };

      // Split UPDATE vs INSERT — no .upsert() to avoid PostgREST onConflict
      // limitation (we only have a PARTIAL unique index, not a constraint).
      const toUpdate = rows.filter((r) => !!r.id);
      const toInsert = rows.filter((r) => !r.id);

      const updates = await Promise.all(
        toUpdate.map((r) =>
          supabase
            .from("provvigioni_compagnia_ramo")
            .update({ percentuale_provvigione: r.percentuale, attiva: true } as any)
            .eq("id", r.id!)
        )
      );
      const updErr = updates.find((u) => u.error)?.error;
      if (updErr) throw updErr;

      if (toInsert.length) {
        const payload = toInsert.map((r) => ({
          compagnia_rapporto_id: rapportoId,
          compagnia_id: rapportoSelected?.compagnia_id,
          gruppo_ramo_id: r.gruppo_ramo_id,
          ramo_id: r.ramo_id,
          percentuale_provvigione: r.percentuale,
          attiva: true,
        }));
        const { error } = await (supabase.from("provvigioni_compagnia_ramo") as any).insert(payload);
        if (error) throw error;
      }
      return { inserted: toInsert.length, updated: toUpdate.length };
    },
    onSuccess: (res: any) => {
      const n = (res?.inserted || 0) + (res?.updated || 0);
      toast.success(n > 1 ? `Salvate ${n} righe` : "Salvato");
      qc.invalidateQueries({ queryKey: ["provv-rapporto", rapportoId] });
      qc.invalidateQueries({ queryKey: ["provv-count-by-rapporto"] });
    },
    onError: (e: any) => toast.error(e?.message || "Errore nel salvataggio"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("provvigioni_compagnia_ramo").update({ attiva: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rimosso");
      qc.invalidateQueries({ queryKey: ["provv-rapporto", rapportoId] });
    },
  });

  const exportCsv = () => {
    if (!rapportoSelected) return;
    const lines = ["ramo;sottoramo;percentuale"];
    gruppiRamo.forEach((gr: any) => {
      const def = provvMap[`${gr.id}|`];
      if (def) lines.push(`${gr.descrizione};;${def.perc}`);
      rami
        .filter((r: any) => r.gruppo_ramo_id === gr.id)
        .forEach((r: any) => {
          const ex = provvMap[`${gr.id}|${r.id}`];
          if (ex) lines.push(`${gr.descrizione};${r.descrizione};${ex.perc}`);
        });
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `provvigioni-${rapportoSelected.nome_rapporto}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper: % ereditata dal tipo rapporto per un gruppo (livello 4)
  const inheritedFromTipo = (gruppoId: string, ramoId: string | null = null) => {
    const tipo = rapportoSelected?.tipo_rapporto;
    if (!tipo) return null;
    const rows = (defaultTipo as any[]).filter((d) => d.tipo_rapporto === tipo && d.gruppo_ramo_id === gruppoId);
    const exact = ramoId ? rows.find((r) => r.ramo_id === ramoId) : null;
    const def = rows.find((r) => r.ramo_id === null);
    const hit = exact || def;
    return hit ? Number(hit.percentuale) : null;
  };

  // Lista gruppi visibili (abilitati + filtro testo + filtro stato)
  const gruppiVisibili = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (gruppiRamo as any[])
      .filter((gr) => enabledGruppoIds.has(gr.id))
      .map((gr) => {
        const allSotto = (rami as any[]).filter((r) => r.gruppo_ramo_id === gr.id);
        const sottorami = gruppoHasAll[gr.id]
          ? allSotto
          : allSotto.filter((r) => specificSottoByGruppo[gr.id]?.has(r.id));
        const defaultRow = provvMap[`${gr.id}|`];
        const configuredCount = sottorami.filter((s) => provvMap[`${gr.id}|${s.id}`]).length;
        return { gr, sottorami, defaultRow, configuredCount };
      })
      .filter(({ gr, sottorami, defaultRow, configuredCount }) => {
        if (q) {
          const grMatch = gr.descrizione?.toLowerCase().includes(q) || gr.codice?.toLowerCase().includes(q);
          const sottoMatch = sottorami.some(
            (s: any) => s.descrizione?.toLowerCase().includes(q) || s.codice?.toLowerCase().includes(q)
          );
          if (!grMatch && !sottoMatch) return false;
        }
        if (filterStato === "configured") return !!defaultRow || configuredCount > 0;
        if (filterStato === "missing") return !defaultRow && configuredCount === 0;
        if (filterStato === "only_default") return !!defaultRow && configuredCount === 0;
        return true;
      });
  }, [gruppiRamo, rami, enabledGruppoIds, gruppoHasAll, specificSottoByGruppo, provvMap, search, filterStato]);

  const totals = useMemo(() => {
    const totSotto = gruppiVisibili.reduce((acc, g) => acc + g.sottorami.length, 0);
    const totConf = gruppiVisibili.reduce((acc, g) => acc + g.configuredCount + (g.defaultRow ? 1 : 0), 0);
    return { gruppi: gruppiVisibili.length, sottorami: totSotto, configurati: totConf };
  }, [gruppiVisibili]);

  // Espandi/collassa
  const setAllExpanded = (v: boolean) => {
    const next: Record<string, boolean> = {};
    gruppiVisibili.forEach(({ gr }) => { next[gr.id] = v; });
    setExpanded((prev) => ({ ...prev, ...next }));
  };
  const isExpanded = (grId: string, defaultOpen: boolean) =>
    expanded[grId] === undefined ? defaultOpen : expanded[grId];

  // Bulk-apply su gruppo: scrive la stessa % a tutti i sottorami abilitati
  const doBulkApply = (gruppoId: string, perc: number, overwrite: boolean) => {
    const g = gruppiVisibili.find((x) => x.gr.id === gruppoId);
    if (!g) return;
    const rows = g.sottorami
      .filter((s: any) => overwrite || !provvMap[`${gruppoId}|${s.id}`])
      .map((s: any) => ({
        id: provvMap[`${gruppoId}|${s.id}`]?.id,
        gruppo_ramo_id: gruppoId,
        ramo_id: s.id,
        percentuale: perc,
      }));
    if (rows.length === 0) { toast.info("Nessuna riga da aggiornare"); return; }
    upsertMutation.mutate(rows);
  };

  // Bulk-reset: rimuove tutti gli override sui sottorami del gruppo
  const doBulkReset = (gruppoId: string) => {
    const g = gruppiVisibili.find((x) => x.gr.id === gruppoId);
    if (!g) return;
    const ids = g.sottorami
      .map((s: any) => provvMap[`${gruppoId}|${s.id}`]?.id)
      .filter(Boolean) as string[];
    if (ids.length === 0) { toast.info("Nessun override da rimuovere"); return; }
    Promise.all(ids.map((id) => deleteMutation.mutateAsync(id))).then(() =>
      toast.success(`${ids.length} override rimossi`)
    );
  };

  // Navigazione rapporto prev/next
  const currentIdx = rapportoOptions.findIndex((o) => o.value === rapportoId);
  const goRapporto = (delta: number) => {
    if (!rapportoOptions.length) return;
    const next = (currentIdx + delta + rapportoOptions.length) % rapportoOptions.length;
    setRapportoId(rapportoOptions[next].value);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Catena di risoluzione (collassabile) */}
        <Accordion type="single" collapsible>
          <AccordionItem value="chain" className="border-primary/30 border rounded-md bg-primary/5 px-3">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" />Catena di risoluzione della % provvigione (5 livelli)
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-0.5 pb-2">
                <li>Match esatto <b>Rapporto + Gruppo Ramo + Garanzia</b></li>
                <li>Default di <b>Gruppo Ramo</b> sul rapporto</li>
                <li><b>% globale del rapporto</b> (<code>compagnia_rapporti</code>)</li>
                <li>Default per <b>Tipo rapporto + Gruppo Ramo/Garanzia</b></li>
                <li>Se nessuna regola → <b>0%</b> + warning</li>
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Default tipo rapporto */}
        <Accordion type="single" collapsible>
          <AccordionItem value="def">
            <AccordionTrigger className="text-sm font-medium">
              <span className="flex items-center gap-2"><Percent className="w-4 h-4" />Default globali per tipo rapporto ({defaultTipo.length})</span>
            </AccordionTrigger>
            <AccordionContent>
              <DefaultTipoEditor rows={defaultTipo} gruppiRamo={gruppiRamo} rami={rami} onChanged={() => qc.invalidateQueries({ queryKey: ["provv-default-tipo"] })} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Elenco rapporti attivi (collassabile) — nascosto in modalità rapporto-fisso */}
        {!isFixed && (
        <Accordion type="single" collapsible>
          <AccordionItem value="elenco" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                <Percent className="w-4 h-4" />
                Elenco Agenzie e provvigioni attive ({rapporti.length})
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Compagnia</TableHead>
                      <TableHead>Rapporto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Righe %</TableHead>
                      <TableHead className="text-right">Azione</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rapporti.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-4">
                          Nessun rapporto attivo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (rapporti as any[]).map((r) => {
                        const count = provvCountByRapporto[r.id] || 0;
                        return (
                          <TableRow
                            key={r.id}
                            className={`cursor-pointer ${rapportoId === r.id ? "bg-primary/10" : ""}`}
                            onClick={() => setRapportoId(r.id)}
                          >
                            <TableCell className="text-sm">{r.gruppi_compagnia?.descrizione || "—"}</TableCell>
                            <TableCell className="text-sm font-medium">
                              {r.nome_rapporto}
                              {r.compagnie?.nome ? (
                                <span className="text-muted-foreground"> · {r.compagnie.nome}</span>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{r.tipo_rapporto || "—"}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {count > 0 ? (
                                <Badge variant="default">{count}</Badge>
                              ) : (
                                <Badge variant="secondary">0</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={rapportoId === r.id ? "default" : "outline"}
                                onClick={(e) => { e.stopPropagation(); setRapportoId(r.id); }}
                              >
                                Apri
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        )}

        {/* Toolbar sticky: selettore rapporto + azioni */}
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              {/* Riga 1: selettore rapporto con prev/next */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Rapporto Agenzia ↔ Compagnia</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={!rapportoOptions.length} onClick={() => goRapporto(-1)} title="Rapporto precedente">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <SearchableSelect
                      options={rapportoOptions}
                      value={rapportoId}
                      onValueChange={setRapportoId}
                      placeholder="Seleziona un rapporto..."
                    />
                  </div>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={!rapportoOptions.length} onClick={() => goRapporto(1)} title="Rapporto successivo">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Riga 2: tipo rapporto + azioni */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {rapportoSelected && (
                    <Badge variant="outline" className="h-8 px-3">
                      Tipo: {rapportoSelected.tipo_rapporto || "—"}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" disabled={!rapportoId} onClick={() => setPasteOpen(true)}>
                    <ClipboardPaste className="w-4 h-4 mr-2" />Incolla CSV
                  </Button>
                  <Button size="sm" variant="outline" disabled={!rapportoId} onClick={() => setCopyOpen(true)}>
                    <Copy className="w-4 h-4 mr-2" />Copia da altro
                  </Button>
                  <Button size="sm" variant="outline" disabled={!rapportoId} onClick={() => setAiOpen(true)}>
                    <Sparkles className="w-4 h-4 mr-2" />Import IA
                  </Button>
                  <Button size="sm" variant="outline" disabled={!rapportoId} onClick={exportCsv}>
                    <Download className="w-4 h-4 mr-2" />Export
                  </Button>
                </div>
              </div>

              {/* Filtri matrice */}
              {rapportoId && (
                <div className="flex items-center gap-2 flex-wrap pt-3 border-t">
                  <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cerca Gruppo Ramo o Garanzia..."
                      className="pl-8 h-9"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {(["all", "configured", "missing", "only_default"] as FilterStato[]).map((f) => (
                      <Button
                        key={f}
                        size="sm"
                        variant={filterStato === f ? "default" : "outline"}
                        className="h-8"
                        onClick={() => setFilterStato(f)}
                      >
                        {f === "all" ? "Tutti" : f === "configured" ? "Configurati" : f === "missing" ? "Mancanti" : "Solo default"}
                      </Button>
                    ))}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {totals.gruppi} Rami · {totals.sottorami} sottorami · <b>{totals.configurati}</b> configurati
                    </span>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setAllExpanded(true)}>
                      <ChevronsUpDown className="w-3.5 h-3.5 mr-1" />Espandi
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setAllExpanded(false)}>
                      Collassa
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Editor manuale Rami/Sottorami abilitati */}
        {rapportoId && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Gestione manuale Rami e Sottorami abilitati</CardTitle>
            </CardHeader>
            <CardContent>
              <RamiAbilitatiEditor compagniaRapportoId={rapportoId} />
            </CardContent>
          </Card>
        )}

        {/* Matrice raggruppata */}
        {rapportoId && (
          <div className="space-y-2">
            {ramiAbilitati.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nessun Ramo abilitato su questo rapporto. Usa il pannello "Gestione manuale" qui sopra, oppure Import IA / Incolla CSV / Copia da altro per popolarli.
              </CardContent></Card>
            ) : gruppiVisibili.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nessun Ramo corrisponde ai filtri.
              </CardContent></Card>
            ) : (
              gruppiVisibili.map(({ gr, sottorami, defaultRow, configuredCount }) => (
                <RamoGroupCard
                  key={gr.id}
                  gr={gr}
                  sottorami={sottorami}
                  defaultRow={defaultRow}
                  provvMap={provvMap}
                  configuredCount={configuredCount}
                  expanded={isExpanded(gr.id, sottorami.length <= 5 || !!defaultRow || configuredCount > 0)}
                  onToggle={() => setExpanded((p) => ({ ...p, [gr.id]: !isExpanded(gr.id, sottorami.length <= 5) }))}
                  inheritedDefault={inheritedFromTipo(gr.id, null)}
                  inheritedForRamo={(rid: string) => inheritedFromTipo(gr.id, rid)}
                  onSave={(row) => upsertMutation.mutate([row])}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onBulkApply={(perc, overwrite) => {
                    if (overwrite) setBulkConfirm({ kind: "apply", gruppoId: gr.id, perc, overwrite });
                    else doBulkApply(gr.id, perc, false);
                  }}
                  onBulkReset={() => setBulkConfirm({ kind: "reset", gruppoId: gr.id })}
                />
              ))
            )}
          </div>
        )}

        {/* AlertDialog conferma bulk */}
        <AlertDialog open={!!bulkConfirm} onOpenChange={(v) => !v && setBulkConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {bulkConfirm?.kind === "apply" ? "Applica % a tutti i sottorami" : "Rimuovi override sottorami"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {bulkConfirm?.kind === "apply"
                  ? `Verrà scritta la % ${bulkConfirm?.perc}% su ${bulkConfirm?.overwrite ? "tutti" : "solo i sottorami vuoti"} di questo Ramo.`
                  : "Tutti i sottorami configurati di questo Ramo torneranno a ereditare dal default ramo. Operazione non distruttiva (soft delete)."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!bulkConfirm) return;
                  if (bulkConfirm.kind === "apply") doBulkApply(bulkConfirm.gruppoId, bulkConfirm.perc!, !!bulkConfirm.overwrite);
                  else doBulkReset(bulkConfirm.gruppoId);
                  setBulkConfirm(null);
                }}
              >
                Conferma
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {pasteOpen && (
          <PasteDialog
            open={pasteOpen}
            onClose={() => setPasteOpen(false)}
            gruppiRamo={gruppiRamo}
            rami={rami}
            onConfirm={(rows) => {
              upsertMutation.mutate(rows, { onSuccess: () => setPasteOpen(false) });
            }}
          />
        )}

        {copyOpen && (
          <CopyDialog
            open={copyOpen}
            onClose={() => setCopyOpen(false)}
            rapporti={rapporti.filter((r: any) => r.id !== rapportoId)}
            onConfirm={async (sourceId) => {
              const { data } = await supabase
                .from("provvigioni_compagnia_ramo")
                .select("gruppo_ramo_id, ramo_id, percentuale_provvigione")
                .eq("compagnia_rapporto_id", sourceId)
                .eq("attiva", true);
              const rows = (data || [])
                .filter((r: any) => r.gruppo_ramo_id)
                .map((r: any) => ({
                  gruppo_ramo_id: r.gruppo_ramo_id,
                  ramo_id: r.ramo_id,
                  percentuale: Number(r.percentuale_provvigione),
                }));
              if (rows.length === 0) {
                toast.error("Il rapporto sorgente non ha righe");
                return;
              }
              upsertMutation.mutate(rows, { onSuccess: () => setCopyOpen(false) });
            }}
          />
        )}

        {aiOpen && (
          <AiImportDialog
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            gruppiRamo={gruppiRamo}
            rami={rami}
            onConfirm={(rows) => {
              upsertMutation.mutate(rows, { onSuccess: () => setAiOpen(false) });
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Card collassabile per Ramo (gruppo) ───────────────────────────────────
function RamoGroupCard({
  gr, sottorami, defaultRow, provvMap, configuredCount,
  expanded, onToggle, inheritedDefault, inheritedForRamo,
  onSave, onDelete, onBulkApply, onBulkReset,
}: any) {
  const [defVal, setDefVal] = useState<string>(defaultRow ? String(defaultRow.perc) : "");
  const [bulkVal, setBulkVal] = useState<string>("");
  const [overwrite, setOverwrite] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => { setDefVal(defaultRow ? String(defaultRow.perc) : ""); }, [defaultRow?.id, defaultRow?.perc]);

  const triggerFlash = () => { setFlash(true); setTimeout(() => setFlash(false), 700); };

  const saveDefault = () => {
    const n = parseFloat(defVal);
    if (isNaN(n)) return;
    if (defaultRow && n === defaultRow.perc) return;
    onSave({ id: defaultRow?.id, gruppo_ramo_id: gr.id, ramo_id: null, percentuale: n });
    triggerFlash();
  };

  return (
    <Card className={`overflow-hidden transition-colors ${flash ? "ring-2 ring-emerald-400" : ""}`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${defaultRow || configuredCount > 0 ? "bg-primary/5" : "bg-muted/40"}`}>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onToggle} aria-label={expanded ? "Collassa" : "Espandi"}>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{gr.codice}</span>
            <span className="font-medium truncate">{gr.descrizione}</span>
            <Badge variant="outline" className="text-[10px]">{configuredCount}/{sottorami.length} sottorami</Badge>
            {defaultRow && <Badge variant="secondary" className="text-[10px]">default {defaultRow.perc}%</Badge>}
            {!defaultRow && inheritedDefault != null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">eredita tipo: {inheritedDefault}%</Badge>
                </TooltipTrigger>
                <TooltipContent>Da "Default globali per tipo rapporto" (livello 4)</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        {/* Default ramo inline */}
        <div className="flex items-center gap-1 shrink-0">
          <Label className="text-[10px] text-muted-foreground mr-1">Default ramo</Label>
          <Input
            type="number" step="0.01"
            value={defVal}
            onChange={(e) => setDefVal(e.target.value)}
            onBlur={saveDefault}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="h-8 w-20"
            placeholder="—"
          />
          {defaultRow && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(defaultRow.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rimuovi default ramo</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t">
          {/* Bulk actions */}
          <div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-muted/20 border-b">
            <Wand2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Applica % a tutti i sottorami:</span>
            <Input
              type="number" step="0.01"
              value={bulkVal}
              onChange={(e) => setBulkVal(e.target.value)}
              className="h-7 w-20"
              placeholder="es. 15"
            />
            <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              sovrascrivi configurati
            </label>
            <Button
              size="sm" variant="outline" className="h-7"
              disabled={!bulkVal || isNaN(parseFloat(bulkVal))}
              onClick={() => onBulkApply(parseFloat(bulkVal), overwrite)}
            >
              Applica
            </Button>
            <div className="ml-auto">
              <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={onBulkReset}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" />Resetta sottorami
              </Button>
            </div>
          </div>

          {/* Sottorami */}
          {sottorami.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-3 py-3">Nessun sottoramo abilitato per questo Ramo.</p>
          ) : (
            <Table>
              <TableBody>
                {sottorami.map((s: any, i: number) => {
                  const row = provvMap[`${gr.id}|${s.id}`];
                  return (
                    <SottoramoRow
                      key={s.id}
                      gr={gr}
                      ramo={s}
                      existing={row}
                      zebra={i % 2 === 1}
                      inheritedTipo={inheritedForRamo(s.id)}
                      hasDefaultRamo={!!defaultRow}
                      onSave={(perc: number) =>
                        onSave({ id: row?.id, gruppo_ramo_id: gr.id, ramo_id: s.id, percentuale: perc })
                      }
                      onDelete={() => row && onDelete(row.id)}
                    />
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </Card>
  );
}

function SottoramoRow({ ramo, existing, zebra, inheritedTipo, hasDefaultRamo, onSave, onDelete }: any) {
  const [val, setVal] = useState<string>(existing ? String(existing.perc) : "");
  const [flash, setFlash] = useState(false);
  useEffect(() => { setVal(existing ? String(existing.perc) : ""); }, [existing?.id, existing?.perc]);

  const commit = () => {
    const n = parseFloat(val);
    if (isNaN(n)) return;
    if (existing && n === existing.perc) return;
    onSave(n);
    setFlash(true); setTimeout(() => setFlash(false), 700);
  };

  const inheritLabel = existing
    ? null
    : hasDefaultRamo
      ? "eredita default ramo"
      : inheritedTipo != null
        ? `eredita tipo (${inheritedTipo}%)`
        : "0% (nessuna regola)";

  return (
    <TableRow className={`${zebra ? "bg-muted/20" : ""} ${flash ? "bg-emerald-50 dark:bg-emerald-950/30" : ""} transition-colors`}>
      <TableCell className="pl-10 text-sm w-[55%]">
        <span className="text-xs text-muted-foreground mr-2">{ramo.codice}</span>
        {ramo.descrizione}
      </TableCell>
      <TableCell className="w-[120px]">
        <Input
          type="number"
          step="0.01"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="h-8 w-24"
          placeholder="—"
        />
      </TableCell>
      <TableCell className="w-[180px]">
        {existing ? (
          <Badge variant="default">salvato</Badge>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-muted-foreground cursor-help">{inheritLabel}</Badge>
            </TooltipTrigger>
            <TooltipContent>
              {hasDefaultRamo
                ? "Usa la % del default ramo configurata sopra (livello 2)."
                : inheritedTipo != null
                  ? "Usa la % del default globale per tipo rapporto (livello 4)."
                  : "Nessuna regola: in fase di immissione polizza verrà applicato 0% con warning."}
            </TooltipContent>
          </Tooltip>
        )}
      </TableCell>
      <TableCell className="w-[60px] text-right pr-3">
        {existing && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}


// ─── Editor default tipo rapporto ──────────────────────────────────────────
function DefaultTipoEditor({ rows, gruppiRamo, rami, onChanged }: any) {
  const [tipo, setTipo] = useState("");
  const [gr, setGr] = useState("");
  const [ramoId, setRamoId] = useState("");
  const [perc, setPerc] = useState("");

  const add = async () => {
    if (!tipo || !gr || !perc) {
      toast.error("Compila tipo, ramo e %");
      return;
    }
    const { error } = await supabase.from("provvigioni_default_tipo" as any).upsert(
      {
        tipo_rapporto: tipo,
        gruppo_ramo_id: gr,
        ramo_id: ramoId || null,
        percentuale: parseFloat(perc),
        attiva: true,
      },
      { onConflict: "tipo_rapporto,gruppo_ramo_id,ramo_id" }
    );
    if (error) toast.error(error.message);
    else {
      toast.success("Default salvato");
      setPerc("");
      onChanged();
    }
  };

  const remove = async (id: string) => {
    await supabase.from("provvigioni_default_tipo" as any).update({ attiva: false }).eq("id", id);
    onChanged();
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="w-48 space-y-1">
          <Label className="text-xs">Tipo rapporto</Label>
          <SearchableSelect options={TIPI_RAPPORTO.map((t) => ({ value: t, label: t }))} value={tipo} onValueChange={setTipo} placeholder="Tipo..." />
        </div>
        <div className="w-56 space-y-1">
          <Label className="text-xs">Gruppo Ramo</Label>
          <SearchableSelect
            options={gruppiRamo.map((g: any) => ({ value: g.id, label: `${g.codice} - ${g.descrizione}` }))}
            value={gr}
            onValueChange={setGr}
            placeholder="Ramo..."
          />
        </div>
        <div className="w-56 space-y-1">
          <Label className="text-xs">Garanzia (opz)</Label>
          <SearchableSelect
            options={rami
              .filter((r: any) => !gr || r.gruppo_ramo_id === gr)
              .map((r: any) => ({ value: r.id, label: `${r.codice} - ${r.descrizione}` }))}
            value={ramoId}
            onValueChange={setRamoId}
            placeholder="Default ramo se vuoto"
          />
        </div>
        <div className="w-24 space-y-1">
          <Label className="text-xs">%</Label>
          <Input type="number" step="0.01" value={perc} onChange={(e) => setPerc(e.target.value)} />
        </div>
        <Button onClick={add}><Plus className="w-4 h-4 mr-1" />Aggiungi</Button>
      </div>

      {rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Gruppo Ramo</TableHead>
              <TableHead>Garanzia</TableHead>
              <TableHead>%</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any, i: number) => {
              const grObj = gruppiRamo.find((x: any) => x.id === r.gruppo_ramo_id);
              const raObj = rami.find((x: any) => x.id === r.ramo_id);
              return (
                <TableRow key={r.id} className={i % 2 ? "bg-muted/30" : ""}>
                  <TableCell><Badge variant="outline">{r.tipo_rapporto}</Badge></TableCell>
                  <TableCell>{grObj?.descrizione || "—"}</TableCell>
                  <TableCell>{raObj?.descrizione || <span className="text-muted-foreground italic">default ramo</span>}</TableCell>
                  <TableCell>{Number(r.percentuale).toFixed(2)}%</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(r.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─── Dialog paste CSV ──────────────────────────────────────────────────────
function PasteDialog({ open, onClose, gruppiRamo, rami, onConfirm }: any) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    try {
      const content = await file.text();
      setText(content);
      toast.success(`File "${file.name}" caricato`);
    } catch (e: any) {
      toast.error(e.message || "Errore lettura file");
    }
  };

  const parsed = useMemo(() => {
    if (!text.trim()) return [];
    const allLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // skippa header se la prima riga contiene "ramo" e "perc"/"%"
    const lines = allLines.filter((l, i) => {
      if (i > 0) return true;
      const low = l.toLowerCase();
      return !(low.includes("ramo") && (low.includes("perc") || low.includes("%")));
    });
    return lines.map((line) => {
      const parts = line.split(/[;,\t]/).map((p) => p.trim());
      let ramoName = "", sottoName = "", percStr = "";
      if (parts.length === 2) { sottoName = parts[0]; percStr = parts[1]; }
      else if (parts.length >= 3) { ramoName = parts[0]; sottoName = parts[1]; percStr = parts[2]; }
      const percentuale = parseFloat(percStr.replace(",", ".").replace("%", ""));

      const upper = (s: string) => s.toUpperCase().trim();
      const gr = ramoName
        ? gruppiRamo.find((g: any) => upper(g.descrizione) === upper(ramoName) || upper(g.codice) === upper(ramoName))
        : null;
      const sotto = sottoName
        ? rami.find(
            (r: any) =>
              (upper(r.descrizione) === upper(sottoName) || upper(r.codice) === upper(sottoName)) &&
              (!gr || r.gruppo_ramo_id === gr.id)
          )
        : null;
      const grResolved = gr || (sotto ? gruppiRamo.find((g: any) => g.id === sotto.gruppo_ramo_id) : null);

      return {
        line,
        ramoName,
        sottoName,
        percentuale,
        gruppo_ramo_id: grResolved?.id || null,
        ramo_id: sotto?.id || null,
        ok: !!grResolved && !isNaN(percentuale),
      };
    });
  }, [text, gruppiRamo, rami]);

  const valid = parsed.filter((p: any) => p.ok);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Incolla o carica provvigioni (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Formato: <code>GruppoRamo;Garanzia;%</code> oppure <code>Garanzia;%</code> (una riga per voce). Separatori: <code>; , tab</code>. Header opzionale.
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />Carica CSV
            </Button>
            <span className="text-xs text-muted-foreground">oppure incolla qui sotto</span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"AUTO;RCA AUTO;10\nAUTO;ARD;18\nAUTO;CRISTALLI;22"}
          />
          {parsed.length > 0 && (
            <div className="border rounded max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gruppo Ramo</TableHead>
                    <TableHead>Garanzia</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Esito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((p: any, i: number) => (
                    <TableRow key={i} className={i % 2 ? "bg-muted/30" : ""}>
                      <TableCell>{p.ramoName || "—"}</TableCell>
                      <TableCell>{p.sottoName || "—"}</TableCell>
                      <TableCell>{isNaN(p.percentuale) ? "?" : p.percentuale}</TableCell>
                      <TableCell>{p.ok ? <Badge variant="default">OK</Badge> : <Badge variant="destructive">scarta</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button
            disabled={valid.length === 0}
            onClick={() =>
              onConfirm(
                valid.map((p: any) => ({
                  gruppo_ramo_id: p.gruppo_ramo_id,
                  ramo_id: p.ramo_id,
                  percentuale: p.percentuale,
                }))
              )
            }
          >
            <Save className="w-4 h-4 mr-2" />Salva {valid.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog copia da altro rapporto ────────────────────────────────────────
function CopyDialog({ open, onClose, rapporti, onConfirm }: any) {
  const [src, setSrc] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Copia da altro rapporto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <SearchableSelect
            options={rapporti.map((r: any) => ({
              value: r.id,
              label: `${r.gruppi_compagnia?.descrizione || "?"} — ${r.nome_rapporto}`,
            }))}
            value={src}
            onValueChange={setSrc}
            placeholder="Seleziona rapporto sorgente..."
          />
          <p className="text-xs text-muted-foreground">Verranno copiate tutte le righe attive (sovrascrivendo le esistenti per stesso Ramo/Sottoramo).</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button disabled={!src} onClick={() => onConfirm(src)}><Copy className="w-4 h-4 mr-2" />Copia</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog import AI ───────────────────────────────────────────────────────
function AiImportDialog({ open, onClose, gruppiRamo, rami, onConfirm }: any) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [risultati, setRisultati] = useState<any[]>([]);
  const [warningMsg, setWarningMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Normalizzazione robusta: maiuscole, no accenti, no punteggiatura, spazi compatti
  const norm = (s: string) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  // Alias comuni (sinonimi → nome canonico)
  const ALIASES: Record<string, string[]> = {
    INFORTUNI: ["INFORTUNI", "INF", "INFORTUNIO"],
    MALATTIA: ["MALATTIA", "MAL"],
    AUTO: ["AUTO", "RCA AUTO", "VEICOLI", "AUTOVETTURE"],
    RCA: ["RCA", "RC AUTO", "RESPONSABILITA CIVILE AUTO"],
    ARD: ["ARD", "AUTO RISCHI DIVERSI", "FURTO INCENDIO KASKO"],
    INCENDIO: ["INCENDIO", "INCENDIO FURTO"],
    FURTO: ["FURTO"],
    "RC GENERALE": ["RC GENERALE", "RCG", "RESPONSABILITA CIVILE GENERALE", "RC"],
    CAUZIONI: ["CAUZIONI", "CAUZIONE", "CREDITO CAUZIONI"],
    "TUTELA LEGALE": ["TUTELA LEGALE", "TL"],
    ASSISTENZA: ["ASSISTENZA", "ASS STRADALE"],
    CRISTALLI: ["CRISTALLI"],
    VITA: ["VITA", "RAMO VITA"],
  };

  const matchEntry = (
    raw: string,
    pool: { id: string; codice: string; descrizione: string; gruppo_ramo_id?: string }[],
    restrictGruppoId?: string | null
  ) => {
    if (!raw) return null;
    const target = norm(raw);
    const candidates = restrictGruppoId ? pool.filter((p) => p.gruppo_ramo_id === restrictGruppoId) : pool;
    let hit = candidates.find((p) => norm(p.codice) === target || norm(p.descrizione) === target);
    if (hit) return hit;
    for (const [canon, alts] of Object.entries(ALIASES)) {
      if (alts.includes(target) || target === canon) {
        hit = candidates.find((p) => norm(p.descrizione) === canon || alts.includes(norm(p.descrizione)));
        if (hit) return hit;
      }
    }
    hit = candidates.find((p) => {
      const d = norm(p.descrizione);
      return d && (d.includes(target) || target.includes(d));
    });
    return hit || null;
  };

  const enrich = (righe: any[]) =>
    righe.map((r: any) => {
      const gr = matchEntry(r.ramo, gruppiRamo as any[]);
      const sotto = r.sottoramo ? matchEntry(r.sottoramo, rami as any[], gr?.id || null) : null;
      const gruppo_ramo_id = gr?.id || sotto?.gruppo_ramo_id || null;
      const perc = typeof r.percentuale === "number" ? r.percentuale : parseFloat(r.percentuale);
      return {
        ramo: r.ramo || "",
        sottoramo: r.sottoramo || "",
        percentuale: perc,
        gruppo_ramo_id,
        ramo_ids: sotto?.id ? [sotto.id] : [],
        ok: !!gruppo_ramo_id && !isNaN(perc),
      };
    });

  const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

  const compressImage = async (file: File): Promise<{ base64: string; mime: string }> => {
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Immagine non leggibile"));
      i.src = dataUrl;
    });
    const maxSide = 2000;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/jpeg", 0.85);
    return { base64: out.split(",")[1], mime: "image/jpeg" };
  };

  const handleFile = async (file: File) => {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isImg = file.type.startsWith("image/");
    setWarningMsg("");
    setErrorMsg("");
    setRisultati([]);
    setFileName(file.name);

    if (!isPdf && !isImg) {
      const msg = "Formato non supportato: carica un PDF o un'immagine.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    if (file.size === 0) {
      const msg = "Il file selezionato è vuoto. Scarica di nuovo l'allegato e riprova.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    if (file.size > MAX_BYTES) {
      const msg = `File troppo grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 8 MB. Per PDF pesanti, esporta come immagine JPG.`;
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      let b64: string;
      let mime: string;
      if (isImg) {
        const c = await compressImage(file);
        b64 = c.base64;
        mime = c.mime;
      } else {
        const buf = await file.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
        }
        b64 = btoa(binary);
        mime = file.type || "application/pdf";
      }
      if (!b64 || b64.length < 100) {
        throw new Error("L'allegato non è stato letto correttamente: contenuto vuoto o non valido.");
      }
      console.log("[AI Import] invio", { name: file.name, mime, sizeKB: Math.round(b64.length / 1024) });
      const { data, error } = await supabase.functions.invoke("parse-tariffario-rami", {
        body: { pdf_base64: b64, mime_type: mime },
      });
      if (error) {
        console.error("[AI Import] invoke error", error);
        throw new Error(error.message || "Errore chiamata IA");
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const righe = (data as any)?.righe || [];
      const warning = (data as any)?.warning || "";
      setWarningMsg(warning);
      console.log("[AI Import] righe ricevute", righe.length, (data as any)?.warning);
      if (!righe.length) {
        const msg = warning || "L'IA non ha estratto righe. Verifica leggibilità del documento.";
        setWarningMsg(msg);
        toast.warning(msg);
      } else {
        toast.success(`Estratte ${righe.length} righe dal documento`);
      }
      setRisultati(enrich(righe));
    } catch (e: any) {
      console.error("[AI Import] errore", e);
      const msg = e?.message || "Errore IA durante l'analisi del documento";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (i: number, patch: Partial<any>) => {
    setRisultati((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const merged = { ...r, ...patch };
        merged.ok = !!merged.gruppo_ramo_id && !isNaN(Number(merged.percentuale));
        return merged;
      })
    );
  };

  const valid = risultati.filter((r) => r.ok);
  const totalToSave = valid.reduce((acc, r) => acc + Math.max(r.ramo_ids?.length || 0, 1), 0);
  const showPreview = !!fileName || loading || !!warningMsg || !!errorMsg || risultati.length > 0;

  const gruppoOptions = useMemo(
    () => (gruppiRamo as any[]).map((g: any) => ({ value: g.id, label: `${g.codice} - ${g.descrizione}` })),
    [gruppiRamo]
  );
  const sottoramiFor = (gruppoId: string | null) =>
    (rami as any[]).filter((r: any) => gruppoId && r.gruppo_ramo_id === gruppoId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[96vw] md:max-w-5xl w-full max-h-[88vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle>Import IA tariffario provvigioni</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                e.currentTarget.value = "";
                if (selected) handleFile(selected);
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {loading ? "Analisi in corso..." : "Carica PDF/Immagine"}
            </Button>
            {fileName && (
              <span className="text-xs text-muted-foreground truncate max-w-[260px]">{fileName}</span>
            )}
            <span className="text-xs text-muted-foreground ml-auto hidden md:inline">
              L'IA estrae Ramo, Sottoramo e %. Puoi correggere i match prima di salvare.
            </span>
          </div>

          {showPreview && (
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="flex items-start gap-2">
                {errorMsg ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 text-destructive shrink-0" />
                ) : loading ? (
                  <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <FileText className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-medium">
                    {loading
                      ? "Analisi dell'allegato in corso"
                      : errorMsg
                        ? "Allegato non caricato"
                        : risultati.length > 0
                          ? `Anteprima import: ${risultati.length} righe estratte`
                          : "Anteprima import"}
                  </div>
                  <div className={errorMsg ? "text-destructive break-words" : "text-muted-foreground break-words"}>
                    {errorMsg ||
                      warningMsg ||
                      (fileName
                        ? `File selezionato: ${fileName}`
                        : "Seleziona un PDF o un'immagine per avviare l'estrazione.")}
                  </div>
                  {risultati.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="default">{valid.length} salvabili</Badge>
                      <Badge variant="destructive">{risultati.length - valid.length} da rivedere</Badge>
                      <span className="text-xs text-muted-foreground">
                        Le righe senza sottoramo vengono salvate come <b>default ramo</b>.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {risultati.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <div className="max-h-[50vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[14%] h-9 px-2 text-xs">Ramo IA</TableHead>
                      <TableHead className="w-[14%] h-9 px-2 text-xs">Sottoramo IA</TableHead>
                      <TableHead className="w-[24%] h-9 px-2 text-xs">Ramo DB</TableHead>
                      <TableHead className="w-[24%] h-9 px-2 text-xs">Sottoramo DB</TableHead>
                      <TableHead className="w-[12%] h-9 px-2 text-xs">%</TableHead>
                      <TableHead className="w-[12%] h-9 px-2 text-xs">Stato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {risultati.map((r, i) => (
                      <TableRow key={i} className={i % 2 ? "bg-muted/30" : ""}>
                        <TableCell className="text-xs p-2 align-top">{r.ramo || "—"}</TableCell>
                        <TableCell className="text-xs p-2 align-top">{r.sottoramo || "—"}</TableCell>
                        <TableCell className="p-2 align-top">
                          <SearchableSelect
                            options={gruppoOptions}
                            value={r.gruppo_ramo_id || ""}
                            onValueChange={(v) => updateRow(i, { gruppo_ramo_id: v, ramo_ids: [] })}
                            placeholder="Seleziona ramo..."
                          />
                        </TableCell>
                        <TableCell className="p-2 align-top">
                          <SottoramiMultiSelect
                            sottorami={sottoramiFor(r.gruppo_ramo_id)}
                            value={r.ramo_ids || []}
                            onChange={(ids) => updateRow(i, { ramo_ids: ids })}
                            disabled={!r.gruppo_ramo_id}
                          />
                        </TableCell>
                        <TableCell className="p-2 align-top">
                          <Input
                            type="number"
                            step="0.01"
                            value={isNaN(r.percentuale) ? "" : r.percentuale}
                            onChange={(e) => updateRow(i, { percentuale: parseFloat(e.target.value) })}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell className="p-2 align-top">
                          {r.ok ? <Badge>OK</Badge> : <Badge variant="destructive">no match</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {!showPreview && (
            <div className="rounded-md border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
              Nessun allegato caricato. Seleziona un PDF o un'immagine della tabella provvigionale per iniziare.
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button
            disabled={totalToSave === 0}
            onClick={() =>
              onConfirm(
                valid.flatMap((r) => {
                  const ids = r.ramo_ids?.length ? r.ramo_ids : [null];
                  return ids.map((ramo_id: string | null) => ({
                    gruppo_ramo_id: r.gruppo_ramo_id,
                    ramo_id,
                    percentuale: Number(r.percentuale),
                  }));
                })
              )
            }
          >
            <Save className="w-4 h-4 mr-2" />
            Salva {totalToSave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SottoramiMultiSelect({
  sottorami,
  value,
  onChange,
  disabled,
}: {
  sottorami: { id: string; codice: string; descrizione: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const allIds = sottorami.map((s) => s.id);
  const selectedSet = new Set(value);
  const allSelected = sottorami.length > 0 && allIds.every((id) => selectedSet.has(id));
  const someSelected = value.length > 0 && !allSelected;

  const label = (() => {
    if (disabled) return "Seleziona prima il ramo";
    if (sottorami.length === 0) return "— Default ramo (nessun sottoramo) —";
    if (value.length === 0) return "— Default ramo (nessun sottoramo) —";
    if (allSelected) return `Tutti i sottorami (${value.length})`;
    if (value.length === 1) {
      const s = sottorami.find((x) => x.id === value[0]);
      return s ? `${s.codice} - ${s.descrizione}` : "1 sottoramo";
    }
    return `${value.length} sottorami`;
  })();

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="h-8 w-full justify-between text-xs font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cerca sottoramo..." className="h-9" />
          <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5 text-xs">
            <button
              type="button"
              className="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent"
              onClick={() => onChange(allSelected ? [] : allIds)}
              disabled={sottorami.length === 0}
            >
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                className="pointer-events-none"
              />
              <span className="font-medium">
                {allSelected ? "Deseleziona tutti" : "Seleziona tutti"}
              </span>
            </button>
            <span className="text-muted-foreground">
              {value.length}/{sottorami.length}
            </span>
          </div>
          <CommandList>
            <CommandEmpty>Nessun sottoramo</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__default__" onSelect={() => onChange([])}>
                <Check className={`mr-2 h-4 w-4 ${value.length === 0 ? "opacity-100" : "opacity-0"}`} />
                <span className="italic text-muted-foreground">— Default ramo (nessun sottoramo) —</span>
              </CommandItem>
              {sottorami.map((s) => {
                const checked = selectedSet.has(s.id);
                return (
                  <CommandItem
                    key={s.id}
                    value={`${s.codice} ${s.descrizione}`}
                    onSelect={() => toggle(s.id)}
                  >
                    <Checkbox checked={checked} className="mr-2 pointer-events-none" />
                    <span className="truncate">
                      <span className="font-medium">{s.codice}</span> - {s.descrizione}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
