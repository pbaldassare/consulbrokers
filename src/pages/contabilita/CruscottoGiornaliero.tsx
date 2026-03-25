import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle, Clock, DollarSign,
  GitCompare, TrendingDown, TrendingUp, RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const oggi = new Date().toISOString().split("T")[0];

const CruscottoGiornaliero = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const uffId = profile?.ufficio_id;

  // KPI: movimenti oggi
  const { data: movOggi = [], isLoading: loadMov, refetch: refetchMov } = useQuery({
    queryKey: ["cruscotto_mov_oggi", uffId],
    queryFn: async () => {
      const q = supabase.from("movimenti_contabili").select("*").eq("data_movimento", oggi);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // KPI: estratti non riconciliati
  const { data: nonRiconciliati = [], refetch: refetchNR } = useQuery({
    queryKey: ["cruscotto_non_riconciliati", uffId],
    queryFn: async () => {
      const q = supabase.from("estratti_conto").select("*").eq("stato", "nuovo");
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("data_operazione", { ascending: false }).limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // KPI: incroci KO aperti
  const { data: incrociKO = [], refetch: refetchKO } = useQuery({
    queryKey: ["cruscotto_incroci_ko"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incroci_bancari")
        .select("*, estratti_conto(*), movimenti_contabili(*)")
        .eq("esito", "ko")
        .eq("verificato", false)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // KPI: scadenze fornitore prossimi 7 giorni
  const { data: scadenzeFornitori = [], refetch: refetchSF } = useQuery({
    queryKey: ["cruscotto_scadenze_fornitori", uffId],
    queryFn: async () => {
      const fra7gg = new Date();
      fra7gg.setDate(fra7gg.getDate() + 7);
      const q = supabase
        .from("primanota_generale")
        .select("*, fornitori(nome)")
        .lte("data_documento", fra7gg.toISOString().split("T")[0])
        .gte("data_documento", oggi)
        .eq("stato", "aperta");
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("data_documento").limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const totEntrate = movOggi.filter(m => m.tipo === "entrata").reduce((s, m) => s + (m.importo || 0), 0);
  const totUscite = movOggi.filter(m => m.tipo === "uscita").reduce((s, m) => s + (m.importo || 0), 0);
  const saldoGiorno = totEntrate - totUscite;

  const refreshAll = () => {
    refetchMov();
    refetchNR();
    refetchKO();
    refetchSF();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cruscotto del Giorno</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: it })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll}>
          <RefreshCw className="w-4 h-4 mr-2" /> Aggiorna
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5" /> Entrate Oggi
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">{fmt(totEntrate)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{movOggi.filter(m => m.tipo === "entrata").length} movimenti</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Uscite Oggi
            </CardDescription>
            <CardTitle className="text-2xl text-red-600">{fmt(totUscite)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{movOggi.filter(m => m.tipo === "uscita").length} movimenti</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${saldoGiorno >= 0 ? "border-l-blue-500" : "border-l-orange-500"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              {saldoGiorno >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              Saldo Giornata
            </CardDescription>
            <CardTitle className={`text-2xl ${saldoGiorno >= 0 ? "text-blue-600" : "text-orange-600"}`}>
              {fmt(saldoGiorno)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{movOggi.length} movimenti totali</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${nonRiconciliati.length > 0 ? "border-l-amber-500" : "border-l-green-500"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <GitCompare className="w-3.5 h-3.5" /> Da Riconciliare
            </CardDescription>
            <CardTitle className="text-2xl">
              {nonRiconciliati.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              movimenti bancari non matchati
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className={`${incrociKO.length > 0 ? "border-destructive/50" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Anomalie Bancarie ({incrociKO.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incrociKO.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle className="w-4 h-4 text-green-500" /> Nessuna anomalia aperta
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {incrociKO.map((ib: any) => (
                  <div key={ib.id} className="flex items-center justify-between text-sm border-b pb-1">
                    <div className="truncate flex-1">
                      <span className="font-medium">{ib.note || "Incrocio KO"}</span>
                      {ib.differenza && (
                        <span className="ml-2 text-destructive font-mono text-xs">Δ {fmt(ib.differenza)}</span>
                      )}
                    </div>
                    <Badge variant="destructive" className="text-[10px]">KO</Badge>
                  </div>
                ))}
              </div>
            )}
            {incrociKO.length > 0 && (
              <Button variant="link" size="sm" className="mt-2 p-0 h-auto" onClick={() => navigate("/anomalie-ko")}>
                Vedi tutte →
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Scadenze Fornitori (7gg) ({scadenzeFornitori.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scadenzeFornitori.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle className="w-4 h-4 text-green-500" /> Nessuna scadenza prossima
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {scadenzeFornitori.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between text-sm border-b pb-1">
                    <div className="truncate flex-1">
                      <span className="font-medium">{(s.fornitori as any)?.nome || s.descrizione || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{fmt(s.totale || 0)}</span>
                      <Badge variant="outline" className="text-[10px]">{s.data_documento}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {scadenzeFornitori.length > 0 && (
              <Button variant="link" size="sm" className="mt-2 p-0 h-auto" onClick={() => navigate("/cont-generale/scadenziario")}>
                Vedi scadenziario →
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Movimenti non riconciliati */}
      {nonRiconciliati.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimenti Bancari da Riconciliare</CardTitle>
            <CardDescription>Estratti conto importati non ancora matchati con movimenti contabili</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nonRiconciliati.slice(0, 10).map((ec: any) => (
                  <TableRow key={ec.id}>
                    <TableCell className="font-mono text-xs">{ec.data_operazione}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{ec.descrizione || "—"}</TableCell>
                    <TableCell className={`text-right font-mono ${ec.importo >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(ec.importo)}
                    </TableCell>
                    <TableCell><Badge variant="secondary">Nuovo</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {nonRiconciliati.length > 10 && (
              <p className="text-xs text-muted-foreground mt-2">
                ...e altri {nonRiconciliati.length - 10} movimenti
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Movimenti di oggi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimenti Registrati Oggi</CardTitle>
        </CardHeader>
        <CardContent>
          {loadMov ? (
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          ) : movOggi.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nessun movimento registrato oggi.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movOggi.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge variant={m.tipo === "entrata" ? "default" : "destructive"} className="text-[10px]">
                        {m.tipo === "entrata" ? "↓ Entrata" : "↑ Uscita"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{m.categoria || "—"}</TableCell>
                    <TableCell className="max-w-[250px] truncate text-sm">{m.descrizione || "—"}</TableCell>
                    <TableCell className={`text-right font-mono ${m.tipo === "entrata" ? "text-green-600" : "text-red-600"}`}>
                      {fmt(m.importo)}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{m.stato}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CruscottoGiornaliero;
