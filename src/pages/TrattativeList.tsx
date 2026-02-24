import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { FileText, Search } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const STATI_TRATTATIVA = [
  { value: "aperta", label: "Aperta", color: "bg-kpi-blue-bg text-kpi-blue-text border-kpi-blue-border" },
  { value: "in_negoziazione", label: "In Negoziazione", color: "bg-kpi-yellow-bg text-kpi-yellow-text border-kpi-yellow-border" },
  { value: "chiusa_vinta", label: "Chiusa Vinta", color: "bg-kpi-green-bg text-kpi-green-text border-kpi-green-border" },
  { value: "chiusa_persa", label: "Chiusa Persa", color: "bg-destructive/10 text-destructive border-destructive/30" },
];

const TrattativeList = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [filtroSearch, setFiltroSearch] = useState("");

  const { data: trattative, isLoading } = useQuery({
    queryKey: ["trattative_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trattative")
        .select("*, prospect:prospect_id(nome, cognome, ufficio_id), profiles:created_by(nome, cognome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStato = useMutation({
    mutationFn: async ({ id, newStato, oldStato }: { id: string; newStato: string; oldStato: string }) => {
      const update: Record<string, unknown> = { stato: newStato, updated_at: new Date().toISOString() };
      if (newStato === "chiusa_vinta" || newStato === "chiusa_persa") {
        update.data_chiusura = new Date().toISOString();
      }
      const { error } = await supabase.from("trattative").update(update).eq("id", id);
      if (error) throw error;

      const azione = (newStato === "chiusa_vinta" || newStato === "chiusa_persa") ? "chiusura_trattativa" : "modifica_stato_trattativa";
      await logAttivita({ azione, entita_tipo: "trattativa", entita_id: id, dettagli_json: { stato_precedente: oldStato, nuovo_stato: newStato } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative_all"] });
      toast({ title: "Trattativa aggiornata" });
    },
  });

  const filtered = trattative?.filter((t) => {
    if (filtroStato !== "tutti" && t.stato !== filtroStato) return false;
    if (filtroSearch) {
      const search = filtroSearch.toLowerCase();
      const prodotto = (t.prodotto || "").toLowerCase();
      const compagnia = (t.compagnia || "").toLowerCase();
      const prospectName = `${(t as any).prospect?.nome || ""} ${(t as any).prospect?.cognome || ""}`.toLowerCase();
      if (!prodotto.includes(search) && !compagnia.includes(search) && !prospectName.includes(search)) return false;
    }
    return true;
  });

  const getStatoBadge = (stato: string) => {
    const s = STATI_TRATTATIVA.find((x) => x.value === stato);
    return s ? (
      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
    ) : <Badge variant="secondary">{stato}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Dashboard</span><span>›</span><span>Trattative</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trattative</h1>
          <p className="text-sm text-muted-foreground">Tutte le trattative commerciali</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 w-64" placeholder="Cerca prodotto, compagnia, prospect..." value={filtroSearch} onChange={(e) => setFiltroSearch(e.target.value)} />
        </div>
        <Select value={filtroStato} onValueChange={setFiltroStato}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {STATI_TRATTATIVA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Caricamento...</div>
      ) : !filtered?.length ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nessuna trattativa trovata</h3>
          <p className="text-sm text-muted-foreground">Le trattative verranno create dal dettaglio prospect.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospect</TableHead>
                <TableHead>Prodotto</TableHead>
                <TableHead>Compagnia</TableHead>
                <TableHead>Premio</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Azione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    {(t as any).prospect ? `${(t as any).prospect.nome || ""} ${(t as any).prospect.cognome || ""}`.trim() : "—"}
                  </TableCell>
                  <TableCell>{t.prodotto || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.compagnia || "—"}</TableCell>
                  <TableCell>{t.premio_previsto ? `€ ${Number(t.premio_previsto).toLocaleString("it-IT")}` : "—"}</TableCell>
                  <TableCell>{getStatoBadge(t.stato)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(t.created_at), "dd/MM/yyyy", { locale: it })}
                  </TableCell>
                  <TableCell>
                    <Select value={t.stato} onValueChange={(v) => updateStato.mutate({ id: t.id, newStato: v, oldStato: t.stato })}>
                      <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATI_TRATTATIVA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default TrattativeList;
