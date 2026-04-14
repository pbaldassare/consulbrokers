import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Send, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";

const PAGE_SIZE = 25;
const statiRimessa = ["bozza", "pronta", "inviata", "errore"];

const RimessaList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [compagniaId, setCompagniaId] = useState("");
  const [ufficioId, setUfficioId] = useState("");
  const [filtroStato, setFiltroStato] = useState("all");
  const [page, setPage] = useState(0);
  const [meseCorrente, setMeseCorrente] = useState(new Date());

  const meseDa = format(startOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseA = format(endOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseLabel = format(meseCorrente, "MMMM yyyy", { locale: it });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie_attive"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compagnie").select("*").eq("attiva", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uffici").select("*").eq("attivo", true).order("nome_ufficio");
      if (error) throw error;
      return data;
    },
  });

  const { data: rimesseResult, isLoading } = useQuery({
    queryKey: ["rimessa_premi", page, filtroStato, meseDa, meseA],
    queryFn: async () => {
      let q = supabase
        .from("rimessa_premi")
        .select("*, compagnie(nome), uffici(nome_ufficio), profiles(nome, cognome)", { count: "exact" })
        .gte("data_creazione", meseDa)
        .lte("data_creazione", meseA + "T23:59:59");

      if (filtroStato !== "all") q = q.eq("stato", filtroStato);

      const { data, error, count } = await q
        .order("data_creazione", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  // Titoli messi a cassa nel mese selezionato, raggruppati per compagnia
  const { data: titoliCassa = [] } = useQuery({
    queryKey: ["titoli-cassa-mese", meseDa, meseA],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("id, importo_incassato, compagnia_id, compagnie:compagnie!titoli_compagnia_id_fkey(nome)")
        .eq("stato", "incassato")
        .gte("data_messa_cassa", meseDa)
        .lte("data_messa_cassa", meseA);
      if (error) throw error;

      // Check which are already in a rimessa
      const { data: usati } = await supabase.from("rimessa_dettaglio").select("titolo_id");
      const usatiSet = new Set((usati || []).map((r: any) => r.titolo_id));

      // Group by compagnia
      const map: Record<string, { nome: string; count: number; totale: number; compagnia_id: string }> = {};
      for (const t of (data || []) as any[]) {
        if (usatiSet.has(t.id)) continue;
        const cId = t.compagnia_id || "sconosciuta";
        const cNome = t.compagnie?.nome || "Senza compagnia";
        if (!map[cId]) map[cId] = { nome: cNome, count: 0, totale: 0, compagnia_id: cId };
        map[cId].count++;
        map[cId].totale += t.importo_incassato || 0;
      }
      return Object.values(map).sort((a, b) => b.totale - a.totale);
    },
  });

  const rimesse = rimesseResult?.data || [];
  const totalCount = rimesseResult?.count || 0;

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gestione-rimessa", {
        body: { action: "crea", compagnia_id: compagniaId, ufficio_id: ufficioId || null, created_by: user?.id, data_da: meseDa, data_a: meseA },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rimessa_premi"] });
      queryClient.invalidateQueries({ queryKey: ["titoli-cassa-mese"] });
      setOpen(false); setCompagniaId(""); setUfficioId("");
      toast.success(`Rimessa creata con ${data.titoli_count} titoli`);
    },
    onError: (err: any) => toast.error(err.message || "Errore"),
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rimessa Premi</h1>
          <p className="text-muted-foreground">Aggregazione titoli incassati per invio alle compagnie</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuova Rimessa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuova Rimessa Premi — {meseLabel}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Verranno inclusi i titoli messi a cassa dal {format(startOfMonth(meseCorrente), "dd/MM/yyyy")} al {format(endOfMonth(meseCorrente), "dd/MM/yyyy")}.</p>
              <div>
                <Label>Compagnia *</Label>
                <Select value={compagniaId} onValueChange={setCompagniaId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona compagnia" /></SelectTrigger>
                  <SelectContent>{compagnie.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sede</Label>
                <Select value={ufficioId} onValueChange={setUfficioId}>
                  <SelectTrigger><SelectValue placeholder="Opzionale" /></SelectTrigger>
                  <SelectContent>{uffici.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!compagniaId || createMutation.isPending} className="w-full">Crea Rimessa</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Selettore mese + filtro stato */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMeseCorrente(prev => subMonths(prev, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold capitalize min-w-[140px] text-center">{meseLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMeseCorrente(prev => addMonths(prev, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Select value={filtroStato} onValueChange={(v) => { setFiltroStato(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {statiRimessa.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Riepilogo titoli messi a cassa nel mese */}
      {titoliCassa.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Package className="w-5 h-5" />Titoli messi a cassa — disponibili per rimessa</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compagnia</TableHead>
                  <TableHead className="text-right">Titoli</TableHead>
                  <TableHead className="text-right">Totale €</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {titoliCassa.map((g) => (
                  <TableRow key={g.compagnia_id}>
                    <TableCell className="font-medium">{g.nome}</TableCell>
                    <TableCell className="text-right">{g.count}</TableCell>
                    <TableCell className="text-right font-mono">€ {g.totale.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Lista rimesse */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Send className="w-5 h-5" />Rimesse ({totalCount})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Caricamento...</p> : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compagnia</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Totale €</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Creata da</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rimesse.map((r: any) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/rimessa-premi/${r.id}`)}>
                      <TableCell className="font-medium">{r.compagnie?.nome || "—"}</TableCell>
                      <TableCell>{r.uffici?.nome_ufficio || "—"}</TableCell>
                      <TableCell className="font-mono">€ {r.totale_importi?.toFixed(2) ?? "0.00"}</TableCell>
                      <TableCell><Badge variant={statoBadge(r.stato)}>{r.stato}</Badge></TableCell>
                      <TableCell>{r.profiles ? `${r.profiles.nome} ${r.profiles.cognome}` : "—"}</TableCell>
                      <TableCell>{r.data_creazione ? format(new Date(r.data_creazione), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {rimesse.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nessuna rimessa nel mese selezionato</TableCell></TableRow>}
                </TableBody>
              </Table>
              <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RimessaList;
