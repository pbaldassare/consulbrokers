import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";

const PAGE_SIZE = 25;
const statiRimessa = ["bozza", "pronta", "inviata", "errore"];

const RimessaList = () => {
  const navigate = useNavigate();
  const [filtroStato, setFiltroStato] = useState("all");
  const [page, setPage] = useState(0);
  const [meseCorrente, setMeseCorrente] = useState(new Date());

  const meseDa = format(startOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseA = format(endOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseLabel = format(meseCorrente, "MMMM yyyy", { locale: it });

  // Titoli messi a cassa nel mese, con dati per calcolo rimessa
  const { data: titoliCassa = [] } = useQuery({
    queryKey: ["titoli-cassa-mese", meseDa, meseA],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("id, premio_lordo, provvigioni_firma, provvigioni_quietanza, compagnia_id, compagnie:compagnie!titoli_compagnia_id_fkey(nome)")
        .eq("stato", "incassato")
        .gte("data_messa_cassa", meseDa)
        .lte("data_messa_cassa", meseA);
      if (error) throw error;

      // Group by compagnia
      const map: Record<string, { nome: string; count: number; premio_lordo: number; provvigioni: number; da_rimettere: number; compagnia_id: string }> = {};
      for (const t of (data || []) as any[]) {
        const cId = t.compagnia_id || "sconosciuta";
        const cNome = t.compagnie?.nome || "Senza compagnia";
        if (!map[cId]) map[cId] = { nome: cNome, count: 0, premio_lordo: 0, provvigioni: 0, da_rimettere: 0, compagnia_id: cId };
        const lordo = t.premio_lordo || 0;
        const provv = (t.provvigioni_firma || 0) + (t.provvigioni_quietanza || 0);
        map[cId].count++;
        map[cId].premio_lordo += lordo;
        map[cId].provvigioni += provv;
        map[cId].da_rimettere += lordo - provv;
      }
      return Object.values(map).sort((a, b) => b.da_rimettere - a.da_rimettere);
    },
  });

  const totali = titoliCassa.reduce(
    (acc, g) => ({
      count: acc.count + g.count,
      premio_lordo: acc.premio_lordo + g.premio_lordo,
      provvigioni: acc.provvigioni + g.provvigioni,
      da_rimettere: acc.da_rimettere + g.da_rimettere,
    }),
    { count: 0, premio_lordo: 0, provvigioni: 0, da_rimettere: 0 }
  );

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
        <p className="text-muted-foreground">Riepilogo premi messi a cassa per compagnia</p>
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

      {/* Riepilogo premi per compagnia */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Package className="w-5 h-5" />Riepilogo Messa a Cassa — {meseLabel}</CardTitle></CardHeader>
        <CardContent>
          {titoliCassa.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun titolo messo a cassa nel mese selezionato</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compagnia</TableHead>
                  <TableHead className="text-right">Titoli</TableHead>
                  <TableHead className="text-right">Premio Lordo</TableHead>
                  <TableHead className="text-right">Provvigioni</TableHead>
                  <TableHead className="text-right">Da Rimettere</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {titoliCassa.map((g) => (
                  <TableRow key={g.compagnia_id}>
                    <TableCell className="font-medium">{g.nome}</TableCell>
                    <TableCell className="text-right">{g.count}</TableCell>
                    <TableCell className="text-right font-mono">€ {g.premio_lordo.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">€ {g.provvigioni.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">€ {g.da_rimettere.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">Totale</TableCell>
                  <TableCell className="text-right font-bold">{totali.count}</TableCell>
                  <TableCell className="text-right font-mono font-bold">€ {totali.premio_lordo.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">€ {totali.provvigioni.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">€ {totali.da_rimettere.toFixed(2)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Lista rimesse storiche */}
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
                      <TableCell className="font-mono">€ {(r.totale_importi ?? 0).toFixed(2)}</TableCell>
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
