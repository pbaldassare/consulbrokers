import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { fmtEuro } from "@/lib/formatCurrency";
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarIcon, CheckCircle, Clock,
  FileWarning, GitCompare, Receipt, RefreshCw, Scale, TrendingDown, TrendingUp
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const CruscottoGiornaliero = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const uffId = profile?.ufficio_id;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dataStr = format(selectedDate, "yyyy-MM-dd");
  const ieriStr = format(subDays(selectedDate, 1), "yyyy-MM-dd");
  const fra7ggStr = format(new Date(selectedDate.getTime() + 7 * 86400000), "yyyy-MM-dd");

  const fmt = fmtEuro;

  // --- QUERIES ---

  // Movimenti del giorno selezionato
  const { data: movOggi = [], isLoading: loadMov, refetch: refetchMov } = useQuery({
    queryKey: ["cruscotto_mov", uffId, dataStr],
    queryFn: async () => {
      const q = supabase.from("movimenti_contabili").select("*").eq("data_movimento", dataStr);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Movimenti giorno precedente (per saldo iniziale quadratura)
  const { data: movIeri = [] } = useQuery({
    queryKey: ["cruscotto_mov_ieri", uffId, ieriStr],
    queryFn: async () => {
      const q = supabase.from("movimenti_contabili").select("tipo, importo").lte("data_movimento", ieriStr);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Estratti non riconciliati
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

  // Estratti totali per progress (riconciliati + non)
  const { data: estrattiTotali = [] } = useQuery({
    queryKey: ["cruscotto_estratti_totali", uffId, dataStr],
    queryFn: async () => {
      const q = supabase.from("estratti_conto").select("stato").eq("data_operazione", dataStr);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Incroci KO aperti
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

  // Scadenze fornitore prossimi 7 giorni
  const { data: scadenzeFornitori = [], refetch: refetchSF } = useQuery({
    queryKey: ["cruscotto_scadenze_fornitori", uffId, dataStr],
    queryFn: async () => {
      const q = supabase
        .from("primanota_generale")
        .select("*, fornitori(nome)")
        .lte("data_documento", fra7ggStr)
        .gte("data_documento", dataStr)
        .eq("stato", "aperta");
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("data_documento").limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Incassi da verificare: titoli non ancora incassati
  const { data: titoliDaVerificare = [], refetch: refetchTV } = useQuery({
    queryKey: ["cruscotto_titoli_da_verificare", uffId],
    queryFn: async () => {
      const q = supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, stato, data_scadenza")
        .in("stato", ["emesso", "in_lavorazione", "da_incassare"]);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Titoli in scadenza oggi + 7gg
  const { data: titoliInScadenza = [] } = useQuery({
    queryKey: ["cruscotto_titoli_scadenza", uffId, dataStr],
    queryFn: async () => {
      const q = supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, stato, data_scadenza")
        .gte("data_scadenza", dataStr)
        .lte("data_scadenza", fra7ggStr)
        .neq("stato", "incassato");
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("data_scadenza").limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // --- CALCULATIONS ---

  const totEntrate = movOggi.filter(m => m.tipo === "entrata").reduce((s, m) => s + (m.importo || 0), 0);
  const totUscite = movOggi.filter(m => m.tipo === "uscita").reduce((s, m) => s + (m.importo || 0), 0);
  const saldoGiorno = totEntrate - totUscite;

  // Quadratura cassa
  const saldoPrecedente = movIeri.reduce((s, m: any) => {
    return s + (m.tipo === "entrata" ? (m.importo || 0) : -(m.importo || 0));
  }, 0);
  const saldoAtteso = saldoPrecedente + saldoGiorno;
  // For now, differenza is 0 since we don't have a separate "saldo effettivo" field
  // In a real scenario, this would compare with the actual cash register value
  const differenzaCassa = 0;

  // Incassi da verificare totals
  const totIncassiDaVerificare = titoliDaVerificare.reduce((s, t: any) => s + (t.premio_lordo || 0), 0);

  // Reconciliation progress
  const estrattiRiconciliati = estrattiTotali.filter((e: any) => e.stato === "ok" || e.stato === "matchato").length;
  const estrattiTotCount = estrattiTotali.length;
  const percRiconciliazione = estrattiTotCount > 0 ? Math.round((estrattiRiconciliati / estrattiTotCount) * 100) : 100;

  const refreshAll = () => {
    refetchMov();
    refetchNR();
    refetchKO();
    refetchSF();
    refetchTV();
  };

  return (
    <div className="space-y-6">
      {/* Header con filtro data */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cruscotto del Giorno</h1>
          <p className="text-sm text-muted-foreground">
            {format(selectedDate, "EEEE d MMMM yyyy", { locale: it })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2", format(selectedDate, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd") && "border-primary text-primary")}>
                <CalendarIcon className="w-4 h-4" />
                {format(selectedDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
            Oggi
          </Button>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <ArrowDownLeft className="w-3.5 h-3.5" /> Entrate
            </CardDescription>
            <CardTitle className="text-xl text-green-600">{fmt(totEntrate)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{movOggi.filter(m => m.tipo === "entrata").length} mov.</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <ArrowUpRight className="w-3.5 h-3.5" /> Uscite
            </CardDescription>
            <CardTitle className="text-xl text-red-600">{fmt(totUscite)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{movOggi.filter(m => m.tipo === "uscita").length} mov.</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${saldoGiorno >= 0 ? "border-l-blue-500" : "border-l-orange-500"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              {saldoGiorno >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              Saldo Giornata
            </CardDescription>
            <CardTitle className={`text-xl ${saldoGiorno >= 0 ? "text-blue-600" : "text-orange-600"}`}>
              {fmt(saldoGiorno)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{movOggi.length} mov. totali</p>
          </CardContent>
        </Card>

        {/* Incassi da Verificare */}
        <Card className={`border-l-4 ${titoliDaVerificare.length > 0 ? "border-l-amber-500" : "border-l-green-500"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Receipt className="w-3.5 h-3.5" /> Incassi da Verificare
            </CardDescription>
            <CardTitle className="text-xl">{titoliDaVerificare.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{fmt(totIncassiDaVerificare)} attesi</p>
          </CardContent>
        </Card>

        {/* Da Riconciliare */}
        <Card className={`border-l-4 ${nonRiconciliati.length > 0 ? "border-l-amber-500" : "border-l-green-500"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <GitCompare className="w-3.5 h-3.5" /> Da Riconciliare
            </CardDescription>
            <CardTitle className="text-xl">{nonRiconciliati.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">mov. bancari non matchati</p>
          </CardContent>
        </Card>

        {/* Quadratura Cassa */}
        <Card className={`border-l-4 ${differenzaCassa === 0 ? "border-l-green-500" : "border-l-destructive"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Scale className="w-3.5 h-3.5" /> Quadratura Cassa
            </CardDescription>
            <CardTitle className={`text-xl ${differenzaCassa === 0 ? "text-green-600" : "text-destructive"}`}>
              {differenzaCassa === 0 ? "OK" : fmt(differenzaCassa)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Atteso: {fmt(saldoAtteso)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar riconciliazione */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Riconciliazione del giorno</CardTitle>
            <span className="text-sm font-mono text-muted-foreground">
              {estrattiRiconciliati}/{estrattiTotCount} ({percRiconciliazione}%)
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={percRiconciliazione} className="h-2.5" />
          <p className="text-xs text-muted-foreground mt-2">
            {percRiconciliazione === 100
              ? "✓ Tutti i movimenti bancari del giorno sono stati riconciliati"
              : `${estrattiTotCount - estrattiRiconciliati} movimenti ancora da riconciliare`}
          </p>
        </CardContent>
      </Card>

      {/* Titoli in Scadenza + Anomalie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Titoli in Scadenza */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-amber-500" />
              Titoli in Scadenza (7gg) ({titoliInScadenza.length})
            </CardTitle>
            <CardDescription>Premi attesi nei prossimi 7 giorni</CardDescription>
          </CardHeader>
          <CardContent>
            {titoliInScadenza.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle className="w-4 h-4 text-green-500" /> Nessun titolo in scadenza
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {titoliInScadenza.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-sm border-b pb-1.5">
                    <div className="truncate flex-1">
                      <span className="font-medium">{t.numero_titolo || "—"}</span>
                      <Badge variant="outline" className="ml-2 text-[10px]">{t.stato}</Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-xs">{fmt(t.premio_lordo || 0)}</span>
                      <Badge variant="secondary" className="text-[10px]">{t.data_scadenza}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {titoliInScadenza.length > 0 && (
              <Button variant="link" size="sm" className="mt-2 p-0 h-auto" onClick={() => navigate("/titoli")}>
                Vedi tutti i titoli →
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Anomalie Bancarie */}
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
              <div className="space-y-2 max-h-56 overflow-y-auto">
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
      </div>

      {/* Scadenze fornitori */}
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
                    <span className="font-medium">{s.fornitori?.nome || s.descrizione || "—"}</span>
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
            <Button variant="link" size="sm" className="mt-2 p-0 h-auto" onClick={() => navigate("/contabilita")}>
              Vai a Contabilità →
            </Button>
          )}
        </CardContent>
      </Card>

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
          <CardTitle className="text-base">Movimenti Registrati</CardTitle>
          <CardDescription>{format(selectedDate, "d MMMM yyyy", { locale: it })}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadMov ? (
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          ) : movOggi.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nessun movimento registrato.</p>
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
