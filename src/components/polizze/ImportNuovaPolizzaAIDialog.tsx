import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Sparkles, UploadCloud, Loader2, FileText, CheckCircle2, AlertTriangle,
  UserPlus, ArrowLeft, ArrowRight, Trash2, Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type ParsedPolizzaData = {
  compagnia?: string;
  intermediario?: string;
  contraente_nome?: string;
  contraente_codice_fiscale?: string;
  contraente_partita_iva?: string;
  contraente_indirizzo?: string;
  contraente_comune?: string;
  contraente_provincia?: string;
  contraente_cap?: string;
  contraente_nazione?: string;
  contraente_email?: string;
  contraente_telefono?: string;
  numero_polizza?: string;
  prodotto?: string;
  ramo_descrizione?: string;
  decorrenza?: string;
  scadenza?: string;
  prossima_quietanza?: string;
  frazionamento?: string;
  tacito_rinnovo?: boolean;
  premio_firma_netto?: number;
  premio_firma_accessori?: number;
  premio_firma_imposte?: number;
  premio_firma_lordo?: number;
  premio_quietanza_netto?: number;
  premio_quietanza_accessori?: number;
  premio_quietanza_imposte?: number;
  premio_quietanza_lordo?: number;
  targa?: string;
  garanzie?: { descrizione: string; massimale?: number; premio_netto?: number }[];
};

export type MatchResult = {
  data: ParsedPolizzaData;
  cliente?: { id: string; label: string } | null;
  compagnia?: { id: string; label: string } | null;
  ramo?: { gruppoRamoId: string; ramoId: string; label: string } | null;
  isNewCliente?: boolean;
  gruppoFinanziarioId?: string;
  tipoCliente?: "privato" | "azienda" | "ente";
  codiceCup?: string;
};

type GruppoFinanziarioOpt = {
  id: string;
  codice: string;
  nome: string;
  tipo_soggetto: "privato" | "azienda" | "ente";
};

type ClienteCand = { id: string; label: string; cf?: string; piva?: string };
type CompagniaCand = { id: string; label: string };
type RamoCand = { gruppoRamoId: string; ramoId: string; label: string };
type LogEntry = { ts: number; level: "info" | "success" | "warn" | "error"; msg: string };
type Step = "upload" | "review" | "summary";

const NEW_CLIENTE = "__new__";

const fmtEur = (n?: number | null) =>
  n == null || isNaN(Number(n))
    ? "—"
    : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(n));

const num = (v: any): number | undefined => {
  if (v === "" || v == null) return undefined;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? undefined : n;
};

export function ImportNuovaPolizzaAIDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApply: (m: MatchResult) => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [data, setData] = useState<ParsedPolizzaData>({});

  const [clienteCandidates, setClienteCandidates] = useState<ClienteCand[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [compagniaCandidates, setCompagniaCandidates] = useState<CompagniaCand[]>([]);
  const [selectedCompagniaId, setSelectedCompagniaId] = useState<string>("");
  const [ramoCandidates, setRamoCandidates] = useState<RamoCand[]>([]);
  const [selectedRamoKey, setSelectedRamoKey] = useState<string>("");
  const [gruppiFinanziari, setGruppiFinanziari] = useState<GruppoFinanziarioOpt[]>([]);
  const [selectedGruppoFinanziarioId, setSelectedGruppoFinanziarioId] = useState<string>("");
  const [codiceCupNew, setCodiceCupNew] = useState<string>("");

  const fileInput = useRef<HTMLInputElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Carica i gruppi finanziari quando si entra in review con cliente nuovo
  useEffect(() => {
    if (step !== "review") return;
    if (gruppiFinanziari.length > 0) return;
    (async () => {
      const { data: rows } = await supabase
        .from("gruppi_finanziari" as any)
        .select("id, codice, nome, tipo_soggetto")
        .eq("attivo", true)
        .order("codice");
      setGruppiFinanziari((rows || []) as unknown as GruppoFinanziarioOpt[]);
    })();
  }, [step, gruppiFinanziari.length]);

  const reset = () => {
    setStep("upload");
    setParsing(false);
    setProgress(0);
    setProgressLabel("");
    setLogs([]);
    setFileName(null);
    setData({});
    setClienteCandidates([]);
    setSelectedClienteId("");
    setCompagniaCandidates([]);
    setSelectedCompagniaId("");
    setRamoCandidates([]);
    setSelectedRamoKey("");
    setSelectedGruppoFinanziarioId("");
    setCodiceCupNew("");
  };

  const log = (level: LogEntry["level"], msg: string) =>
    setLogs((l) => [...l, { ts: Date.now(), level, msg }]);

  const setPhase = (p: number, label: string) => {
    setProgress(p);
    setProgressLabel(label);
    log("info", label);
  };

  const updateField = <K extends keyof ParsedPolizzaData>(k: K, v: ParsedPolizzaData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const lookupClienti = async (d: ParsedPolizzaData): Promise<ClienteCand[]> => {
    const cf = (d.contraente_codice_fiscale || "").replace(/\s+/g, "").toUpperCase();
    const piva = (d.contraente_partita_iva || "").replace(/\s+/g, "");
    const out: ClienteCand[] = [];
    const seen = new Set<string>();
    if (cf || piva) {
      const orParts: string[] = [];
      // ilike (case-insensitive, exact pattern) tollera differenze di case nel DB
      if (cf) orParts.push(`codice_fiscale.ilike.${cf}`);
      if (piva) orParts.push(`partita_iva.ilike.${piva}`);
      const { data: rows } = await supabase
        .from("clienti")
        .select("id, ragione_sociale, cognome, nome, codice_fiscale, partita_iva")
        .or(orParts.join(","))
        .limit(5);
      const before = out.length;
      (rows || []).forEach((c: any) => {
        if (seen.has(c.id)) return;
        seen.add(c.id);
        out.push({
          id: c.id,
          label: `${c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim()}${c.codice_fiscale ? ` — CF ${c.codice_fiscale}` : ""}${c.partita_iva ? ` — PIVA ${c.partita_iva}` : ""}`,
          cf: c.codice_fiscale,
          piva: c.partita_iva,
        });
      });
    }
    if (out.length < 5) {
      const nameRaw = (d.contraente_nome || "").trim();
      if (nameRaw.length >= 3) {
        const tokens = nameRaw.split(/\s+/).filter((t) => t.length >= 3).slice(0, 2);
        if (tokens.length) {
          const orFilter = tokens
            .flatMap((t) => [`ragione_sociale.ilike.%${t}%`, `cognome.ilike.%${t}%`, `nome.ilike.%${t}%`])
            .join(",");
          const { data: rows } = await supabase
            .from("clienti")
            .select("id, ragione_sociale, cognome, nome, codice_fiscale, partita_iva")
            .or(orFilter)
            .limit(10);
          (rows || []).forEach((c: any) => {
            if (seen.has(c.id) || out.length >= 5) return;
            seen.add(c.id);
            out.push({
              id: c.id,
              label: `${c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim()}${c.codice_fiscale ? ` — CF ${c.codice_fiscale}` : ""}${c.partita_iva ? ` — PIVA ${c.partita_iva}` : ""}`,
              cf: c.codice_fiscale,
              piva: c.partita_iva,
            });
          });
        }
      }
    }
    return out;
  };

  const lookupCompagnie = async (d: ParsedPolizzaData): Promise<CompagniaCand[]> => {
    const compName = (d.compagnia || "").trim();
    if (!compName) return [];
    const tokens = compName.split(/\s+/).filter((t) => t.length >= 3).slice(0, 3);
    if (!tokens.length) return [];
    const orFilter = tokens
      .flatMap((t) => [`nome.ilike.%${t}%`, `gruppo_compagnia.ilike.%${t}%`])
      .join(",");
    const { data: rows } = await supabase
      .from("compagnie")
      .select("id, codice, nome, gruppo_compagnia")
      .or(orFilter)
      .limit(10);
    const seen = new Set<string>();
    const out: CompagniaCand[] = [];
    const lower = compName.toLowerCase();
    (rows || [])
      .map((c: any) => {
        const name = (c.nome || "").toLowerCase();
        const gruppo = (c.gruppo_compagnia || "").toLowerCase();
        const score =
          (name === lower ? 100 : 0) +
          (name.includes(lower) ? 50 : 0) +
          tokens.reduce((acc, t) => acc + (name.includes(t.toLowerCase()) ? 10 : 0) + (gruppo.includes(t.toLowerCase()) ? 5 : 0), 0);
        return { ...c, score };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .forEach((c: any) => {
        if (seen.has(c.id) || out.length >= 5) return;
        seen.add(c.id);
        out.push({ id: c.id, label: `${c.codice ? c.codice + " - " : ""}${c.nome}${c.gruppo_compagnia ? ` (${c.gruppo_compagnia})` : ""}` });
      });
    return out;
  };

  const lookupRami = async (d: ParsedPolizzaData): Promise<RamoCand[]> => {
    const ramoDesc = (d.ramo_descrizione || "").trim();
    if (!ramoDesc) return [];
    const tokens = ramoDesc
      .replace(/[^\p{L}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 4);
    if (!tokens.length) return [];
    const orFilter = tokens.map((t) => `descrizione.ilike.%${t}%`).join(",");
    const { data: rows } = await supabase
      .from("rami")
      .select("id, codice, descrizione, gruppo_ramo_id, gruppi_ramo:gruppo_ramo_id(descrizione)")
      .or(orFilter)
      .limit(10);
    const out: RamoCand[] = [];
    (rows || []).forEach((r: any) => {
      if (!r.gruppo_ramo_id || out.length >= 5) return;
      const gName = r.gruppi_ramo?.descrizione || "";
      out.push({
        gruppoRamoId: r.gruppo_ramo_id,
        ramoId: r.id,
        label: `${gName ? gName + " · " : ""}${r.codice} - ${r.descrizione}`,
      });
    });
    return out;
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File troppo grande (max 15MB)");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setLogs([]);
    setProgress(0);
    try {
      setPhase(10, `Lettura file (${(file.size / 1024).toFixed(0)} KB)…`);
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      setPhase(25, "Conversione base64…");
      const b64 = btoa(bin);
      setPhase(40, "Invio a Gemini per analisi…");
      const { data: resp, error } = await supabase.functions.invoke("parse-polizza-completa", {
        body: { fileBase64: b64, mimeType: file.type || "application/pdf" },
      });
      if (error) throw error;
      if ((resp as any)?.error) throw new Error((resp as any).error);
      const parsed: ParsedPolizzaData = (resp as any)?.data || {};
      setPhase(70, "Estrazione dati completata");
      log("success", `Numero polizza: ${parsed.numero_polizza || "—"}`);
      log("success", `Compagnia: ${parsed.compagnia || "—"} · Ramo: ${parsed.ramo_descrizione || "—"}`);
      log("success", `Contraente: ${parsed.contraente_nome || "—"}`);

      setData(parsed);

      setPhase(80, "Ricerca cliente nel database…");
      const cli = await lookupClienti(parsed);
      setClienteCandidates(cli);
      if (cli.length) {
        log("success", `${cli.length} cliente/i candidato/i trovato/i`);
        setSelectedClienteId(cli[0].id);
      } else {
        log("warn", "Nessun cliente trovato — andrà creato");
        setSelectedClienteId(NEW_CLIENTE);
      }

      setPhase(88, "Ricerca compagnia…");
      const comp = await lookupCompagnie(parsed);
      setCompagniaCandidates(comp);
      if (comp.length) {
        log("success", `${comp.length} compagnia/e candidata/e`);
        setSelectedCompagniaId(comp[0].id);
      } else {
        log("warn", "Nessuna compagnia trovata");
      }

      setPhase(95, "Ricerca ramo…");
      const ram = await lookupRami(parsed);
      setRamoCandidates(ram);
      if (ram.length) {
        log("success", `${ram.length} ramo/i candidato/i`);
        const k = `${ram[0].gruppoRamoId}:${ram[0].ramoId}`;
        setSelectedRamoKey(k);
      } else {
        log("warn", "Nessun ramo mappato — selezionalo manualmente nel form");
      }

      setPhase(100, "Completato");
      log("success", "Pronto per la revisione");
      setStep("review");
      toast.success("Documento analizzato");
    } catch (e: any) {
      console.error(e);
      log("error", `Errore: ${e?.message || "sconosciuto"}`);
      toast.error("Estrazione fallita: " + (e?.message || "errore"));
    } finally {
      setParsing(false);
    }
  };

  const recalculaLordo = (which: "firma" | "quietanza") => {
    const k: any = which === "firma"
      ? ["premio_firma_netto", "premio_firma_imposte", "premio_firma_accessori", "premio_firma_lordo"]
      : ["premio_quietanza_netto", "premio_quietanza_imposte", "premio_quietanza_accessori", "premio_quietanza_lordo"];
    const tot = (Number((data as any)[k[0]]) || 0) + (Number((data as any)[k[1]]) || 0) + (Number((data as any)[k[2]]) || 0);
    updateField(k[3] as any, Number(tot.toFixed(2)) as any);
    toast.success(`Lordo ${which} ricalcolato: ${fmtEur(tot)}`);
  };

  const isNewCliente = selectedClienteId === NEW_CLIENTE;
  const selectedGruppoFinanziario = useMemo(
    () => gruppiFinanziari.find((g) => g.id === selectedGruppoFinanziarioId) || null,
    [gruppiFinanziari, selectedGruppoFinanziarioId],
  );
  const tipoClienteAuto = selectedGruppoFinanziario?.tipo_soggetto;
  const cupRequired = tipoClienteAuto === "ente";
  const newClienteReady =
    !isNewCliente || (!!selectedGruppoFinanziarioId && (!cupRequired || codiceCupNew.trim().length > 0));

  const buildResult = (): MatchResult => {
    const cliente =
      selectedClienteId && selectedClienteId !== NEW_CLIENTE
        ? clienteCandidates.find((c) => c.id === selectedClienteId)
        : null;
    const compagnia = compagniaCandidates.find((c) => c.id === selectedCompagniaId) || null;
    const ramo = ramoCandidates.find((r) => `${r.gruppoRamoId}:${r.ramoId}` === selectedRamoKey) || null;
    return {
      data,
      cliente: cliente ? { id: cliente.id, label: cliente.label } : null,
      compagnia: compagnia ? { id: compagnia.id, label: compagnia.label } : null,
      ramo: ramo ? { gruppoRamoId: ramo.gruppoRamoId, ramoId: ramo.ramoId, label: ramo.label } : null,
      isNewCliente,
      gruppoFinanziarioId: isNewCliente ? selectedGruppoFinanziarioId || undefined : undefined,
      tipoCliente: isNewCliente ? tipoClienteAuto : undefined,
      codiceCup: isNewCliente && cupRequired ? codiceCupNew.trim() || undefined : undefined,
    };
  };

  const canProceed = !!selectedClienteId && newClienteReady;

  const apply = () => {
    if (!selectedClienteId) {
      toast.error("Seleziona un cliente esistente o scegli 'Crea nuovo cliente'");
      return;
    }
    if (isNewCliente && !selectedGruppoFinanziarioId) {
      toast.error("Seleziona il Gruppo Finanziario per il nuovo cliente");
      return;
    }
    if (isNewCliente && cupRequired && !codiceCupNew.trim()) {
      toast.error("Inserisci il Codice CUP (obbligatorio per gli Enti)");
      return;
    }
    onApply(buildResult());
    onOpenChange(false);
    reset();
  };

  const clienteOptions = useMemo(
    () => [
      ...clienteCandidates.map((c) => ({ value: c.id, label: c.label })),
      { value: NEW_CLIENTE, label: "➕ Crea nuovo cliente da questi dati…" },
    ],
    [clienteCandidates],
  );


  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600" />
            Importa polizza da PDF (AI)
            {step !== "upload" && (
              <Badge variant="outline" className="ml-2">
                {step === "review" ? "2. Revisione" : "3. Riepilogo"}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Carica la scheda di polizza, verifica/correggi i dati estratti, scegli i match e applica al form.
          </DialogDescription>
        </DialogHeader>

        {/* PROGRESS + LOG */}
        {(parsing || logs.length > 0) && step === "upload" && (
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{progressLabel || "In attesa…"}</span>
              <span className="tabular-nums text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <ScrollArea className="h-32 rounded border bg-background">
              <div ref={logScrollRef} className="p-2 space-y-0.5 text-[11px] font-mono">
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className={cn(
                      l.level === "error" && "text-destructive",
                      l.level === "warn" && "text-amber-600",
                      l.level === "success" && "text-teal-700",
                      l.level === "info" && "text-muted-foreground",
                    )}
                  >
                    [{new Date(l.ts).toLocaleTimeString("it-IT")}] {l.msg}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* STEP UPLOAD */}
        {step === "upload" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => !parsing && fileInput.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors",
              dragOver ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30" : "border-muted-foreground/30 hover:border-teal-400",
              parsing && "opacity-60 cursor-wait",
            )}
          >
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept="application/pdf,image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {parsing ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                <span>Analisi in corso… non chiudere il dialog</span>
                {fileName && <span className="text-xs">{fileName}</span>}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <UploadCloud className="h-10 w-10 text-teal-600" />
                <span className="font-medium">Trascina la scheda di polizza o clicca per selezionare</span>
                <span className="text-xs">PDF o immagini, max 15MB</span>
              </div>
            )}
          </div>
        )}

        {/* STEP REVIEW */}
        {step === "review" && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{fileName}</span>
              <Badge variant="secondary">analizzato</Badge>
            </div>

            {/* CLIENTE */}
            <section className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  Cliente
                  {isNewCliente ? (
                    <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300">
                      <UserPlus className="h-3 w-3" /> Nuovo
                    </Badge>
                  ) : selectedClienteId ? (
                    <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Esistente
                    </Badge>
                  ) : null}
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {clienteCandidates.length} candidato/i
                </span>
              </div>
              <div>
                <Label className="text-xs">Match cliente</Label>
                <SearchableSelect
                  value={selectedClienteId}
                  onValueChange={setSelectedClienteId}
                  placeholder="— Seleziona un cliente o crea nuovo —"
                  options={clienteOptions}
                  emptyText="Nessun candidato"
                />
              </div>
              {isNewCliente && (
                <>
                  {/* Gruppo Finanziario inline: determina automaticamente il tipo cliente */}
                  <div
                    className={cn(
                      "rounded border p-3 space-y-3",
                      !selectedGruppoFinanziarioId
                        ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                        : "border-teal-300 bg-teal-50/40 dark:bg-teal-950/20",
                    )}
                  >
                    <div>
                      <Label className="text-xs">Gruppo Finanziario *</Label>
                      <SearchableSelect
                        value={selectedGruppoFinanziarioId}
                        onValueChange={(v) => {
                          setSelectedGruppoFinanziarioId(v);
                          const gf = gruppiFinanziari.find((g) => g.id === v);
                          if (gf?.tipo_soggetto !== "ente") setCodiceCupNew("");
                        }}
                        placeholder="— Cerca e seleziona gruppo finanziario —"
                        options={gruppiFinanziari.map((g) => ({
                          value: g.id,
                          label: `${g.codice} - ${g.nome}`,
                        }))}
                        emptyText="Nessun gruppo trovato"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Tipo Cliente:</span>
                      {tipoClienteAuto ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            tipoClienteAuto === "privato" && "border-blue-500 text-blue-700 bg-blue-50",
                            tipoClienteAuto === "azienda" && "border-emerald-600 text-emerald-700 bg-emerald-50",
                            tipoClienteAuto === "ente" && "border-amber-600 text-amber-700 bg-amber-50",
                          )}
                        >
                          {tipoClienteAuto === "privato"
                            ? "Privato"
                            : tipoClienteAuto === "azienda"
                              ? "Azienda"
                              : "Ente"}{" "}
                          (auto)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Seleziona un gruppo finanziario
                        </Badge>
                      )}
                    </div>
                    {cupRequired && (
                      <div>
                        <Label className="text-xs">Codice CUP * (obbligatorio per gli Enti)</Label>
                        <Input
                          value={codiceCupNew}
                          onChange={(e) => setCodiceCupNew(e.target.value)}
                          placeholder="Inserisci Codice CUP"
                          className={cn(
                            "h-8 text-xs",
                            !codiceCupNew.trim() && "border-amber-400",
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
                      "rounded border p-2 text-xs flex gap-2 items-start",
                      newClienteReady
                        ? "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-200"
                        : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200",
                    )}
                  >
                    {newClienteReady ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    )}
                    <span className="flex-1 leading-relaxed">
                      {newClienteReady
                        ? "Tutto pronto: cliccando Applica verrà aperto il form Nuovo Cliente pre-compilato (incluso Gruppo Finanziario) per il salvataggio."
                        : "Seleziona il Gruppo Finanziario qui sopra (e il Codice CUP per gli Enti) prima di proseguire. Il tipo cliente verrà derivato automaticamente."}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <FieldInput label="Nome / Ragione Sociale" value={data.contraente_nome} onChange={(v) => updateField("contraente_nome", v)} />
                    <FieldInput label="Codice Fiscale" value={data.contraente_codice_fiscale} onChange={(v) => updateField("contraente_codice_fiscale", v.toUpperCase())} />
                    <FieldInput label="Partita IVA" value={data.contraente_partita_iva} onChange={(v) => updateField("contraente_partita_iva", v)} />
                    <FieldInput label="Email" value={data.contraente_email} onChange={(v) => updateField("contraente_email", v)} />
                    <FieldInput label="Telefono" value={data.contraente_telefono} onChange={(v) => updateField("contraente_telefono", v)} />
                    <FieldInput label="Indirizzo" value={data.contraente_indirizzo} onChange={(v) => updateField("contraente_indirizzo", v)} />
                    <FieldInput label="CAP" value={data.contraente_cap} onChange={(v) => updateField("contraente_cap", v)} />
                    <FieldInput label="Comune" value={data.contraente_comune} onChange={(v) => updateField("contraente_comune", v)} />
                    <FieldInput label="Provincia" value={data.contraente_provincia} onChange={(v) => updateField("contraente_provincia", v.toUpperCase())} />
                    <FieldInput label="Nazione" value={data.contraente_nazione} onChange={(v) => updateField("contraente_nazione", v)} />
                  </div>
                </>
              )}
            </section>

            {/* COMPAGNIA & RAMO */}
            <section className="border rounded-lg p-3 space-y-3">
              <h3 className="font-semibold">Compagnia & Ramo</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Compagnia (dal PDF: <em>{data.compagnia || "—"}</em>)</Label>
                  <SearchableSelect
                    value={selectedCompagniaId}
                    onValueChange={setSelectedCompagniaId}
                    placeholder="— Seleziona compagnia —"
                    options={compagniaCandidates.map((c) => ({ value: c.id, label: c.label }))}
                    emptyText="Nessun match — selezionala dal form"
                  />
                </div>
                <div>
                  <Label className="text-xs">Ramo (dal PDF: <em>{data.ramo_descrizione || "—"}</em>)</Label>
                  <SearchableSelect
                    value={selectedRamoKey}
                    onValueChange={setSelectedRamoKey}
                    placeholder="— Seleziona ramo —"
                    options={ramoCandidates.map((r) => ({ value: `${r.gruppoRamoId}:${r.ramoId}`, label: r.label }))}
                    emptyText="Nessun match — selezionalo dal form"
                  />
                </div>
                <FieldInput label="Prodotto" value={data.prodotto} onChange={(v) => updateField("prodotto", v)} />
                <FieldInput label="Numero Polizza" value={data.numero_polizza} onChange={(v) => updateField("numero_polizza", v)} />
              </div>
            </section>

            {/* PERIODO */}
            <section className="border rounded-lg p-3 space-y-3">
              <h3 className="font-semibold">Periodo</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Decorrenza</Label>
                  <Input type="date" value={data.decorrenza || ""} onChange={(e) => updateField("decorrenza", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Scadenza</Label>
                  <Input type="date" value={data.scadenza || ""} onChange={(e) => updateField("scadenza", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Frazionamento</Label>
                  <SearchableSelect
                    value={data.frazionamento || ""}
                    onValueChange={(v) => updateField("frazionamento", v)}
                    placeholder="—"
                    options={[
                      { value: "annuale", label: "Annuale" },
                      { value: "semestrale", label: "Semestrale" },
                      { value: "quadrimestrale", label: "Quadrimestrale" },
                      { value: "trimestrale", label: "Trimestrale" },
                      { value: "mensile", label: "Mensile" },
                      { value: "unico", label: "Premio unico" },
                    ]}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Switch checked={!!data.tacito_rinnovo} onCheckedChange={(v) => updateField("tacito_rinnovo", v)} />
                  <Label className="text-xs">Tacito rinnovo</Label>
                </div>
              </div>
            </section>

            {/* PREMI */}
            <section className="border rounded-lg p-3 space-y-3">
              <h3 className="font-semibold">Premi</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PremiBlock
                  title="Alla Firma"
                  netto={data.premio_firma_netto}
                  imposte={data.premio_firma_imposte}
                  accessori={data.premio_firma_accessori}
                  lordo={data.premio_firma_lordo}
                  setNetto={(v) => updateField("premio_firma_netto", v)}
                  setImposte={(v) => updateField("premio_firma_imposte", v)}
                  setAccessori={(v) => updateField("premio_firma_accessori", v)}
                  setLordo={(v) => updateField("premio_firma_lordo", v)}
                  onRecalc={() => recalculaLordo("firma")}
                />
                <PremiBlock
                  title="Prossima Quietanza"
                  netto={data.premio_quietanza_netto}
                  imposte={data.premio_quietanza_imposte}
                  accessori={data.premio_quietanza_accessori}
                  lordo={data.premio_quietanza_lordo}
                  setNetto={(v) => updateField("premio_quietanza_netto", v)}
                  setImposte={(v) => updateField("premio_quietanza_imposte", v)}
                  setAccessori={(v) => updateField("premio_quietanza_accessori", v)}
                  setLordo={(v) => updateField("premio_quietanza_lordo", v)}
                  onRecalc={() => recalculaLordo("quietanza")}
                />
              </div>
            </section>

            {/* GARANZIE */}
            {data.garanzie && data.garanzie.length > 0 && (
              <section className="border rounded-lg p-3 space-y-2">
                <h3 className="font-semibold">Garanzie ({data.garanzie.length})</h3>
                <div className="space-y-2">
                  {data.garanzie.map((g, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-6">
                        <Label className="text-[11px]">Descrizione</Label>
                        <Input
                          value={g.descrizione}
                          onChange={(e) => {
                            const arr = [...(data.garanzie || [])];
                            arr[i] = { ...arr[i], descrizione: e.target.value };
                            updateField("garanzie", arr);
                          }}
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-[11px]">Massimale</Label>
                        <Input
                          type="number"
                          value={g.massimale ?? ""}
                          onChange={(e) => {
                            const arr = [...(data.garanzie || [])];
                            arr[i] = { ...arr[i], massimale: num(e.target.value) };
                            updateField("garanzie", arr);
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[11px]">Premio netto</Label>
                        <Input
                          type="number"
                          value={g.premio_netto ?? ""}
                          onChange={(e) => {
                            const arr = [...(data.garanzie || [])];
                            arr[i] = { ...arr[i], premio_netto: num(e.target.value) };
                            updateField("garanzie", arr);
                          }}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const arr = (data.garanzie || []).filter((_, j) => j !== i);
                            updateField("garanzie", arr);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* STEP SUMMARY */}
        {step === "summary" && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border p-3 bg-muted/30">
              <h3 className="font-semibold mb-2">Riepilogo finale</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <SummaryRow
                  label="Cliente"
                  badge={isNewCliente ? "nuovo" : selectedClienteId ? "esistente" : "mancante"}
                  value={
                    isNewCliente
                      ? `${data.contraente_nome || "—"} (da creare)`
                      : clienteCandidates.find((c) => c.id === selectedClienteId)?.label || "—"
                  }
                />
                <SummaryRow
                  label="Compagnia"
                  badge={selectedCompagniaId ? "ok" : "mancante"}
                  value={compagniaCandidates.find((c) => c.id === selectedCompagniaId)?.label || data.compagnia || "—"}
                />
                <SummaryRow
                  label="Ramo"
                  badge={selectedRamoKey ? "ok" : "mancante"}
                  value={ramoCandidates.find((r) => `${r.gruppoRamoId}:${r.ramoId}` === selectedRamoKey)?.label || data.ramo_descrizione || "—"}
                />
                <SummaryRow label="N. Polizza" value={data.numero_polizza} />
                <SummaryRow label="Prodotto" value={data.prodotto} />
                <SummaryRow label="Periodo" value={`${data.decorrenza || "—"} → ${data.scadenza || "—"}`} />
                <SummaryRow label="Frazionamento" value={data.frazionamento} />
                <SummaryRow label="Tacito rinnovo" value={data.tacito_rinnovo ? "Sì" : "No"} />
                <SummaryRow label="Premio firma (lordo)" value={fmtEur(data.premio_firma_lordo)} bold />
                <SummaryRow label="Premio quietanza (lordo)" value={fmtEur(data.premio_quietanza_lordo)} bold />
                <SummaryRow label="Garanzie" value={String(data.garanzie?.length || 0)} />
              </div>
            </div>
            {isNewCliente && (
              <div className="rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
                <UserPlus className="h-4 w-4 shrink-0" />
                Cliccando <strong>Crea cliente e applica</strong> si aprirà il form Nuovo Cliente
                pre-compilato. Completa i campi obbligatori (Gruppo Finanziario, eventuale CUP) e
                salva: la polizza verrà poi pre-compilata con questi dati.
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "review" && (
            <>
              <Button variant="outline" onClick={() => { reset(); }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Cambia file
              </Button>
              <Button onClick={() => setStep("summary")} disabled={!canProceed}>
                Riepilogo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {step === "summary" && (
            <>
              <Button variant="outline" onClick={() => setStep("review")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Modifica
              </Button>
              <Button onClick={apply} disabled={!canProceed}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {isNewCliente ? "Crea cliente e applica" : "Applica al form"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({
  label, value, onChange, type = "text",
}: { label: string; value?: string | number | null; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="text-[11px]">{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" />
    </div>
  );
}

function PremiBlock({
  title, netto, imposte, accessori, lordo,
  setNetto, setImposte, setAccessori, setLordo, onRecalc,
}: {
  title: string;
  netto?: number; imposte?: number; accessori?: number; lordo?: number;
  setNetto: (v?: number) => void; setImposte: (v?: number) => void;
  setAccessori: (v?: number) => void; setLordo: (v?: number) => void;
  onRecalc: () => void;
}) {
  return (
    <div className="space-y-2 border rounded p-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="font-medium text-xs text-muted-foreground">{title}</div>
        <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px]" onClick={onRecalc}>
          <Calculator className="h-3 w-3 mr-1" /> Ricalcola lordo
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumInput label="Netto" value={netto} onChange={setNetto} />
        <NumInput label="Imposte" value={imposte} onChange={setImposte} />
        <NumInput label="Accessori" value={accessori} onChange={setAccessori} />
        <NumInput label="Lordo" value={lordo} onChange={setLordo} bold />
      </div>
    </div>
  );
}

function NumInput({
  label, value, onChange, bold,
}: { label: string; value?: number; onChange: (v?: number) => void; bold?: boolean }) {
  return (
    <div>
      <Label className="text-[11px]">{label}</Label>
      <Input
        type="number"
        step="0.01"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Number(v));
        }}
        className={cn("h-8 text-xs tabular-nums", bold && "font-semibold")}
      />
    </div>
  );
}

function SummaryRow({
  label, value, bold, badge,
}: { label: string; value?: string | number | null; bold?: boolean; badge?: "ok" | "nuovo" | "esistente" | "mancante" }) {
  return (
    <div className="flex justify-between gap-2 border-b last:border-0 pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right", bold && "font-semibold")}>
        {value || "—"}
        {badge === "esistente" && <Badge className="ml-2 bg-teal-100 text-teal-800 hover:bg-teal-100">esistente</Badge>}
        {badge === "ok" && <Badge className="ml-2 bg-teal-100 text-teal-800 hover:bg-teal-100">ok</Badge>}
        {badge === "nuovo" && <Badge variant="outline" className="ml-2 text-amber-700 border-amber-300">nuovo</Badge>}
        {badge === "mancante" && <Badge variant="outline" className="ml-2 text-destructive border-destructive/40">manca</Badge>}
      </span>
    </div>
  );
}
