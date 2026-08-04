import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, isValid, parseISO } from "date-fns";
import { StickyNote, Plus } from "lucide-react";

export type SinistroNotaInternaRow = {
  id: string;
  sinistro_id: string;
  testo: string;
  created_at: string;
  created_by: string | null;
  profiles?: { nome?: string | null; cognome?: string | null } | null;
};

interface Props {
  sinistroId: string;
  currentUserId?: string | null;
  disabled?: boolean;
}

const fmtDateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = parseISO(value);
  return isValid(d) ? format(d, "dd/MM/yyyy HH:mm") : "—";
};

const authorLabel = (row: SinistroNotaInternaRow) => {
  const nome = `${row.profiles?.nome || ""} ${row.profiles?.cognome || ""}`.trim();
  return nome || "Operatore";
};

export default function SinistroNoteInternePanel({ sinistroId, currentUserId, disabled }: Props) {
  const qc = useQueryClient();
  const [testo, setTesto] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: note = [], isLoading } = useQuery({
    queryKey: ["sinistro-note-interne", sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistro_note_interne" as any)
        .select("id, sinistro_id, testo, created_at, created_by, profiles:created_by(nome, cognome)")
        .eq("sinistro_id", sinistroId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as SinistroNotaInternaRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sinistro-note-interne", sinistroId] });
  };

  const handleAdd = async () => {
    const trimmed = testo.trim();
    if (!trimmed) {
      toast.error("Inserisci il testo della nota");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("sinistro_note_interne" as any).insert({
        sinistro_id: sinistroId,
        testo: trimmed,
        created_by: currentUserId || null,
      });
      if (error) throw error;
      toast.success("Nota aggiunta");
      setTesto("");
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-border/70 bg-background p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <StickyNote className="h-4 w-4" /> Note interne
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Diario operativo della pratica (visibile solo agli operatori).
          </p>
        </div>
      </div>

      {!disabled && (
        <div className="space-y-2 rounded-md border border-dashed border-border/80 p-3 bg-muted/10">
          <Label htmlFor="nuova-nota-interna">Nuova nota</Label>
          <Textarea
            id="nuova-nota-interna"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            rows={3}
            placeholder="Scrivi una nota operativa…"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAdd} disabled={saving || !testo.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Aggiungi nota
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Caricamento…</p>
      ) : note.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nessuna nota interna</p>
      ) : (
        <ul className="space-y-3">
          {[...note].reverse().map((n) => (
            <li key={n.id} className="rounded-md border border-border/60 bg-muted/15 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground mb-1.5">
                <span className="font-medium text-foreground">{authorLabel(n)}</span>
                <time dateTime={n.created_at}>{fmtDateTime(n.created_at)}</time>
              </div>
              <p className="text-sm whitespace-pre-wrap">{n.testo}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
