import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect, type SearchableSelectOption } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { Loader2, AlertCircle, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { logAttivita } from "@/lib/logAttivita";
import { resolveTitoloMadreId } from "@/lib/sospensioneQuietanze";
import {
  aggregateGaranziePremi,
  calcProvvigioniAppendice,
  creaTitoloDaAppendice,
  patchTitoloDerivatoAppendice,
  syncPremiGaranziaToTitolo,
  type AppendiceTipo,
} from "@/lib/appendicePremi";
import { PolizzaEditorInline, type PolizzaEditorHandle, type PolizzaEditorState } from "@/components/polizze/PolizzaEditorInline";
import { OperazionePolizzaDialogShell } from "@/components/polizze/operazione/OperazionePolizzaDialogShell";
import { OperazioneAllegatoField } from "@/components/polizze/operazione/OperazioneAllegatoField";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";

const TIPI_APPENDICE = [
  { value: "modifica", label: "Modifica" },
  { value: "proroga", label: "Appendice di proroga" },
  { value: "regolazione", label: "Regolazione" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string | null;
  numeroTitolo?: string | null;
  initialTipo?: string;
  onCreated?: () => void;
}

const fmt = (n: number | null | undefined) =>
  n == null ? "-" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("it-IT") : "-");

const TIPO_INFO: Record<AppendiceTipo, { title: string; hint: string; suffix: string }> = {
  modifica: {
    title: "Appendice di modifica",
    hint: "Genera un titolo AM cassabile (anche a €0). Compila o correggi la composizione premi qui sotto prima di salvare.",
    suffix: "AM",
  },
  proroga: {
    title: "Appendice di proroga",
    hint: "Genera un titolo PR cassabile. All'incasso estende automaticamente la scadenza della polizza madre.",
    suffix: "PR",
  },
  regolazione: {
    title: "Regolazione premio",
    hint: "Genera un titolo RG collegato alla quietanza di riferimento. Cassabile anche a premio zero.",
    suffix: "RG",
  },
};

export function AppendiceDialog({ open, onOpenChange, titoloId, numeroTitolo, initialTipo, onCreated }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const editorRef = useRef<PolizzaEditorHandle>(null);

  const [madreId, setMadreId] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [editorState, setEditorState] = useState<PolizzaEditorState | null>(null);

  const [numeroAppendice, setNumeroAppendice] = useState("");
  const [dataAppendice, setDataAppendice] = useState(new Date().toISOString().slice(0, 10));
  const [dataEffetto, setDataEffetto] = useState("");
  const [oggetto, setOggetto] = useState("");
  const [tipo, setTipo] = useState<AppendiceTipo>("modifica");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [quietanzaId, setQuietanzaId] = useState("");

  const handleEditorStateChange = useCallback((state: PolizzaEditorState) => {
    setEditorState(state);
    setEditorReady(true);
  }, []);

  const { data: existing } = useQuery({
    queryKey: ["appendici-count", titoloId],
    enabled: !!titoloId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("appendici_polizza")
        .select("numero_appendice")
        .eq("titolo_id", titoloId!);
      return data || [];
    },
  });

  const { data: titoloInfo } = useQuery({
    queryKey: ["titolo-scadenza", titoloId],
    enabled: !!titoloId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("data_scadenza, garanzia_da, garanzia_a, numero_titolo, premio_netto, provvigioni_firma, percentuale_provvigione")
        .eq("id", titoloId!)
        .maybeSingle();
      if (!data) return null;
      const perc =
        data.percentuale_provvigione != null
          ? Number(data.percentuale_provvigione)
          : data.premio_netto && Number(data.premio_netto) !== 0 && data.provvigioni_firma != null
            ? +((Number(data.provvigioni_firma) / Number(data.premio_netto)) * 100).toFixed(4)
            : null;
      return { ...data, percentuale_provvigione_calc: perc };
    },
  });

  const STATI_VALIDI = ["attivo", "incassato", "sospeso"];
  const { data: catena } = useQuery({
    queryKey: ["catena-quietanze", titoloInfo?.numero_titolo],
    enabled: !!titoloInfo?.numero_titolo && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, riga, garanzia_da, garanzia_a, data_scadenza, premio_lordo, premio_netto, tasse, sostituisce_polizza, is_regolazione, is_proroga, is_appendice_modifica, stato, numero_titolo")
        .eq("numero_titolo", titoloInfo!.numero_titolo!)
        .order("garanzia_da", { ascending: false });
      return (data || []).filter(
        (t: { is_regolazione?: boolean; is_proroga?: boolean; is_appendice_modifica?: boolean; stato?: string }) =>
          !t.is_regolazione && !t.is_proroga && !t.is_appendice_modifica && STATI_VALIDI.includes((t.stato || "").toLowerCase()),
      );
    },
  });

  const quietanzaOptions: SearchableSelectOption[] = useMemo(() => {
    const list = catena || [];
    return list.map((t: { id: string; riga?: number; garanzia_da?: string; garanzia_a?: string; premio_lordo?: number; stato?: string }, i: number) => {
      const stato = (t.stato || "").toLowerCase();
      const statoBadge = stato ? ` · ${stato}` : "";
      const label = `Rata ${list.length - i} · ${fmtDate(t.garanzia_da)} → ${fmtDate(t.garanzia_a)} · ${fmt(t.premio_lordo)}${statoBadge}`;
      const searchText = [t.riga, fmtDate(t.garanzia_da), fmtDate(t.garanzia_a), stato, t.premio_lordo != null ? String(t.premio_lordo) : ""]
        .filter(Boolean)
        .join(" ");
      return { value: t.id, label, searchText };
    });
  }, [catena]);

  useEffect(() => {
    if (!open || !titoloId) {
      setMadreId(null);
      setEditorReady(false);
      return;
    }
    (async () => {
      const resolved = await resolveTitoloMadreId(supabase, titoloId);
      setMadreId(resolved);
    })();
  }, [open, titoloId]);

  useEffect(() => {
    if (!open) {
      setEditorReady(false);
      setEditorState(null);
      return;
    }
    const max = (existing || []).reduce((acc, a: { numero_appendice?: string }) => Math.max(acc, parseInt(a.numero_appendice || "0") || 0), 0);
    setNumeroAppendice(String(max + 1));
    const t = (initialTipo as AppendiceTipo) || "modifica";
    setTipo(TIPI_APPENDICE.some((x) => x.value === t) ? t : "modifica");
    setOggetto("");
    setNote("");
    setQuietanzaId("");
    setFile(null);
    setDisplayName("");
    setFiles([]);

    const garDa = titoloInfo?.garanzia_da;
    const garA = titoloInfo?.garanzia_a || titoloInfo?.data_scadenza;
    setDataAppendice(garA || new Date().toISOString().slice(0, 10));
    setDataEffetto(garDa || "");
  }, [open, existing, titoloInfo, initialTipo]);

  useEffect(() => {
    if (!open || tipo !== "proroga" || !titoloInfo?.garanzia_a) return;
    const d = new Date(titoloInfo.garanzia_a);
    d.setDate(d.getDate() + 1);
    setDataEffetto(d.toISOString().slice(0, 10));
    setDataAppendice("");
  }, [open, tipo, titoloInfo?.garanzia_a]);

  useEffect(() => {
    if (tipo !== "regolazione" || !quietanzaId || !catena) return;
    const q = catena.find((t: { id: string }) => t.id === quietanzaId);
    if (!q) return;
    setDataEffetto(q.garanzia_da || "");
    setDataAppendice(q.garanzia_a || "");
    setEditorReady(false);
    setEditorState(null);
  }, [quietanzaId, catena, tipo]);

  const percProvv = titoloInfo?.percentuale_provvigione_calc ?? null;
  const aggregated = useMemo(
    () => (editorState ? aggregateGaranziePremi(editorState.garanzie) : null),
    [editorState],
  );

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!dataEffetto) e.dataEffetto = "Data effetto obbligatoria";
    if (!dataAppendice) e.dataAppendice = "Data scadenza obbligatoria";
    if (dataEffetto && dataAppendice && dataEffetto > dataAppendice) {
      e.dataEffetto = "La data effetto deve precedere la scadenza";
    }
    if (tipo === "regolazione" && !quietanzaId) e.quietanzaId = "Seleziona la quietanza di riferimento";
    if (tipo === "regolazione" && !quietanzaId) e.editor = "Seleziona la quietanza di riferimento";
    else if (!editorReady) e.editor = "Caricamento composizione premi…";
    return e;
  }, [dataEffetto, dataAppendice, tipo, quietanzaId, editorReady]);

  const hasErrors = Object.keys(errors).length > 0;

  const mut = useMutation({
    mutationFn: async () => {
      if (!titoloId || !madreId) throw new Error("Titolo non specificato");
      if (!numeroAppendice.trim()) throw new Error("Numero appendice obbligatorio");
      if (!dataEffetto || !dataAppendice) throw new Error("Inserisci data effetto e scadenza");
      if (dataEffetto > dataAppendice) throw new Error("La data effetto non può essere successiva alla scadenza");
      if (tipo === "regolazione" && !quietanzaId) throw new Error("Seleziona la quietanza di riferimento");

      const state = editorRef.current?.getState();
      if (!state) throw new Error("Editor polizza non pronto");

      const agg = aggregateGaranziePremi(state.garanzie);
      const provvigioni = calcProvvigioniAppendice(agg.premio_netto, percProvv);

      let filePath: string | null = null;
      let nomeFile: string | null = null;
      const allegati: Array<{ path: string; nome: string; size: number; type: string }> = [];

      const toUpload: File[] = [...files, ...(file ? [file] : [])];
      for (let i = 0; i < toUpload.length; i++) {
        const f = toUpload[i];
        const path = `appendici/${titoloId}/${Date.now()}_${i}_${f.name}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, f);
        if (upErr) throw upErr;
        allegati.push({ path, nome: displayName || f.name, size: f.size, type: f.type });
        if (i === 0) {
          filePath = path;
          nomeFile = displayName || f.name;
        }
      }

      const payload = {
        titolo_id: titoloId,
        numero_appendice: numeroAppendice.trim(),
        data_appendice: dataAppendice,
        data_effetto: dataEffetto,
        oggetto: oggetto.trim() || null,
        tipo,
        file_path: filePath,
        nome_file: nomeFile,
        allegati,
        note: note.trim() || null,
        created_by: user?.id || null,
        quietanza_id: tipo === "regolazione" ? quietanzaId : null,
        premio_netto: agg.premio_netto,
        tasse: agg.tasse,
        premio_lordo: agg.premio_lordo,
        provvigioni,
        percentuale_provvigione: percProvv,
      };

      const { data, error } = await supabase.from("appendici_polizza").insert(payload).select().single();
      if (error) throw error;

      const titoloDerivatoId = await creaTitoloDaAppendice(supabase, tipo, data.id);

      await patchTitoloDerivatoAppendice(supabase, titoloDerivatoId, {
        dataEffetto,
        dataScadenza: dataAppendice,
        oggetto: oggetto.trim() || `${TIPO_INFO[tipo].title} - ${numeroTitolo || ""}`,
        aggregated: agg,
        provvigioni,
        percProvv,
      });
      await syncPremiGaranziaToTitolo(supabase, titoloDerivatoId, state.garanzie);

      const azione =
        tipo === "modifica" ? "appendice_modifica_creata" : tipo === "proroga" ? "proroga_creata" : "regolazione_creata";
      await logAttivita({
        azione,
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: {
          numero_appendice: numeroAppendice.trim(),
          tipo,
          oggetto: oggetto.trim() || null,
          quietanza_id: tipo === "regolazione" ? quietanzaId : undefined,
          titolo_derivato_id: titoloDerivatoId,
        },
      });

      return { appendice: data, titoloDerivatoId };
    },
    onSuccess: (res) => {
      const info = TIPO_INFO[tipo];
      toast.success(`${info.title} creata`, {
        description: `Titolo ${info.suffix} generato. Ora è in Avvisi di incasso e pronto per la messa a cassa (anche a €0).`,
        action: res.titoloDerivatoId
          ? { label: "Apri titolo", onClick: () => navigate(`/titoli/${res.titoloDerivatoId}`) }
          : undefined,
      });
      qc.invalidateQueries({ queryKey: ["appendici-polizza", titoloId] });
      qc.invalidateQueries({ queryKey: ["appendici-count", titoloId] });
      qc.invalidateQueries({ queryKey: ["gestione-polizze"] });
      qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
      onCreated?.();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || "Errore nel salvataggio"),
  });

  const errClass = "border-destructive focus-visible:ring-destructive";
  const ErrMsg = ({ id }: { id: string }) =>
    errors[id] ? (
      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
        <AlertCircle className="h-3 w-3" /> {errors[id]}
      </p>
    ) : null;

  const tipoInfo = TIPO_INFO[tipo];

  const eventColumn = (
    <div className="space-y-4">
      <div className={cn(
        "rounded-md border p-3 text-sm",
        tipo === "proroga"
          ? "border-blue-300 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200"
          : tipo === "regolazione"
            ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
            : "border-primary/30 bg-primary/5 text-foreground",
      )}>
        <strong>{tipoInfo.title}:</strong> {tipoInfo.hint}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Numero appendice *</Label>
          <Input value={numeroAppendice} readOnly disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground mt-1">Progressivo automatico</p>
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as AppendiceTipo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPI_APPENDICE.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tipo === "regolazione" && (
          <div className="md:col-span-2">
            <Label>Quietanza di riferimento *</Label>
            <SearchableSelect
              options={quietanzaOptions}
              value={quietanzaId}
              onValueChange={setQuietanzaId}
              placeholder="Scegli la rata su cui agganciare la regolazione…"
              emptyText="Nessuna quietanza disponibile"
              className={cn(errors.quietanzaId && errClass)}
            />
            <ErrMsg id="quietanzaId" />
          </div>
        )}

        <div>
          <Label>Data effetto *</Label>
          <Input
            type="date"
            value={dataEffetto}
            onChange={(e) => setDataEffetto(e.target.value)}
            className={cn(errors.dataEffetto && errClass)}
          />
          <ErrMsg id="dataEffetto" />
        </div>
        <div>
          <Label>Data scadenza *</Label>
          <Input
            type="date"
            value={dataAppendice}
            onChange={(e) => setDataAppendice(e.target.value)}
            className={cn(errors.dataAppendice && errClass)}
          />
          <ErrMsg id="dataAppendice" />
        </div>

        <div className="md:col-span-2">
          <Label>Oggetto</Label>
          <Input
            value={oggetto}
            onChange={(e) => setOggetto(e.target.value)}
            placeholder={
              tipo === "proroga"
                ? "Es. Proroga al 31/12/2027"
                : tipo === "regolazione"
                  ? "Es. Conguaglio premio 2026"
                  : "Es. Variazione massimali / aggiornamento dati"
            }
          />
        </div>

        <div className="md:col-span-2">
          <Label>Note interne</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="md:col-span-2">
          <OperazioneAllegatoField
            file={file}
            displayName={displayName}
            onFileChange={(f, name) => {
              setFile(f);
              setDisplayName(name);
            }}
            onDisplayNameChange={setDisplayName}
            label="Allegato (opzionale)"
            id="appendice-allegato"
          />
        </div>
      </div>

      {aggregated && (
        <div className="rounded-md border bg-muted/40 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Netto</div>
            <div className="font-semibold tabular-nums">{fmt(aggregated.premio_netto)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Tasse</div>
            <div className="font-semibold tabular-nums">{fmt(aggregated.tasse)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Lordo</div>
            <div className="font-semibold tabular-nums">{fmt(aggregated.premio_lordo)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Provvigioni</div>
            <div className="font-semibold tabular-nums">
              {fmt(calcProvvigioniAppendice(aggregated.premio_netto, percProvv))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const editorTitoloId =
    tipo === "regolazione" ? (quietanzaId || null) : madreId;

  const editorColumn =
    tipo === "regolazione" && !quietanzaId ? (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground text-center">
        Seleziona la quietanza di riferimento per caricare e modificare la composizione premi.
      </div>
    ) : editorTitoloId ? (
    <PolizzaSection title="Composizione premi (quietanza)" icon={Receipt}>
      <p className="text-xs text-muted-foreground mb-3">
        {tipo === "regolazione" && quietanzaId
          ? "Premi della quietanza di riferimento: modificali prima di creare il titolo RG cassabile."
          : `Stessa interfaccia della polizza: modifica le garanzie e gli importi prima di creare il titolo ${tipoInfo.suffix} cassabile.`}
      </p>
      <PolizzaEditorInline
        key={editorTitoloId}
        ref={editorRef}
        titoloId={editorTitoloId}
        onStateChange={handleEditorStateChange}
      />
      <ErrMsg id="editor" />
    </PolizzaSection>
  ) : (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
      <Loader2 className="h-4 w-4 animate-spin" /> Caricamento polizza…
    </div>
  );

  return (
    <OperazionePolizzaDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={`Nuova appendice — Polizza ${numeroTitolo || ""}`}
      description={tipoInfo.hint}
      eventColumn={eventColumn}
      editorColumn={editorColumn}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Annulla
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !titoloId || hasErrors}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crea {tipoInfo.suffix} e appendice
          </Button>
        </>
      }
    />
  );
}
