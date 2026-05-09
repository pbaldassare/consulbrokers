import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Undo2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
const statiRimessa = ["bozza", "pronta", "inviata", "errore"];

const RimessaList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtroStato, setFiltroStato] = useState("all");
  const { page, setPage, pageSize, range } = useServerPagination();

  const revertMutation = useMutation({
    mutationFn: async (rimessaId: string) => {
      const { error: dErr } = await supabase.from("rimessa_dettaglio").delete().eq("rimessa_id", rimessaId);
      if (dErr) throw dErr;
      const { error: rErr } = await supabase.from("rimessa_premi").delete().eq("id", rimessaId);
      if (rErr) throw rErr;
      await logAttivita({
        azione: "annullamento_rimessa",
        entita_tipo: "rimessa_premi",
        entita_id: rimessaId,
      });
    },
    onSuccess: () => {
      toast.success("Rimessa annullata — i titoli sono tornati nel riepilogo");
      queryClient.invalidateQueries({ queryKey: ["rimessa_premi"] });
      queryClient.invalidateQueries({ queryKey: ["titoli-cassa-mese"] });
      queryClient.invalidateQueries({ queryKey: ["rimessa-dettaglio-used"] });
    },
    onError: (e: any) => toast.error(e.message || "Errore nell'annullamento"),
  });

  const { data: rimesseResult, isLoading } = useQuery({
    queryKey: ["rimessa_premi", page, filtroStato],
    queryFn: async () => {
      let q = supabase
        .from("rimessa_premi")
        .select("*, agenzie(nome), uffici(nome_ufficio), profiles(nome, cognome)", { count: "exact" });

      if (filtroStato !== "all") q = q.eq("stato", filtroStato);

      const { data, error, count } = await q
        .order("data_creazione", { ascending: false })
        .range(range.from, range.to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const rimesse = rimesseResult?.data || [];
  const totalCount = rimesseResult?.count || 0;

  const statoBadge = (s: string) => {
    switch (s) {
      case "pronta": return "default";
      case "inviata": return "secondary";
      case "errore": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rimessa Premi</h1>
        <p className="text-muted-foreground">Storico rimesse alle agenzie</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Select value={filtroStato} onValueChange={(v) => { setFiltroStato(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {statiRimessa.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Send className="w-5 h-5" />Storico Rimesse ({totalCount})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Caricamento...</p> : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agenzia</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead className="text-right">Importo €</TableHead>
                    <TableHead>IBAN</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Creata da</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rimesse.map((r: any) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/rimessa-premi/${r.id}`)}>
                      <TableCell className="font-medium">{r.compagnie?.nome || "—"}</TableCell>
                      <TableCell>{r.uffici?.nome_ufficio || "—"}</TableCell>
                      <TableCell className="text-right font-mono">€ {(r.totale_importi ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.iban_utilizzato || "—"}</TableCell>
                      <TableCell>{r.data_pagamento_rimessa ? format(new Date(r.data_pagamento_rimessa), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell><Badge variant={statoBadge(r.stato)}>{r.stato}</Badge></TableCell>
                      <TableCell>{r.profiles ? `${r.profiles.nome} ${r.profiles.cognome}` : "—"}</TableCell>
                      <TableCell>{r.data_creazione ? format(new Date(r.data_creazione), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Annullare la rimessa per ${r.compagnie?.nome || "questa agenzia"}? I titoli torneranno nel riepilogo.`)) {
                              revertMutation.mutate(r.id);
                            }
                          }}
                          disabled={revertMutation.isPending}
                        >
                          <Undo2 className="w-3 h-3 mr-1" />Annulla
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rimesse.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nessuna rimessa archiviata</TableCell></TableRow>}
                </TableBody>
              </Table>
              <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RimessaList;
