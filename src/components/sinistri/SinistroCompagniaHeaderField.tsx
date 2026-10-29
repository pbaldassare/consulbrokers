import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllCompagnie } from "@/lib/fetchAllCompagnie";
import { formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import {
  buildSinistroCompagniaHeaderOptions,
  COMPAGNIA_LIBERA_BADGE,
  payloadCompagniaCatalogo,
  payloadCompagniaLibera,
  resolveSceltaCompagniaHeader,
  selectedCompagniaHeaderValue,
  type CompagniaCatalogoOption,
} from "@/lib/sinistroCompagniaLibera";
import { toast } from "sonner";

type Props = {
  sinistroId: string;
  compagniaId?: string | null;
  compagniaNome?: string | null;
  compagniaLibera?: string | null;
  onSaved: () => void;
};

export default function SinistroCompagniaHeaderField({
  sinistroId,
  compagniaId,
  compagniaNome,
  compagniaLibera,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [liberaDraft, setLiberaDraft] = useState(compagniaLibera || "");
  const currentId = compagniaId || "";
  const currentIsLibera = Boolean((compagniaLibera || "").trim());

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie-attive-sinistro-header"],
    queryFn: async () => {
      return fetchAllCompagnie<CompagniaCatalogoOption>("id, nome, codice", { attiva: true });
    },
  });

  const options = useMemo(
    () =>
      buildSinistroCompagniaHeaderOptions({
        compagnie,
        currentId,
        compagniaNome,
        compagniaLibera,
      }),
    [compagnie, currentId, compagniaNome, compagniaLibera],
  );

  const persist = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("gestione-sinistri", { body });
      if (error || !data?.success) {
        throw new Error(formatEdgeFunctionError(error, data));
      }
      toast.success("Compagnia assicurativa aggiornata");
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore aggiornamento compagnia";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onValueChange = (nextId: string) => {
    const scelta = resolveSceltaCompagniaHeader(nextId, currentIsLibera);
    if (scelta === "dialog") {
      setLiberaDraft(compagniaLibera || "");
      setDialogOpen(true);
      return;
    }
    if (scelta === "noop" || nextId === currentId) return;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = payloadCompagniaCatalogo(sinistroId, nextId, user?.id);
      if (!payload) return;
      await persist(payload);
    })();
  };

  const confirmLibera = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = payloadCompagniaLibera(sinistroId, liberaDraft, user?.id);
    if (!payload) {
      toast.error("Inserisci il nome della compagnia");
      return;
    }
    await persist(payload);
    setDialogOpen(false);
  };

  return (
    <div className="inline-flex items-center gap-1.5 min-w-0">
      <SearchableSelect
        options={options}
        value={selectedCompagniaHeaderValue({ compagniaId, compagniaLibera })}
        onValueChange={onValueChange}
        placeholder="Seleziona compagnia…"
        searchPlaceholder="Cerca compagnia…"
        emptyText="Nessuna compagnia trovata."
        disabled={saving}
        className="h-7 min-w-[180px] w-[220px] max-w-[min(280px,50vw)] text-xs"
      />
      {currentIsLibera ? (
        <Badge variant="outline" className="shrink-0 text-[10px] font-normal italic px-1.5 py-0">
          {COMPAGNIA_LIBERA_BADGE}
        </Badge>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compagnia non in anagrafica</DialogTitle>
            <DialogDescription>
              Inserisci il nome della compagnia solo per questo sinistro. Non verrà aggiunta
              all&apos;anagrafica compagnie.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="compagnia-libera-nome">Nome compagnia</Label>
            <Input
              id="compagnia-libera-nome"
              value={liberaDraft}
              onChange={(e) => setLiberaDraft(e.target.value)}
              placeholder="Es. compagnia non censita"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void confirmLibera();
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annulla
            </Button>
            <Button
              type="button"
              onClick={() => void confirmLibera()}
              disabled={saving || !liberaDraft.trim()}
            >
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
