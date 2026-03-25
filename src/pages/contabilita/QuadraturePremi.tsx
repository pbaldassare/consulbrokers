import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Clock, Search, TrendingDown } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

const QuadraturePremi = () => {
  const { profile } = useAuth();
  const uffId = profile?.ufficio_id;
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [searchText, setSearchText] = useState("");

  // Titoli in attesa di incasso
  const { data: titoliAttesa = [], isLoading } = useQuery({
    queryKey: ["quadratura_titoli_attesa", uffId],
    queryFn: async () => {
      const q = supabase
        .from("titoli")
        .select("*, prodotti(nome_prodotto, compagnia_id, compagnie(nome))")
        .in("stato", ["emesso", "in_attesa"])
        .order("data_scadenza", { ascending: true });
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Estratti conto recenti (entrate) per matching
  const { data: estrattiEntrata = [] } = useQuery({
    queryKey: ["quadratura_estratti_entrata", uffId],
    queryFn: async () => {
      const trentaGgFa = new Date();
      trentaGgFa.setDate(trentaGgFa.getDate() - 30);
      const q = supabase
        .from("estratti_conto")
        .select("*")
        .gte("importo", 0)
        .gte("data_operazione", trentaGgFa.toISOString().split("T")[0])
        .eq("stato", "nuovo");
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("data_operazione", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const oggi = new Date();

  // Enriched titoli with delay info
  const titoliEnriched = titoliAttesa.map((t: any) => {
    const scadenza = t.data_scadenza ? new Date(t.data_scadenza) : null;
    const giorniRitardo = scadenza ? Math.floor((oggi.getTime() - scadenza.getTime()) / 86400000) : 0;

    // Try to find matching bank entry
    const possibileMatch = estrattiEntrata.find(
      (e: any) => Math.abs(e.importo - (t.premio_lordo || 0)) < 0.05
    );

    return {
      ...t,
      giorniRitardo: Math.max(0, giorniRitardo),
      inRitardo: giorniRitardo > 0,
      possibileMatch,
    };
  });

  const inRitardo = titoliEnriched.filter((t: any) => t.inRitardo);
  const conMatch = titoliEnriched.filter((t: any) => t.possibileMatch);

  const filtered = titoliEnriched.filter((t: any) => {
    if (filtroStato === "ritardo" && !t.inRitardo) return false;
    if (filtroStato === "match" && !t.possibileMatch) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      return (
        t.numero_titolo?.toLowerCase().includes(s) ||
        (t.prodotti as any)?.nome_prodotto?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Quadratura Premi</h1>
        <p className="text-sm text-muted-foreground">Verifica arrivo premi e confronto con movimenti bancari</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Titoli in Attesa</CardDescription>
            <CardTitle className="text-2xl">{titoliAttesa.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> In Ritardo
            </CardDescription>
            <CardTitle className="text-2xl text-red-600">{inRitardo.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Possibile Match
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">{conMatch.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription>Mov. Bancari Non Matchati</CardDescription>
            <CardTitle className="text-2xl">{estrattiEntrata.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca titolo..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroStato} onValueChange={setFiltroStato}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti</SelectItem>
            <SelectItem value="ritardo">Solo in ritardo</SelectItem>
            <SelectItem value="match">Con possibile match</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Caricamento...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Prodotto</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead className="text-right">Premio Atteso</TableHead>
                  <TableHead>Ritardo</TableHead>
                  <TableHead>Match Bancario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 50).map((t: any) => (
                  <TableRow key={t.id} className={t.giorniRitardo > 7 ? "bg-destructive/5" : ""}>
                    <TableCell className="font-medium font-mono text-sm">
                      {t.numero_titolo || t.id?.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(t.prodotti as any)?.nome_prodotto || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {t.data_scadenza || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmt(t.premio_lordo || 0)}
                    </TableCell>
                    <TableCell>
                      {t.giorniRitardo > 0 ? (
                        <Badge variant={t.giorniRitardo > 7 ? "destructive" : "secondary"} className="text-[10px]">
                          <Clock className="w-3 h-3 mr-1" />
                          {t.giorniRitardo}gg
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">In scadenza</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.possibileMatch ? (
                        <Badge variant="outline" className="text-[10px] border-green-500 text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {fmt(t.possibileMatch.importo)} del {t.possibileMatch.data_operazione}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nessun titolo trovato
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {filtered.length > 50 && (
            <p className="text-xs text-muted-foreground mt-2">Mostrati 50 di {filtered.length} risultati</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuadraturePremi;
