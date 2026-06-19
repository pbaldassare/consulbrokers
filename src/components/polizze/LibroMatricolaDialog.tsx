import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Truck } from "lucide-react";

export type LibroMatricolaRiga = {
  id?: string;
  targa: string;
  data_inclusione: string; // YYYY-MM-DD
  data_esclusione: string;
  note: string;
};

export const emptyMatricolaRiga = (): LibroMatricolaRiga => ({
  targa: "",
  data_inclusione: "",
  data_esclusione: "",
  note: "",
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  righe: LibroMatricolaRiga[];
  onChange: (righe: LibroMatricolaRiga[]) => void;
  readOnly?: boolean;
}

export function LibroMatricolaDialog({ open, onOpenChange, righe, onChange, readOnly }: Props) {
  const updateRiga = (idx: number, patch: Partial<LibroMatricolaRiga>) => {
    onChange(righe.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRiga = () => onChange([...righe, emptyMatricolaRiga()]);
  const removeRiga = (idx: number) => onChange(righe.filter((_, i) => i !== idx));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Libro Matricola — Elenco mezzi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Tutti i campi sono opzionali. Le righe completamente vuote non verranno salvate.
          </div>

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[20%] text-xs">Targa</TableHead>
                  <TableHead className="w-[18%] text-xs">Data inclusione</TableHead>
                  <TableHead className="w-[18%] text-xs">Data esclusione</TableHead>
                  <TableHead className="text-xs">Note</TableHead>
                  <TableHead className="w-[44px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {righe.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                      Nessun mezzo. Clicca "Aggiungi mezzo" per iniziare.
                    </TableCell>
                  </TableRow>
                ) : (
                  righe.map((r, idx) => (
                    <TableRow key={r.id ?? idx}>
                      <TableCell>
                        <Input
                          value={r.targa}
                          onChange={(e) => updateRiga(idx, { targa: e.target.value.toUpperCase() })}
                          disabled={readOnly}
                          className="h-8 text-xs uppercase"
                          placeholder="ES. AB123CD"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={r.data_inclusione}
                          onChange={(e) => updateRiga(idx, { data_inclusione: e.target.value })}
                          disabled={readOnly}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={r.data_esclusione}
                          onChange={(e) => updateRiga(idx, { data_esclusione: e.target.value })}
                          disabled={readOnly}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.note}
                          onChange={(e) => updateRiga(idx, { note: e.target.value })}
                          disabled={readOnly}
                          className="h-8 text-xs"
                          placeholder="Note opzionali"
                        />
                      </TableCell>
                      <TableCell>
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeRiga(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={addRiga} className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi mezzo
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function filterRigheValide(righe: LibroMatricolaRiga[]): LibroMatricolaRiga[] {
  return righe.filter(
    (r) => !!(r.targa?.trim() || r.data_inclusione || r.data_esclusione || r.note?.trim())
  );
}
