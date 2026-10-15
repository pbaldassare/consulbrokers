import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ControparteSinistroRow } from "@/components/sinistri/NuovaControparteSinistroDialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controparte: ControparteSinistroRow | null;
  loading?: boolean;
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

export function ControparteSinistroDetailDialog({ open, onOpenChange, controparte, loading }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dettaglio controparte</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Caricamento...</p>
        ) : !controparte ? (
          <p className="text-sm text-muted-foreground py-4">Controparte non trovata in anagrafica.</p>
        ) : (
          <div className="grid gap-4 text-sm">
            <Field label="Codice" value={String(controparte.codice)} />
            <Field label="Nome / Azienda" value={controparte.denominazione} />
            <Field label="Email" value={controparte.email} />
            <Field label="PEC" value={controparte.pec} />
            <Field label="Telefono" value={controparte.telefono} />
            <Field label="Cellulare" value={controparte.cellulare} />
            {controparte.note?.trim() ? (
              <div>
                <p className="text-xs text-muted-foreground">Note</p>
                <p className="mt-1 whitespace-pre-wrap rounded border bg-muted/30 p-2.5">{controparte.note}</p>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
