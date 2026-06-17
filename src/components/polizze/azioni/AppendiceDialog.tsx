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
import { Loader2 } from "lucide-react";
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
        .select("data_scadenza, numero_titolo, percentuale_provvigione")
        .eq("id", titoloId!)
        .maybeSingle();
      return data;
    },
  });

  // Catena quietanze della polizza
  const { data: catena } = useQuery({
    queryKey: ["catena-quietanze", titoloInfo?.numero_titolo],
    enabled: !!titoloInfo?.numero_titolo && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, riga, garanzia_da, garanzia_a, data_scadenza, premio_lordo, sostituisce_polizza, is_regolazione")
        .eq("numero_titolo", titoloInfo!.numero_titolo!)
        .order("garanzia_da", { ascending: true });
      return (data || []).filter((t: any) => !t.is_regolazione);
    },
  });

  const quietanzaOptions: SearchableSelectOption[] = useMemo(() => {
    const list = catena || [];
    return list.map((t: any, i: number) => {
      const label = `Rata ${i + 1} · ${fmtDate(t.garanzia_da)} → ${fmtDate(t.garanzia_a)} · ${fmt(t.premio_lordo)}`;
      return { value: t.id as string, label, searchText: `${t.riga}` };
    });
  }, [catena]);

  useEffect(() => {
    if (!open) return;
    const max = (existing || []).reduce((acc, a: any) => Math.max(acc, parseInt(a.numero_appendice) || 0), 0);
    setNumeroAppendice(String(max + 1));
    setDataAppendice((titoloInfo as any)?.data_scadenza || new Date().toISOString().slice(0, 10));
    setDataEffetto("");
    setOggetto("");
    setTipo("modifica");
    setNote("");
    setFile(null);
    setQuietanzaId("");
    setPremioNetto("");
    setTasse("");
    setPremioLordo("");
    setProvvigioni("");
    setPercProvv(((titoloInfo as any)?.percentuale_provvigione ?? "")?.toString() || "");
  }, [open, existing, titoloInfo]);

  // Pre-fill periodo dalla quietanza scelta
  useEffect(() => {
    if (!quietanzaId || !catena) return;
    const q = catena.find((t: any) => t.id === quietanzaId);
    if (!q) return;
    if (!dataEffetto) setDataEffetto((q as any).garanzia_da || "");
    if (!dataAppendice) setDataAppendice((q as any).garanzia_a || "");
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
      if (isReg && !quietanzaId) throw new Error("Seleziona la quietanza di riferimento");
      if (isReg && !premioNetto) throw new Error("Inserisci il premio netto");

      let filePath: string | null = null;
      let nomeFile: string | null = null;
      if (file) {
        const path = `appendici/${titoloId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, file);
        if (upErr) throw upErr;
        filePath = path;
        nomeFile = file.name;
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
                />
              </div>

              <div>
                <Label>Data effetto</Label>
                <Input type="date" value={dataEffetto} onChange={(e) => setDataEffetto(e.target.value)} />
              </div>
              <div>
                <Label>Data scadenza</Label>
                <Input type="date" value={dataAppendice} onChange={(e) => setDataAppendice(e.target.value)} />
              </div>

              <div>
                <Label>Premio netto *</Label>
                <Input
                  inputMode="decimal"
                  value={premioNetto}
                  onChange={(e) => setPremioNetto(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Tasse</Label>
                <Input
                  inputMode="decimal"
                  value={tasse}
                  onChange={(e) => setTasse(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Premio lordo</Label>
                <Input
                  inputMode="decimal"
                  value={premioLordo}
                  onChange={(e) => setPremioLordo(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Provvigioni</Label>
                <div className="flex gap-2">
                  <Input
                    inputMode="decimal"
                    value={provvigioni}
                    onChange={(e) => setProvvigioni(e.target.value)}
                    placeholder="0,00"
                    className="flex-1"
                  />
                  <Input
                    inputMode="decimal"
                    value={percProvv}
                    onChange={(e) => setPercProvv(e.target.value)}
                    placeholder="%"
                    className="w-20"
                    title="% provvigione (sul netto)"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-calcolata: netto × % polizza originale. Modificabile.
                </p>
              </div>

              <div className="md:col-span-2">
                <Label>Oggetto</Label>
                <Input
                  value={oggetto}
                  onChange={(e) => setOggetto(e.target.value)}
                  placeholder="Es. Conguaglio premio 2026"
                />
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
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !titoloId}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isReg ? "Crea regolazione" : "Crea appendice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
