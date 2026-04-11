import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { StatoPipeline, getStatoLabel } from "./StatoPipeline";
import { TrattativaDettagliTab } from "./TrattativaDettagliTab";
import { TrattativaTimelineTab } from "./TrattativaTimelineTab";
import { TrattativaDocumentiTab } from "./TrattativaDocumentiTab";
import { TrattativaScadenzeTab } from "./TrattativaScadenzeTab";
import { ClipboardList, History, FileText, CalendarDays } from "lucide-react";

interface Props {
  trattativa: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TrattativaDetailDialog = ({ trattativa, open, onOpenChange }: Props) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const getSoggettoName = () => {
    if (trattativa.cliente) {
      return trattativa.cliente.tipo_cliente === "privato"
        ? `${trattativa.cliente.cognome || ""} ${trattativa.cliente.nome || ""}`.trim()
        : trattativa.cliente.ragione_sociale || "—";
    }
    if (trattativa.prospect) {
      return `${trattativa.prospect.nome || ""} ${trattativa.prospect.cognome || ""}`.trim();
    }
    return "—";
  };

  const logEvento = async (tipo: string, descrizione: string, dettagli?: any) => {
    await supabase.from("trattativa_eventi").insert({
      trattativa_id: trattativa.id,
      tipo_evento: tipo,
      descrizione,
      dettagli_json: dettagli || null,
      created_by: profile?.id,
    });
    queryClient.invalidateQueries({ queryKey: ["trattativa_eventi", trattativa.id] });
  };

  const cambiaStato = useMutation({
    mutationFn: async (nuovoStato: string) => {
      const oldStato = trattativa.stato;
      if (nuovoStato === oldStato) return;

      const update: Record<string, unknown> = { stato: nuovoStato, updated_at: new Date().toISOString() };
      if (nuovoStato === "chiusa_vinta" || nuovoStato === "chiusa_persa") {
        update.data_chiusura = new Date().toISOString();
      }

      const { error } = await supabase.from("trattative").update(update).eq("id", trattativa.id);
      if (error) throw error;

      await logEvento("cambio_stato", `Stato cambiato da "${getStatoLabel(oldStato)}" a "${getStatoLabel(nuovoStato)}"`, {
        stato_precedente: oldStato,
        nuovo_stato: nuovoStato,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative_all"] });
      toast.success("Stato aggiornato");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["trattative_all"] });
  };

  if (!trattativa) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <DialogTitle className="text-lg">
                {getSoggettoName()}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {trattativa.cliente_id ? "Cliente" : "Prospect"} •{" "}
                {trattativa.ramo?.descrizione || trattativa.prodotto || "—"} •{" "}
                {trattativa.compagnia_rel?.nome || trattativa.compagnia || "—"}
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {trattativa.priorita === "urgente" ? "🔴" : trattativa.priorita === "alta" ? "🟠" : trattativa.priorita === "media" ? "🟡" : "🟢"}
              {" "}{trattativa.priorita || "media"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="py-3">
          <StatoPipeline
            statoCorrente={trattativa.stato}
            onCambiaStato={(s) => cambiaStato.mutate(s)}
          />
        </div>

        <Tabs defaultValue="dettagli" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="dettagli" className="gap-1.5"><ClipboardList className="w-3.5 h-3.5" />Dettagli</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5"><History className="w-3.5 h-3.5" />Timeline</TabsTrigger>
            <TabsTrigger value="documenti" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Documenti</TabsTrigger>
            <TabsTrigger value="scadenze" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Scadenze</TabsTrigger>
          </TabsList>

          <TabsContent value="dettagli">
            <TrattativaDettagliTab trattativa={trattativa} onSaved={refreshAll} onEvento={logEvento} />
          </TabsContent>
          <TabsContent value="timeline">
            <TrattativaTimelineTab trattativaId={trattativa.id} />
          </TabsContent>
          <TabsContent value="documenti">
            <TrattativaDocumentiTab trattativaId={trattativa.id} onEvento={logEvento} />
          </TabsContent>
          <TabsContent value="scadenze">
            <TrattativaScadenzeTab trattativaId={trattativa.id} onEvento={logEvento} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
