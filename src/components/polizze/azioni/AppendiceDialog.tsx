import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect, type SearchableSelectOption } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { Loader2, AlertCircle, FileIcon, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { logAttivita } from "@/lib/logAttivita";

const TIPI_APPENDICE = [
  { value: "modifica", label: "Modifica" },
  { value: "proroga", label: "Appendice di proroga" },
  { value: "regolazione", label: "Regolazione" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string | null;
  numeroTitolo?: string | null;
  onCreated?: () => void;
}

const fmt = (n: number | null | undefined) =>
  n == null ? "-" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("it-IT") : "-");

export function AppendiceDialog({ open, onOpenChange, titoloId, numeroTitolo, onCreated }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [numeroAppendice, setNumeroAppendice] = useState("");
  const [dataAppendice, setDataAppendice] = useState(new Date().toISOString().slice(0, 10));
  const [dataEffetto, setDataEffetto] = useState("");
  const [oggetto, setOggetto] = useState("");
  const [tipo, setTipo] = useState("modifica");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  // Campi regolazione
  const [quietanzaId, setQuietanzaId] = useState<string>("");
  const [premioNetto, setPremioNetto] = useState<string>("");
  const [tasse, setTasse] = useState<string>("");
  const [premioLordo, setPremioLordo] = useState<string>("");
  const [provvigioni, setProvvigioni] = useState<string>("");
  const [percProvv, setPercProvv] = useState<string>("");

  // Calcola prossimo numero appendice
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

  // Info titolo + numero_titolo per catena
  const { data: titoloInfo } = useQuery({
    queryKey: ["titolo-scadenza", titoloId],
    enabled: !!titoloId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("data_scadenza, numero_titolo, premio_netto, provvigioni_firma")
        .eq("id", titoloId!)
        .maybeSingle();
      if (!data) return null;
      const perc =
        data.premio_netto && Number(data.premio_netto) !== 0 && data.provvigioni_firma != null
          ? +((Number(data.provvigioni_firma) / Number(data.premio_netto)) * 100).toFixed(4)
          : null;
      return { ...data, percentuale_provvigione: perc };
    },
  });

  // Catena quietanze della polizza (solo quelle "regolabili")
  const STATI_VALIDI = ["attivo", "incassato", "sospeso"];
  const { data: catena } = useQuery({
    queryKey: ["catena-quietanze", titoloInfo?.numero_titolo],
    enabled: !!titoloInfo?.numero_titolo && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, riga, garanzia_da, garanzia_a, data_scadenza, premio_lordo, premio_netto, tasse, sostituisce_polizza, is_regolazione, stato, numero_titolo")
        .eq("numero_titolo", titoloInfo!.numero_titolo!)
        .order("garanzia_da", { ascending: false });
      return (data || []).filter(
        (t: any) => !t.is_regolazione && STATI_VALIDI.includes((t.stato || "").toLowerCase())
      );
    },
  });

  const quietanzaOptions: SearchableSelectOption[] = useMemo(() => {
    const list = catena || [];
    // Già ordinati DESC dalla query: la più recente è in cima
    return list.map((t: any, i: number) => {
      const stato = (t.stato || "").toLowerCase();
      const statoBadge = stato ? ` · ${stato}` : "";
      const label = `Rata ${list.length - i} · ${fmtDate(t.garanzia_da)} → ${fmtDate(t.garanzia_a)} · ${fmt(t.premio_lordo)}${statoBadge}`;
      const searchText = [
        t.riga,
        fmtDate(t.garanzia_da),
        fmtDate(t.garanzia_a),
        stato,
        t.premio_lordo != null ? String(t.premio_lordo) : "",
      ].filter(Boolean).join(" ");
      return { value: t.id as string, label, searchText };
    });
  }, [catena]);

  // Chiave bozza per autosave (per titolo)
  const draftKey = titoloId ? `appendice-draft:${titoloId}` : null;
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (!open) { setDraftRestored(false); return; }
    const max = (existing || []).reduce((acc, a: any) => Math.max(acc, parseInt(a.numero_appendice) || 0), 0);
    setNumeroAppendice(String(max + 1));

    // Tentativo di ripristino bozza
    let restored = false;
    if (draftKey) {
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const d = JSON.parse(raw);
          setDataAppendice(d.dataAppendice ?? "");
          setDataEffetto(d.dataEffetto ?? "");
          setOggetto(d.oggetto ?? "");
          setTipo(d.tipo ?? "modifica");
          setNote(d.note ?? "");
          setQuietanzaId(d.quietanzaId ?? "");
          setPremioNetto(d.premioNetto ?? "");
          setTasse(d.tasse ?? "");
          setPremioLordo(d.premioLordo ?? "");
          setProvvigioni(d.provvigioni ?? "");
          setPercProvv(d.percProvv ?? "");
          restored = true;
        }
      } catch { /* ignore */ }
    }
    setDraftRestored(restored);

    if (!restored) {
      setDataAppendice((titoloInfo as any)?.data_scadenza || new Date().toISOString().slice(0, 10));
      setDataEffetto("");
      setOggetto("");
      setTipo("modifica");
      setNote("");
      setQuietanzaId("");
      setPremioNetto("");
      setTasse("");
      setPremioLordo("");
      setProvvigioni("");
      setPercProvv(((titoloInfo as any)?.percentuale_provvigione ?? "")?.toString() || "");
    }
    setFile(null);
    setFiles([]);
  }, [open, existing, titoloInfo, draftKey]);

  // Quando cambio quietanza: prefill periodo + RESET importi sui valori della rata scelta
  useEffect(() => {
    if (!quietanzaId || !catena) return;
    const q: any = catena.find((t: any) => t.id === quietanzaId);
    if (!q) return;
    setDataEffetto(q.garanzia_da || "");
    setDataAppendice(q.garanzia_a || "");
    const n = q.premio_netto != null ? Number(q.premio_netto).toFixed(2) : "";
    const tx = q.tasse != null ? Number(q.tasse).toFixed(2) : "";
    const l = q.premio_lordo != null ? Number(q.premio_lordo).toFixed(2) : "";
    setPremioNetto(n);
    setTasse(tx);
    setPremioLordo(l);
    // provvigioni verranno ricalcolate dall'effect netto×%
  }, [quietanzaId, catena]);

  // Auto-calcolo provvigioni quando cambia netto o %
  useEffect(() => {
    const n = parseFloat(premioNetto.replace(",", "."));
    const p = parseFloat(percProvv.replace(",", "."));
    if (!isNaN(n) && !isNaN(p)) {
      setProvvigioni(((n * p) / 100).toFixed(2));
    }
  }, [premioNetto, percProvv]);

  // Auto-calcolo lordo se non editato manualmente (semplice: netto+tasse)
  useEffect(() => {
    const n = parseFloat(premioNetto.replace(",", "."));
    const t = parseFloat(tasse.replace(",", "."));
    if (!isNaN(n) && !isNaN(t)) {
      setPremioLordo((n + t).toFixed(2));
    }
  }, [premioNetto, tasse]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!titoloId) throw new Error("Titolo non specificato");
      if (!numeroAppendice.trim()) throw new Error("Numero appendice obbligatorio");

      const isReg = tipo === "regolazione";
      if (isReg) {
        if (!quietanzaId) throw new Error("Seleziona la quietanza di riferimento");
        const n = parseFloat(premioNetto.replace(",", "."));
        const tt = parseFloat(tasse.replace(",", ".") || "0");
        const l = parseFloat(premioLordo.replace(",", ".") || "0");
        const p = parseFloat(provvigioni.replace(",", ".") || "0");
        if (isNaN(n)) throw new Error("Inserisci il premio netto");
        if (tt < 0) throw new Error("Le tasse non possono essere negative");
        if (l + 0.01 < n) throw new Error("Il premio lordo non può essere inferiore al netto");
        if (p < 0) throw new Error("Le provvigioni non possono essere negative");
        if (dataEffetto && dataAppendice && dataEffetto > dataAppendice) {
          throw new Error("La data effetto non può essere successiva alla data scadenza");
        }
      }

      let filePath: string | null = null;
      let nomeFile: string | null = null;
      const allegati: Array<{ path: string; nome: string; size: number; type: string }> = [];

      // Multi-file solo per regolazione; per altri tipi si usa il singolo `file`
      const toUpload: File[] = isReg ? files : (file ? [file] : []);
      for (let i = 0; i < toUpload.length; i++) {
        const f = toUpload[i];
        const path = `appendici/${titoloId}/${Date.now()}_${i}_${f.name}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, f);
        if (upErr) throw upErr;
        allegati.push({ path, nome: f.name, size: f.size, type: f.type });
        if (i === 0) { filePath = path; nomeFile = f.name; }
      }

      const payload: any = {
        titolo_id: titoloId,
        numero_appendice: numeroAppendice.trim(),
        data_appendice: dataAppendice || null,
        data_effetto: dataEffetto || null,
        oggetto: oggetto.trim() || null,
        tipo,
        file_path: filePath,
        nome_file: nomeFile,
        allegati,
        note: note.trim() || null,
        created_by: user?.id || null,
      };

      if (isReg) {
        payload.quietanza_id = quietanzaId;
        payload.premio_netto = parseFloat(premioNetto.replace(",", ".")) || 0;
        payload.tasse = parseFloat(tasse.replace(",", ".")) || 0;
        payload.premio_lordo = parseFloat(premioLordo.replace(",", ".")) || 0;
        payload.provvigioni = parseFloat(provvigioni.replace(",", ".")) || 0;
        payload.percentuale_provvigione = parseFloat(percProvv.replace(",", ".")) || null;
      }

      const { data, error } = await supabase
        .from("appendici_polizza")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      let titoloRgId: string | null = null;
      if (isReg) {
        const { data: rgId, error: rpcErr } = await supabase.rpc("crea_titolo_da_regolazione", {
          p_appendice_id: data.id,
        });
        if (rpcErr) throw rpcErr;
        titoloRgId = rgId as unknown as string;
      }

      await logAttivita({
        azione: isReg ? "regolazione_creata" : "appendice_creata",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: {
          numero_appendice: numeroAppendice.trim(),
          tipo,
          oggetto: oggetto.trim() || null,
          quietanza_id: isReg ? quietanzaId : undefined,
          titolo_regolazione_id: titoloRgId,
        },
      });

      return { ...data, titoloRgId };
    },
    onSuccess: (res: any) => {
      const isReg = tipo === "regolazione";
      if (isReg) {
        toast.success("Regolazione creata", {
          description: "Titolo RG generato. Ora è in Carico e pronto per la messa a cassa.",
          action: res.titoloRgId
            ? { label: "Apri", onClick: () => navigate(`/titoli/${res.titoloRgId}`) }
            : undefined,
        });
      } else {
        toast.success(`Appendice n° ${numeroAppendice} creata`);
      }
      if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* ignore */ } }
      qc.invalidateQueries({ queryKey: ["appendici-polizza", titoloId] });
      qc.invalidateQueries({ queryKey: ["appendici-count", titoloId] });
      qc.invalidateQueries({ queryKey: ["gestione-polizze"] });
      qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
      onCreated?.();
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Errore nel salvataggio"),
  });

  const isReg = tipo === "regolazione";

  // Validazione inline (regolazione)
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!isReg) return e;
    if (!quietanzaId) e.quietanzaId = "Seleziona la quietanza di riferimento";
    const n = parseFloat(premioNetto.replace(",", "."));
    const tt = parseFloat((tasse || "0").replace(",", "."));
    const l = parseFloat((premioLordo || "0").replace(",", "."));
    const p = parseFloat((provvigioni || "0").replace(",", "."));
    if (premioNetto === "" || isNaN(n)) e.premioNetto = "Inserisci un valore numerico";
    if (!isNaN(tt) && tt < 0) e.tasse = "Le tasse non possono essere negative";
    if (!isNaN(n) && !isNaN(l) && l + 0.01 < n) e.premioLordo = "Il lordo non può essere inferiore al netto";
    if (!isNaN(p) && p < 0) e.provvigioni = "Le provvigioni non possono essere negative";
    if (dataEffetto && dataAppendice && dataEffetto > dataAppendice) {
      e.dataEffetto = "La data effetto deve precedere la scadenza";
    }
    return e;
  }, [isReg, quietanzaId, premioNetto, tasse, premioLordo, provvigioni, dataEffetto, dataAppendice]);

  const hasErrors = Object.keys(errors).length > 0;

  // Preview locale del file selezionato (immagine o PDF)
  const filePreviewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);
  useEffect(() => {
    return () => { if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl); };
  }, [filePreviewUrl]);
  const fileKind: "image" | "pdf" | "other" = useMemo(() => {
    if (!file) return "other";
    if (file.type.startsWith("image/")) return "image";
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
    return "other";
  }, [file]);

  const errClass = "border-destructive focus-visible:ring-destructive";
  const ErrMsg = ({ id }: { id: string }) =>
    errors[id] ? (
      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
        <AlertCircle className="h-3 w-3" /> {errors[id]}
      </p>
    ) : null;



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuova appendice — Polizza {numeroTitolo || ""}</DialogTitle>
          <DialogDescription>
            {isReg
              ? "Regolazione premio: collegata a una quietanza e cassabile come una rata."
              : "L'appendice viene salvata nel database e collegata alla polizza."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Numero *</Label>
            <Input value={numeroAppendice} readOnly disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground mt-1">Progressivo automatico</p>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPI_APPENDICE.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isReg ? (
            <>
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
                <p className="text-xs text-muted-foreground mt-1">
                  Cambiando quietanza i campi importi e date si reimpostano sui valori della rata scelta.
                </p>
              </div>

              <div>
                <Label>Data effetto</Label>
                <Input type="date" value={dataEffetto} onChange={(e) => setDataEffetto(e.target.value)}
                  className={cn(errors.dataEffetto && errClass)} />
                <ErrMsg id="dataEffetto" />
              </div>
              <div>
                <Label>Data scadenza</Label>
                <Input type="date" value={dataAppendice} onChange={(e) => setDataAppendice(e.target.value)} />
              </div>

              <div>
                <Label>Premio netto *</Label>
                <Input inputMode="decimal" value={premioNetto}
                  onChange={(e) => setPremioNetto(e.target.value)}
                  placeholder="0,00"
                  className={cn(errors.premioNetto && errClass)} />
                <ErrMsg id="premioNetto" />
              </div>
              <div>
                <Label>Tasse</Label>
                <Input inputMode="decimal" value={tasse}
                  onChange={(e) => setTasse(e.target.value)} placeholder="0,00"
                  className={cn(errors.tasse && errClass)} />
                <ErrMsg id="tasse" />
              </div>
              <div>
                <Label>Premio lordo</Label>
                <Input inputMode="decimal" value={premioLordo}
                  onChange={(e) => setPremioLordo(e.target.value)} placeholder="0,00"
                  className={cn(errors.premioLordo && errClass)} />
                <ErrMsg id="premioLordo" />
              </div>
              <div>
                <Label>Provvigioni</Label>
                <div className="flex gap-2">
                  <Input inputMode="decimal" value={provvigioni}
                    onChange={(e) => setProvvigioni(e.target.value)} placeholder="0,00"
                    className={cn("flex-1", errors.provvigioni && errClass)} />
                  <Input inputMode="decimal" value={percProvv}
                    onChange={(e) => setPercProvv(e.target.value)} placeholder="%"
                    className="w-20" title="% provvigione (sul netto)" />
                </div>
                <ErrMsg id="provvigioni" />
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-calcolata: netto × % polizza originale. Modificabile.
                </p>
              </div>

              <div className="md:col-span-2">
                <Label>Oggetto</Label>
                <Input value={oggetto} onChange={(e) => setOggetto(e.target.value)}
                  placeholder="Es. Conguaglio premio 2026" />
              </div>
              <div className="md:col-span-2">
                <Label>Note interne</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Allegati (opzionali)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={(e) => {
                      const picked = Array.from(e.target.files || []);
                      if (picked.length) {
                        setFiles((prev) => {
                          const seen = new Set(prev.map((f) => `${f.name}_${f.size}`));
                          const merged = [...prev];
                          for (const f of picked) {
                            const k = `${f.name}_${f.size}`;
                            if (!seen.has(k)) { merged.push(f); seen.add(k); }
                          }
                          return merged;
                        });
                      }
                      e.currentTarget.value = "";
                    }}
                  />
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Puoi selezionare più file (immagini o PDF). Verranno caricati alla creazione dell'appendice.
                </p>

                {files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {files.map((f, idx) => (
                      <AllegatoPreview
                        key={`${f.name}_${f.size}_${idx}`}
                        file={f}
                        onRemove={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>Data scadenza</Label>
                <Input type="date" value={dataAppendice} onChange={(e) => setDataAppendice(e.target.value)} />
              </div>
              <div>
                <Label>Data effetto</Label>
                <Input type="date" value={dataEffetto} onChange={(e) => setDataEffetto(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Oggetto</Label>
                <Input value={oggetto} onChange={(e) => setOggetto(e.target.value)} placeholder="Breve descrizione dell'oggetto dell'appendice" />
              </div>
              <div className="md:col-span-2">
                <Label>Note interne</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Allegato (opzionale)</Label>
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>Annulla</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !titoloId || (isReg && hasErrors)}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isReg ? "Crea regolazione" : "Crea appendice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AllegatoPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const kind: "image" | "pdf" | "other" =
    file.type.startsWith("image/") ? "image"
      : file.type === "application/pdf" || /\.pdf$/i.test(file.name) ? "pdf"
      : "other";
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <FileIcon className="h-3.5 w-3.5" />
        <span className="truncate flex-1">{file.name}</span>
        <span>{(file.size / 1024).toFixed(0)} KB</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onRemove}
          title="Rimuovi allegato"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {kind === "image" && (
        <img src={url} alt={file.name} className="max-h-40 w-auto mx-auto rounded" />
      )}
      {kind === "pdf" && (
        <iframe src={url} title={file.name} className="w-full h-48 rounded border-0" />
      )}
      {kind === "other" && (
        <p className="text-xs text-muted-foreground">Anteprima non disponibile.</p>
      )}
    </div>
  );
}
