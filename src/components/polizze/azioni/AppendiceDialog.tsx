import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";
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

export function AppendiceDialog({ open, onOpenChange, titoloId, numeroTitolo, onCreated }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [numeroAppendice, setNumeroAppendice] = useState("");
  const [dataAppendice, setDataAppendice] = useState(new Date().toISOString().slice(0, 10));
  const [dataEffetto, setDataEffetto] = useState("");
  const [oggetto, setOggetto] = useState("");
  const [tipo, setTipo] = useState("modifica");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

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

  // Recupera scadenza polizza per default
  const { data: titoloInfo } = useQuery({
    queryKey: ["titolo-scadenza", titoloId],
    enabled: !!titoloId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("data_scadenza")
        .eq("id", titoloId!)
        .maybeSingle();
      return data;
    },
  });

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
  }, [open, existing, titoloInfo]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!titoloId) throw new Error("Titolo non specificato");
      if (!numeroAppendice.trim()) throw new Error("Numero appendice obbligatorio");

      let filePath: string | null = null;
      let nomeFile: string | null = null;
      if (file) {
        const path = `appendici/${titoloId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, file);
        if (upErr) throw upErr;
        filePath = path;
        nomeFile = file.name;
      }

      const { data, error } = await supabase.from("appendici_polizza").insert({
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
      }).select().single();
      if (error) throw error;

      await logAttivita({
        azione: "appendice_creata",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: { numero_appendice: numeroAppendice.trim(), tipo, oggetto: oggetto.trim() || null },
      });

      return data;
    },
    onSuccess: () => {
      toast.success(`Appendice n° ${numeroAppendice} creata`);
      qc.invalidateQueries({ queryKey: ["appendici-polizza", titoloId] });
      qc.invalidateQueries({ queryKey: ["appendici-count", titoloId] });
      qc.invalidateQueries({ queryKey: ["gestione-polizze"] });
      onCreated?.();
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Errore nel salvataggio"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuova appendice — Polizza {numeroTitolo || ""}</DialogTitle>
          <DialogDescription>L'appendice viene salvata nel database e collegata alla polizza.</DialogDescription>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>Annulla</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !titoloId}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crea appendice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
