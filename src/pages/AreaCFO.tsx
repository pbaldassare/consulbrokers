import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Percent,
  CreditCard, FileText, Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--accent))",
];

const AreaCFO = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dataDa, setDataDa] = useState("");
  const [dataA, setDataA] = useState("");
  const [ufficioId, setUfficioId] = useState("all");
  const [compagniaId, setCompagniaId] = useState("all");
  const [produttoreId, setProduttoreId] = useState("all");

  const filterParams = useMemo(() => ({
    _data_da: dataDa || null,
    _data_a: dataA || null,
    _ufficio_id: ufficioId !== "all" ? ufficioId : null,
  }), [dataDa, dataA, ufficioId]);

  // Reference data
  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uffici").select("*").eq("attivo", true).order("nome_ufficio");
      if (error) throw error;
      return data;
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie_attive"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compagnie").select("*").eq("attiva", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_produttori"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome, cognome").eq("attivo", true);
      if (error) throw error;
      return data;
    },
  });

  // KPI
  const { data: kpi } = useQuery({
    queryKey: ["cfo_kpi", filterParams],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_kpi", filterParams as any);
      if (error) throw error;
      return data as any;
    },
  });

  // Charts
  const { data: entrateUscite = [] } = useQuery({
    queryKey: ["cfo_entrate_uscite", filterParams],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_entrate_uscite_mensili", filterParams as any);
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const { data: premiCompagnia = [] } = useQuery({
    queryKey: ["cfo_premi_compagnia", dataDa, dataA],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_premi_per_compagnia", {
        _data_da: dataDa || null,
        _data_a: dataA || null,
      } as any);
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const { data: redditUfficio = [] } = useQuery({
    queryKey: ["cfo_redditivita", dataDa, dataA],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_redditivita_ufficio", {
        _data_da: dataDa || null,
        _data_a: dataA || null,
      } as any);
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const { data: provvMensili = [] } = useQuery({
    queryKey: ["cfo_provvigioni_mensili", filterParams],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_provvigioni_mensili", filterParams as any);
      if (error) throw error;
      return (data as any) || [];
    },
  });

  // Provvigioni non pagate
  const { data: provvNonPagate = [] } = useQuery({
    queryKey: ["cfo_provv_non_pagate"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_provvigioni_non_pagate");
      if (error) throw error;
      return (data as any) || [];
    },
  });

  // Report
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const { data, error } = await supabase.rpc("cfo_report_titoli", {
        _data_da: dataDa || null,
        _data_a: dataA || null,
        _ufficio_id: ufficioId !== "all" ? ufficioId : null,
        _compagnia_id: compagniaId !== "all" ? compagniaId : null,
        _produttore_id: produttoreId !== "all" ? produttoreId : null,
      } as any);
      if (error) throw error;
      setReportData((data as any) || []);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
    setReportLoading(false);
  };

  const exportCSV = () => {
    if (!reportData?.length) return;
    const headers = Object.keys(reportData[0]);
    const csv = [
      headers.join(";"),
      ...reportData.map((r) => headers.map((h) => r[h] ?? "").join(";")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_cfo_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Pagamento provvigioni
  const pagaMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("provvigioni_generate")
        .update({ pagata: true })
        .eq("user_id", userId)
        .eq("pagata", false);
      if (error) throw error;
      await logAttivita({
        azione: "pagamento_provvigioni",
        entita_tipo: "provvigioni_generate",
        entita_id: userId,
        dettagli_json: { user_id: userId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cfo_provv_non_pagate"] });
      queryClient.invalidateQueries({ queryKey: ["cfo_kpi"] });
      queryClient.invalidateQueries({ queryKey: ["cfo_provvigioni_mensili"] });
      toast({ title: "Provvigioni segnate come pagate" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  const fmt = (n: number) => `€ ${(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Area CFO</h1>
        <p className="text-muted-foreground">Dashboard direzionale e reportistica aggregata</p>
      </div>

      {/* Filtri globali */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-4 items-end">
          <div><Label className="text-xs">Da</Label><Input type="date" value={dataDa} onChange={(e) => setDataDa(e.target.value)} className="w-[160px]" /></div>
          <div><Label className="text-xs">A</Label><Input type="date" value={dataA} onChange={(e) => setDataA(e.target.value)} className="w-[160px]" /></div>
          <div>
            <Label className="text-xs">Ufficio</Label>
            <Select value={ufficioId} onValueChange={setUfficioId}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tutti</SelectItem>{uffici.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setDataDa(""); setDataA(""); setUfficioId("all"); }}>Reset</Button>
        </CardContent>
      </Card>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-1 text-xs text-muted-foreground"><DollarSign className="w-3 h-3" />Premi Incassati</div><p className="text-lg font-bold font-mono mt-1">{fmt(kpi?.totale_premi_incassati)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-1 text-xs text-muted-foreground"><Percent className="w-3 h-3" />Provv. Generate</div><p className="text-lg font-bold font-mono mt-1">{fmt(kpi?.totale_provvigioni_generate)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-1 text-xs text-muted-foreground"><CreditCard className="w-3 h-3" />Provv. Pagate</div><p className="text-lg font-bold font-mono mt-1">{fmt(kpi?.totale_provvigioni_pagate)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="w-3 h-3" />Entrate</div><p className="text-lg font-bold font-mono mt-1">{fmt(kpi?.totale_entrate)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingDown className="w-3 h-3" />Uscite</div><p className="text-lg font-bold font-mono mt-1">{fmt(kpi?.totale_uscite)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle className="w-3 h-3" />Incroci KO</div><p className="text-lg font-bold mt-1">{kpi?.incroci_ko ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-1 text-xs text-muted-foreground"><FileText className="w-3 h-3" />Sinistri Aperti</div><p className="text-lg font-bold mt-1">{kpi?.sinistri_aperti ?? 0}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="grafici">
        <TabsList>
          <TabsTrigger value="grafici"><BarChart3 className="w-4 h-4 mr-1" />Grafici</TabsTrigger>
          <TabsTrigger value="report"><FileText className="w-4 h-4 mr-1" />Report</TabsTrigger>
          <TabsTrigger value="pagamenti"><CreditCard className="w-4 h-4 mr-1" />Pagamenti Provvigioni</TabsTrigger>
        </TabsList>

        {/* GRAFICI */}
        <TabsContent value="grafici" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Entrate vs Uscite */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Entrate vs Uscite (Mensile)</CardTitle></CardHeader>
              <CardContent>
                {entrateUscite.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={entrateUscite}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="mese" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="entrate" fill="hsl(var(--primary))" name="Entrate" />
                      <Bar dataKey="uscite" fill="hsl(var(--destructive))" name="Uscite" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-10">Nessun dato disponibile</p>}
              </CardContent>
            </Card>

            {/* Premi per Compagnia */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Premi per Compagnia</CardTitle></CardHeader>
              <CardContent>
                {premiCompagnia.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={premiCompagnia} dataKey="totale" nameKey="compagnia" cx="50%" cy="50%" outerRadius={100} label={({ compagnia, percent }) => `${compagnia} ${(percent * 100).toFixed(0)}%`}>
                        {premiCompagnia.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-10">Nessun dato disponibile</p>}
              </CardContent>
            </Card>

            {/* Redditività per Ufficio */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Redditività per Ufficio</CardTitle></CardHeader>
              <CardContent>
                {redditUfficio.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={redditUfficio}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="ufficio" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="entrate" fill="hsl(var(--primary))" name="Entrate" />
                      <Bar dataKey="uscite" fill="hsl(var(--destructive))" name="Uscite" />
                      <Bar dataKey="margine" fill="hsl(var(--chart-3))" name="Margine" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-10">Nessun dato disponibile</p>}
              </CardContent>
            </Card>

            {/* Andamento Provvigioni */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Andamento Provvigioni (Mensile)</CardTitle></CardHeader>
              <CardContent>
                {provvMensili.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={provvMensili}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="mese" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="totale" stroke="hsl(var(--primary))" name="Totale" strokeWidth={2} />
                      <Line type="monotone" dataKey="pagate" stroke="hsl(var(--chart-3))" name="Pagate" />
                      <Line type="monotone" dataKey="non_pagate" stroke="hsl(var(--destructive))" name="Non Pagate" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-10">Nessun dato disponibile</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* REPORT */}
        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Genera Report Titoli</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label className="text-xs">Compagnia</Label>
                  <Select value={compagniaId} onValueChange={setCompagniaId}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Tutte</SelectItem>{compagnie.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Produttore</Label>
                  <Select value={produttoreId} onValueChange={setProduttoreId}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Tutti</SelectItem>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} {p.cognome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={generateReport} disabled={reportLoading}>{reportLoading ? "Generando..." : "Genera Report"}</Button>
                {reportData && reportData.length > 0 && (
                  <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" />Esporta CSV</Button>
                )}
              </div>

              {reportData && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N. Titolo</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Prodotto</TableHead>
                        <TableHead>Compagnia</TableHead>
                        <TableHead>Ufficio</TableHead>
                        <TableHead>Produttore</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Premio €</TableHead>
                        <TableHead>Incassato €</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.numero_titolo || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{r.stato}</Badge></TableCell>
                          <TableCell>{r.prodotto || "—"}</TableCell>
                          <TableCell>{r.compagnia || "—"}</TableCell>
                          <TableCell>{r.ufficio || "—"}</TableCell>
                          <TableCell>{r.produttore || "—"}</TableCell>
                          <TableCell>{r.cliente || "—"}</TableCell>
                          <TableCell className="font-mono">{r.premio_lordo?.toFixed(2) ?? "—"}</TableCell>
                          <TableCell className="font-mono">{r.importo_incassato?.toFixed(2) ?? "—"}</TableCell>
                          <TableCell>{r.data_incasso || "—"}</TableCell>
                        </TableRow>
                      ))}
                      {reportData.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Nessun risultato</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAGAMENTI PROVVIGIONI */}
        <TabsContent value="pagamenti">
          <Card>
            <CardHeader><CardTitle className="text-sm">Provvigioni Non Pagate per Utente</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utente</TableHead>
                    <TableHead>N. Provvigioni</TableHead>
                    <TableHead>Totale Non Pagato €</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {provvNonPagate.map((p: any) => (
                    <TableRow key={p.user_id}>
                      <TableCell className="font-medium">{p.nome} {p.cognome}</TableCell>
                      <TableCell>{p.num_provvigioni}</TableCell>
                      <TableCell className="font-mono font-bold">{fmt(p.totale_non_pagato)}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => pagaMutation.mutate(p.user_id)} disabled={pagaMutation.isPending}>
                          Segna come pagate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {provvNonPagate.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nessuna provvigione da pagare</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AreaCFO;
