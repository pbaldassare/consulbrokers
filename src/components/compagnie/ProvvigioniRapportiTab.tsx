import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Percent, Copy, ClipboardPaste, Upload, Sparkles, Save, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

const TIPI_RAPPORTO = ["Direzione", "Agenzia", "Broker", "Plurimandataria", "Mandato diretto", "Sub-agenzia", "Convenzione broker", "Coverholder", "Altro"];

export default function ProvvigioniRapportiTab() {
  const qc = useQueryClient();
  const [rapportoId, setRapportoId] = useState<string>("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

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
        label: `${r.gruppi_compagnia?.descrizione || "?"} — ${r.nome_rapporto} (${r.compagnie?.nome || ""})`,
      })),
    [rapporti]
  );

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
      const payload = rows.map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        compagnia_rapporto_id: rapportoId,
        compagnia_id: rapportoSelected?.compagnia_id,
        gruppo_ramo_id: r.gruppo_ramo_id,
        ramo_id: r.ramo_id,
        percentuale_provvigione: r.percentuale,
        attiva: true,
      }));
      const { error } = await (supabase.from("provvigioni_compagnia_ramo") as any).upsert(payload, {
        onConflict: "compagnia_rapporto_id,gruppo_ramo_id,ramo_id",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salvato");
      qc.invalidateQueries({ queryKey: ["provv-rapporto", rapportoId] });
    },
    onError: (e: any) => toast.error(e.message),
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

  return (
    <div className="space-y-4">
      {/* Catena di risoluzione */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Percent className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Catena di risoluzione della % provvigione</p>
              <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-0.5">
                <li>Match esatto <b>Rapporto + Ramo + Sottoramo</b> (es. Allianz Direzione → AUTO → RCA)</li>
                <li>Default di <b>Ramo</b> sul rapporto (es. Allianz Direzione → AUTO senza sottoramo)</li>
                <li><b>% globale del rapporto</b> (campo su <code>compagnia_rapporti</code>)</li>
                <li>Default per <b>Tipo rapporto + Ramo/Sottoramo</b> (es. Broker → CASA = 18%)</li>
                <li>Se nessuna regola → <b>0%</b> + warning in fase di immissione polizza</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Selettore rapporto + azioni */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[300px] space-y-1">
              <Label className="text-xs text-muted-foreground">Rapporto Agenzia ↔ Compagnia</Label>
              <SearchableSelect
                options={rapportoOptions}
                value={rapportoId}
                onValueChange={setRapportoId}
                placeholder="Seleziona un rapporto..."
              />
            </div>
            {rapportoSelected && (
              <Badge variant="outline" className="h-9 px-3">
                Tipo: {rapportoSelected.tipo_rapporto}
              </Badge>
            )}
            <Button variant="outline" disabled={!rapportoId} onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="w-4 h-4 mr-2" />Incolla CSV
            </Button>
            <Button variant="outline" disabled={!rapportoId} onClick={() => setCopyOpen(true)}>
              <Copy className="w-4 h-4 mr-2" />Copia da altro
            </Button>
            <Button variant="outline" disabled={!rapportoId} onClick={() => setAiOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2" />Import IA
            </Button>
            <Button variant="outline" disabled={!rapportoId} onClick={exportCsv}>
              <Download className="w-4 h-4 mr-2" />Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Matrice */}
      {rapportoId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="w-4 h-4" />Provvigioni per Ramo / Sottoramo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Ramo / Sottoramo</TableHead>
                  <TableHead className="w-[120px]">%</TableHead>
                  <TableHead className="w-[80px]">Stato</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gruppiRamo.map((gr: any, grIdx: number) => {
                  const sottorami = rami.filter((r: any) => r.gruppo_ramo_id === gr.id);
                  const defKey = `${gr.id}|`;
                  const defaultRow = provvMap[defKey];
                  return (
                    <RamoBlock
                      key={gr.id}
                      gr={gr}
                      sottorami={sottorami}
                      provvMap={provvMap}
                      defaultRow={defaultRow}
                      defKey={defKey}
                      onSave={(row) => upsertMutation.mutate([row])}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      zebra={grIdx % 2 === 0}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
  );
}

// ─── Blocco riga Ramo + sottorami ──────────────────────────────────────────
function RamoBlock({ gr, sottorami, provvMap, defaultRow, defKey, onSave, onDelete, zebra }: any) {
  const [defVal, setDefVal] = useState<string>(defaultRow ? String(defaultRow.perc) : "");
  return (
    <>
      <TableRow className={zebra ? "bg-muted/30 font-medium" : "bg-muted/50 font-medium"}>
        <TableCell>
          <span className="text-xs uppercase text-muted-foreground mr-2">{gr.codice}</span>
          {gr.descrizione} <Badge variant="outline" className="ml-2 text-[10px]">default ramo</Badge>
        </TableCell>
        <TableCell>
          <Input
            type="number"
            step="0.01"
            value={defVal}
            onChange={(e) => setDefVal(e.target.value)}
            onBlur={() => {
              const n = parseFloat(defVal);
              if (!isNaN(n)) {
                onSave({ id: defaultRow?.id, gruppo_ramo_id: gr.id, ramo_id: null, percentuale: n });
              }
            }}
            className="h-8 w-24"
          />
        </TableCell>
        <TableCell>{defaultRow ? <Badge variant="secondary">salvato</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
        <TableCell>
          {defaultRow && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(defaultRow.id)}>
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          )}
        </TableCell>
      </TableRow>
      {sottorami.map((r: any) => {
        const key = `${gr.id}|${r.id}`;
        const row = provvMap[key];
        return (
          <SottoramoRow
            key={r.id}
            gr={gr}
            ramo={r}
            existing={row}
            onSave={(perc) => onSave({ id: row?.id, gruppo_ramo_id: gr.id, ramo_id: r.id, percentuale: perc })}
            onDelete={() => row && onDelete(row.id)}
          />
        );
      })}
    </>
  );
}

function SottoramoRow({ gr, ramo, existing, onSave, onDelete }: any) {
  const [val, setVal] = useState<string>(existing ? String(existing.perc) : "");
  return (
    <TableRow>
      <TableCell className="pl-10 text-sm">
        <span className="text-xs text-muted-foreground mr-2">{ramo.codice}</span>
        {ramo.descrizione}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            const n = parseFloat(val);
            if (!isNaN(n)) onSave(n);
          }}
          className="h-8 w-24"
          placeholder="—"
        />
      </TableCell>
      <TableCell>
        {existing ? <Badge variant="default">salvato</Badge> : <Badge variant="outline" className="text-muted-foreground">eredita</Badge>}
      </TableCell>
      <TableCell>
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
          <Label className="text-xs">Ramo</Label>
          <SearchableSelect
            options={gruppiRamo.map((g: any) => ({ value: g.id, label: `${g.codice} - ${g.descrizione}` }))}
            value={gr}
            onValueChange={setGr}
            placeholder="Ramo..."
          />
        </div>
        <div className="w-56 space-y-1">
          <Label className="text-xs">Sottoramo (opz)</Label>
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
              <TableHead>Ramo</TableHead>
              <TableHead>Sottoramo</TableHead>
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

  const parsed = useMemo(() => {
    if (!text.trim()) return [];
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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
          <DialogTitle>Incolla provvigioni (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Formato: <code>Ramo;Sottoramo;%</code> oppure <code>Sottoramo;%</code> (una riga per voce). Separatori: <code>; , tab</code>.
          </p>
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
                    <TableHead>Ramo</TableHead>
                    <TableHead>Sottoramo</TableHead>
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
  const [risultati, setRisultati] = useState<any[]>([]);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const { data, error } = await supabase.functions.invoke("parse-tariffario-rami", {
        body: { pdf_base64: b64, mime_type: file.type },
      });
      if (error) throw error;
      const upper = (s: string) => (s || "").toUpperCase().trim();
      const enriched = (data.righe || []).map((r: any) => {
        const gr = gruppiRamo.find((g: any) => upper(g.descrizione) === upper(r.ramo) || upper(g.codice) === upper(r.ramo));
        const sotto = r.sottoramo
          ? rami.find((x: any) =>
              (upper(x.descrizione) === upper(r.sottoramo) || upper(x.codice) === upper(r.sottoramo)) &&
              (!gr || x.gruppo_ramo_id === gr.id))
          : null;
        return {
          ramo: r.ramo,
          sottoramo: r.sottoramo,
          percentuale: r.percentuale,
          gruppo_ramo_id: gr?.id || (sotto ? sotto.gruppo_ramo_id : null),
          ramo_id: sotto?.id || null,
          ok: !!(gr || sotto) && !isNaN(r.percentuale),
        };
      });
      setRisultati(enriched);
    } catch (e: any) {
      toast.error(e.message || "Errore IA");
    } finally {
      setLoading(false);
    }
  };

  const valid = risultati.filter((r) => r.ok);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Import IA tariffario provvigioni</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
              <Upload className="w-4 h-4 mr-2" />{loading ? "Analisi in corso..." : "Carica PDF/Immagine"}
            </Button>
            <span className="text-xs text-muted-foreground">L'IA estrarrà ramo, sottoramo e %.</span>
          </div>
          {risultati.length > 0 && (
            <div className="border rounded max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ramo IA</TableHead>
                    <TableHead>Sottoramo IA</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {risultati.map((r, i) => (
                    <TableRow key={i} className={i % 2 ? "bg-muted/30" : ""}>
                      <TableCell>{r.ramo}</TableCell>
                      <TableCell>{r.sottoramo || "—"}</TableCell>
                      <TableCell>{r.percentuale}</TableCell>
                      <TableCell>{r.ok ? <Badge>OK</Badge> : <Badge variant="destructive">no match</Badge>}</TableCell>
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
                valid.map((r) => ({
                  gruppo_ramo_id: r.gruppo_ramo_id,
                  ramo_id: r.ramo_id,
                  percentuale: r.percentuale,
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
