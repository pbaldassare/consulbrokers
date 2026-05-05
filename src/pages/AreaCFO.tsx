import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Percent,
  CreditCard, FileText, Download, RefreshCw, Loader2, RotateCcw, Activity,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Treemap,
} from "recharts";
import CfoAiChat from "@/components/cfo/CfoAiChat";
import CfoChartCard from "@/components/cfo/CfoChartCard";
import CfoDrillDownDialog, { type DrillState } from "@/components/cfo/CfoDrillDownDialog";
import { Sparkles } from "lucide-react";

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--accent))",
  "#2563eb", "#16a34a", "#dc2626", "#9333ea", "#f59e0b", "#06b6d4",
  "#e11d48", "#84cc16", "#6366f1",
];

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
}

const KpiCard = ({ label, value, icon, iconBg }: KpiCardProps) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-5">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold font-mono mt-0.5 truncate">{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const AreaCFO = () => {
  const queryClient = useQueryClient();

  const [dataDa, setDataDa] = useState("");
  const [dataA, setDataA] = useState("");
  const [ufficioId, setUfficioId] = useState("all");
  const [compagniaId, setCompagniaId] = useState("");
  const [produttoreNome, setProduttoreNome] = useState("all");

  const filterParams = useMemo(() => ({
    _data_da: dataDa || null,
    _data_a: dataA || null,
    _ufficio_id: ufficioId !== "all" ? ufficioId : null,
    _compagnia_id: compagniaId || null,
    _produttore_nome: produttoreNome !== "all" ? produttoreNome : null,
  }), [dataDa, dataA, ufficioId, compagniaId, produttoreNome]);

  // Reference data
  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uffici").select("*").eq("attivo", true).order("nome_ufficio");
      if (error) throw error;
      return data;
    },
  });

  const { data: agenzie = [] } = useQuery({
    queryKey: ["compagnie_attive"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: produttori = [] } = useQuery({
    queryKey: ["produttori_distinti"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("produttore_nome")
        .not("produttore_nome", "is", null)
        .not("produttore_nome", "eq", "");
      if (error) throw error;
      const unique = [...new Set((data || []).map((d: any) => d.produttore_nome))].sort();
      return unique;
    },
    staleTime: 5 * 60 * 1000,
  });

  const compagniaOptions = useMemo(() =>
    compagnie.map((c) => ({ value: c.id, label: c.nome })),
    [agenzie]
  );

  // KPI
  const { data: kpi } = useQuery({
    queryKey: ["cfo_kpi", filterParams],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_kpi", filterParams as any);
      if (error) throw error;
      return data as any;
    },
    staleTime: 60_000,
  });

  // Charts
  const entrateUsciteQ = useQuery({
    queryKey: ["cfo_entrate_uscite", filterParams],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_entrate_uscite_mensili", {
        _data_da: filterParams._data_da,
        _data_a: filterParams._data_a,
        _ufficio_id: filterParams._ufficio_id,
      } as any);
      if (error) throw error;
      return (data as any) || [];
    },
    staleTime: 60_000,
  });
  const entrateUscite = entrateUsciteQ.data || [];

  const premiCompagniaQ = useQuery({
    queryKey: ["cfo_premi_compagnia", filterParams],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_premi_per_compagnia", filterParams as any);
      if (error) throw error;
      return (data as any) || [];
    },
    staleTime: 60_000,
  });
  const premiCompagnia = premiCompagniaQ.data || [];

  const premiRamoQ = useQuery({
    queryKey: ["cfo_premi_ramo", filterParams],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_premi_per_ramo" as any, filterParams as any);
      if (error) throw error;
      return (data as any) || [];
    },
    staleTime: 60_000,
  });
  const premiRamo = premiRamoQ.data || [];

  const premiProduttoreQ = useQuery({
    queryKey: ["cfo_premi_produttore", filterParams],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_premi_per_produttore" as any, {
        _data_da: filterParams._data_da,
        _data_a: filterParams._data_a,
        _ufficio_id: filterParams._ufficio_id,
        _compagnia_id: filterParams._compagnia_id,
      } as any);
      if (error) throw error;
      return (data as any) || [];
    },
    staleTime: 60_000,
  });
  const premiProduttore = premiProduttoreQ.data || [];

  const redditUfficioQ = useQuery({
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
  const redditUfficio = redditUfficioQ.data || [];

  const provvMensiliQ = useQuery({
    queryKey: ["cfo_provvigioni_mensili", filterParams],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_provvigioni_mensili", {
        _data_da: filterParams._data_da,
        _data_a: filterParams._data_a,
        _ufficio_id: filterParams._ufficio_id,
      } as any);
      if (error) throw error;
      return (data as any) || [];
    },
  });
  const provvMensili = provvMensiliQ.data || [];

  // Provvigioni non pagate
  const { data: provvNonPagate = [] } = useQuery({
    queryKey: ["cfo_provv_non_pagate"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cfo_provvigioni_non_pagate");
      if (error) throw error;
      return (data as any) || [];
    },
  });

  // ===== NUOVE INTERSEZIONI =====
  const useRpc = (name: string, params: any, key: any[]) =>
    useQuery({
      queryKey: [name, ...key],
      queryFn: async () => {
        const { data, error } = await supabase.rpc(name as any, params as any);
        if (error) throw error;
        return (data as any) || [];
      },
      staleTime: 60_000,
    });

  const trendMensileQ = useRpc("cfo_trend_mensile", filterParams, [filterParams]);
  const yoyMensileQ = useRpc("cfo_yoy_mensile", { _ufficio_id: filterParams._ufficio_id, _compagnia_id: filterParams._compagnia_id }, [filterParams._ufficio_id, filterParams._compagnia_id]);
  const topClientiQ = useRpc("cfo_top_clienti", { _data_da: filterParams._data_da, _data_a: filterParams._data_a, _ufficio_id: filterParams._ufficio_id, _compagnia_id: filterParams._compagnia_id, _limit: 20 }, [filterParams]);
  const distrFasciaQ = useRpc("cfo_distribuzione_clienti_fascia", { _data_da: filterParams._data_da, _data_a: filterParams._data_a }, [filterParams._data_da, filterParams._data_a]);
  const premioMedioRamoQ = useRpc("cfo_premio_medio_ramo", { _data_da: filterParams._data_da, _data_a: filterParams._data_a, _ufficio_id: filterParams._ufficio_id, _compagnia_id: filterParams._compagnia_id }, [filterParams]);
  const premioMedioCompQ = useRpc("cfo_premio_medio_compagnia", { _data_da: filterParams._data_da, _data_a: filterParams._data_a, _ufficio_id: filterParams._ufficio_id }, [filterParams._data_da, filterParams._data_a, filterParams._ufficio_id]);
  const distrStatiQ = useRpc("cfo_distribuzione_stati", { _ufficio_id: filterParams._ufficio_id }, [filterParams._ufficio_id]);
  const matriceSedeCompQ = useRpc("cfo_matrice_sede_compagnia", { _data_da: filterParams._data_da, _data_a: filterParams._data_a }, [filterParams._data_da, filterParams._data_a]);
  const matriceProdRamoQ = useRpc("cfo_matrice_produttore_ramo", { _data_da: filterParams._data_da, _data_a: filterParams._data_a }, [filterParams._data_da, filterParams._data_a]);
  const lossRatioQ = useRpc("cfo_loss_ratio_ramo", { _data_da: filterParams._data_da, _data_a: filterParams._data_a }, [filterParams._data_da, filterParams._data_a]);
  const etaSinistriQ = useRpc("cfo_eta_sinistri_aperti", {}, []);
  const sinistriCompagniaQ = useRpc("cfo_sinistri_per_compagnia", { _data_da: filterParams._data_da, _data_a: filterParams._data_a }, [filterParams._data_da, filterParams._data_a]);

  const trendMensile = trendMensileQ.data || [];
  const yoyMensile = yoyMensileQ.data || [];
  const topClienti = topClientiQ.data || [];
  const distrFascia = distrFasciaQ.data || [];
  const premioMedioRamo = premioMedioRamoQ.data || [];
  const premioMedioComp = premioMedioCompQ.data || [];
  const distrStati = distrStatiQ.data || [];
  const matriceSedeComp = matriceSedeCompQ.data || [];
  const matriceProdRamo = matriceProdRamoQ.data || [];
  const lossRatio = lossRatioQ.data || [];
  const etaSinistri = etaSinistriQ.data || [];
  const sinistriCompagnia = sinistriCompagniaQ.data || [];

  // Drill-down state
  const [drill, setDrill] = useState<DrillState>({
    open: false,
    domain: "titoli",
    title: "",
    extra: {},
  });
  const openDrill = (s: Omit<DrillState, "open">) => setDrill({ ...s, open: true });
  const closeDrill = () => setDrill((p) => ({ ...p, open: false }));

  const treemapData = useMemo(() => {
    const map: Record<string, any[]> = {};
    (matriceProdRamo as any[]).forEach((r) => {
      if (!map[r.ramo]) map[r.ramo] = [];
      map[r.ramo].push({ name: r.produttore || "—", size: Number(r.totale) || 0 });
    });
    return Object.entries(map).map(([name, children]) => ({ name, children }));
  }, [matriceProdRamo]);



  // Report
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const { data, error } = await supabase.rpc("cfo_report_titoli", filterParams as any);
      if (error) throw error;
      setReportData((data as any) || []);
    } catch (err: any) {
      toast.error("Errore");
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
      toast.success("Provvigioni segnate come pagate");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const fmt = (n: number) => `€ ${(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const refreshKpiMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("refresh_cfo_kpi_mensili" as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cfo_kpi"] });
      queryClient.invalidateQueries({ queryKey: ["cfo_entrate_uscite"] });
      queryClient.invalidateQueries({ queryKey: ["cfo_premi_compagnia"] });
      queryClient.invalidateQueries({ queryKey: ["cfo_premi_ramo"] });
      queryClient.invalidateQueries({ queryKey: ["cfo_premi_produttore"] });
      queryClient.invalidateQueries({ queryKey: ["cfo_redditivita"] });
      queryClient.invalidateQueries({ queryKey: ["cfo_provvigioni_mensili"] });
      toast.success("KPI aggiornati");
    },
    onError: (e: any) => toast.error("Errore refresh"),
  });

  const tooltipFormatter = (v: number) => fmt(v);

  const resetFilters = () => {
    setDataDa("");
    setDataA("");
    setUfficioId("all");
    setCompagniaId("");
    setProduttoreNome("all");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Area CFO</h1>
            <p className="text-sm text-muted-foreground">Dashboard direzionale e reportistica aggregata</p>
          </div>
        </div>
        <Button onClick={() => refreshKpiMutation.mutate()} disabled={refreshKpiMutation.isPending}>
          {refreshKpiMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Aggiorna KPI
        </Button>
      </div>

      {/* Filtri globali */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="py-4 px-5">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Data Da</Label>
              <Input type="date" value={dataDa} onChange={(e) => setDataDa(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Data A</Label>
              <Input type="date" value={dataA} onChange={(e) => setDataA(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Sede</Label>
              <Select value={ufficioId} onValueChange={setUfficioId}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {uffici.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Agenzia</Label>
              <SearchableSelect
                options={compagniaOptions}
                value={compagniaId}
                onValueChange={setCompagniaId}
                placeholder="Tutte"
                className="w-[220px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Produttore</Label>
              <Select value={produttoreNome} onValueChange={setProduttoreNome}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {produttori.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Premi Incassati"
          value={fmt(kpi?.totale_premi_incassati)}
          icon={<DollarSign className="w-5 h-5 text-primary" />}
          iconBg="bg-primary/10"
        />
        <KpiCard
          label="Provvigioni Generate"
          value={fmt(kpi?.totale_provvigioni_generate)}
          icon={<Percent className="w-5 h-5 text-chart-2" />}
          iconBg="bg-accent/10"
        />
        <KpiCard
          label="Provvigioni Pagate"
          value={fmt(kpi?.totale_provvigioni_pagate)}
          icon={<CreditCard className="w-5 h-5 text-chart-3" />}
          iconBg="bg-secondary"
        />
        <KpiCard
          label="Entrate"
          value={fmt(kpi?.totale_entrate)}
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
          iconBg="bg-primary/10"
        />
        <KpiCard
          label="Uscite"
          value={fmt(kpi?.totale_uscite)}
          icon={<TrendingDown className="w-5 h-5 text-destructive" />}
          iconBg="bg-destructive/10"
        />
        <KpiCard
          label="Incroci KO"
          value={kpi?.incroci_ko ?? 0}
          icon={<AlertTriangle className="w-5 h-5 text-destructive" />}
          iconBg="bg-destructive/10"
        />
        <KpiCard
          label="Sinistri Aperti"
          value={kpi?.sinistri_aperti ?? 0}
          icon={<Activity className="w-5 h-5 text-chart-4" />}
          iconBg="bg-accent/10"
        />
      </div>

      <Tabs defaultValue="grafici">
        <TabsList className="bg-muted/80 flex-wrap h-auto">
          <TabsTrigger value="grafici"><BarChart3 className="w-4 h-4 mr-1.5" />Grafici Base</TabsTrigger>
          <TabsTrigger value="avanzate"><TrendingUp className="w-4 h-4 mr-1.5" />Analisi Avanzate</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="w-4 h-4 mr-1.5" />AI Analista</TabsTrigger>
          <TabsTrigger value="report"><FileText className="w-4 h-4 mr-1.5" />Report</TabsTrigger>
          <TabsTrigger value="pagamenti"><CreditCard className="w-4 h-4 mr-1.5" />Pagamenti Provvigioni</TabsTrigger>
        </TabsList>

        {/* GRAFICI */}
        <TabsContent value="grafici" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CfoChartCard
              title="Entrate vs Uscite (Mensile)"
              isLoading={entrateUsciteQ.isLoading}
              isError={entrateUsciteQ.isError}
              error={entrateUsciteQ.error}
              isEmpty={entrateUscite.length === 0}
              onRetry={() => entrateUsciteQ.refetch()}
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={entrateUscite}
                  onClick={(e: any) => {
                    const m = e?.activeLabel;
                    if (m) openDrill({ domain: "titoli", title: `Movimenti — ${m}`, extra: { _mese: m } });
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mese" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                  <Bar dataKey="entrate" fill="hsl(var(--primary))" name="Entrate" radius={[4, 4, 0, 0]} cursor="pointer" />
                  <Bar dataKey="uscite" fill="hsl(var(--destructive))" name="Uscite" radius={[4, 4, 0, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              title="Premi per Agenzia"
              isLoading={premiCompagniaQ.isLoading}
              isError={premiCompagniaQ.isError}
              error={premiCompagniaQ.error}
              isEmpty={premiCompagnia.length === 0}
              onRetry={() => premiCompagniaQ.refetch()}
            >
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={premiCompagnia}
                    dataKey="totale"
                    nameKey="agenzia"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    label={({ compagnia, percent }) => `${compagnia} ${(percent * 100).toFixed(0)}%`}
                    onClick={(d: any) => openDrill({ domain: "titoli", title: `Compagnia — ${d.compagnia}`, extra: {} })}
                    cursor="pointer"
                  >
                    {premiCompagnia.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={tooltipFormatter} />
                </PieChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              title="Premi per Ramo (Top 15)"
              isLoading={premiRamoQ.isLoading}
              isError={premiRamoQ.isError}
              error={premiRamoQ.error}
              isEmpty={premiRamo.length === 0}
              onRetry={() => premiRamoQ.refetch()}
              height={400}
            >
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={premiRamo}
                  layout="vertical"
                  margin={{ left: 120 }}
                  onClick={(e: any) => {
                    const r = e?.activeLabel;
                    if (r) openDrill({ domain: "titoli", title: `Ramo — ${r}`, extra: { _ramo: r } });
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="ramo" type="category" className="text-xs" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Bar dataKey="totale" fill="hsl(var(--chart-2))" name="Premi Incassati" radius={[0, 4, 4, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              title="Premi per Produttore (Top 15)"
              isLoading={premiProduttoreQ.isLoading}
              isError={premiProduttoreQ.isError}
              error={premiProduttoreQ.error}
              isEmpty={premiProduttore.length === 0}
              onRetry={() => premiProduttoreQ.refetch()}
              height={400}
            >
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={premiProduttore} layout="vertical" margin={{ left: 130 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="produttore" type="category" className="text-xs" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Bar dataKey="totale" fill="hsl(var(--chart-3))" name="Premi Incassati" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              title="Redditività per Ufficio"
              isLoading={redditUfficioQ.isLoading}
              isError={redditUfficioQ.isError}
              error={redditUfficioQ.error}
              isEmpty={redditUfficio.length === 0}
              onRetry={() => redditUfficioQ.refetch()}
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={redditUfficio}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="ufficio" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                  <Bar dataKey="entrate" fill="hsl(var(--primary))" name="Entrate" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="uscite" fill="hsl(var(--destructive))" name="Uscite" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="margine" fill="hsl(var(--chart-3))" name="Margine" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              title="Andamento Provvigioni (Mensile)"
              isLoading={provvMensiliQ.isLoading}
              isError={provvMensiliQ.isError}
              error={provvMensiliQ.error}
              isEmpty={provvMensili.length === 0}
              onRetry={() => provvMensiliQ.refetch()}
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={provvMensili}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mese" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                  <Line type="monotone" dataKey="totale" stroke="hsl(var(--primary))" name="Totale" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pagate" stroke="hsl(var(--chart-3))" name="Pagate" dot={false} />
                  <Line type="monotone" dataKey="non_pagate" stroke="hsl(var(--destructive))" name="Non Pagate" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CfoChartCard>
          </div>
        </TabsContent>

        {/* ANALISI AVANZATE */}
        <TabsContent value="avanzate" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CfoChartCard
              className="lg:col-span-2"
              title="Trend Mensile: Premi vs Provvigioni vs Margine"
              subtitle="Clicca su un punto per vedere i titoli del mese"
              isLoading={trendMensileQ.isLoading}
              isError={trendMensileQ.isError}
              error={trendMensileQ.error}
              isEmpty={trendMensile.length === 0}
              onRetry={() => trendMensileQ.refetch()}
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={trendMensile}
                  onClick={(e: any) => {
                    const m = e?.activeLabel;
                    if (m) openDrill({ domain: "titoli", title: `Titoli — ${m}`, extra: { _mese: m } });
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mese" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                  <Line type="monotone" dataKey="premi" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, cursor: "pointer" }} />
                  <Line type="monotone" dataKey="provvigioni" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="margine" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              title="Confronto Anno Corrente vs Precedente"
              isLoading={yoyMensileQ.isLoading}
              isError={yoyMensileQ.isError}
              error={yoyMensileQ.error}
              isEmpty={yoyMensile.length === 0}
              onRetry={() => yoyMensileQ.refetch()}
              height={300}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yoyMensile}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mese" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                  <Bar dataKey="anno_corrente" fill="hsl(var(--primary))" name="Anno corrente" radius={[4,4,0,0]} />
                  <Bar dataKey="anno_precedente" fill="hsl(var(--chart-4))" name="Anno precedente" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              title="Distribuzione Polizze per Stato"
              subtitle="Clicca uno spicchio per dettaglio"
              isLoading={distrStatiQ.isLoading}
              isError={distrStatiQ.isError}
              error={distrStatiQ.error}
              isEmpty={distrStati.length === 0}
              onRetry={() => distrStatiQ.refetch()}
              height={300}
            >
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distrStati}
                    dataKey="num"
                    nameKey="stato"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ stato, percent }) => `${stato} ${(percent*100).toFixed(0)}%`}
                    onClick={(d: any) => openDrill({ domain: "titoli", title: `Stato — ${d.stato}`, extra: { _stato: d.stato } })}
                    cursor="pointer"
                  >
                    {distrStati.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              className="lg:col-span-2"
              title="Top 20 Clienti per Premi Incassati"
              subtitle="Clicca su una barra per vedere i titoli del cliente"
              isLoading={topClientiQ.isLoading}
              isError={topClientiQ.isError}
              error={topClientiQ.error}
              isEmpty={topClienti.length === 0}
              onRetry={() => topClientiQ.refetch()}
              height={500}
            >
              <ResponsiveContainer width="100%" height={500}>
                <BarChart
                  data={topClienti}
                  layout="vertical"
                  margin={{ left: 180 }}
                  onClick={(e: any) => {
                    const idx = e?.activeTooltipIndex;
                    const row = idx != null ? topClienti[idx] : null;
                    if (row?.cliente_id) {
                      openDrill({ domain: "titoli", title: `Cliente — ${row.cliente}`, extra: { _cliente_id: row.cliente_id } });
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="cliente" type="category" className="text-xs" width={170} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                  <Bar dataKey="premi" fill="hsl(var(--primary))" name="Premi" radius={[0,4,4,0]} cursor="pointer" />
                  <Bar dataKey="margine" fill="hsl(var(--chart-2))" name="Margine" radius={[0,4,4,0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              title="Clienti per Fascia di Premio"
              isLoading={distrFasciaQ.isLoading}
              isError={distrFasciaQ.isError}
              error={distrFasciaQ.error}
              isEmpty={distrFascia.length === 0}
              onRetry={() => distrFasciaQ.refetch()}
              height={300}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={distrFascia}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="fascia" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="clienti" fill="hsl(var(--chart-3))" name="N. Clienti" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              title="Premio Medio per Ramo"
              subtitle="Clicca per dettaglio ramo"
              isLoading={premioMedioRamoQ.isLoading}
              isError={premioMedioRamoQ.isError}
              error={premioMedioRamoQ.error}
              isEmpty={premioMedioRamo.length === 0}
              onRetry={() => premioMedioRamoQ.refetch()}
              height={350}
            >
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={premioMedioRamo}
                  layout="vertical"
                  margin={{ left: 130 }}
                  onClick={(e: any) => {
                    const r = e?.activeLabel;
                    if (r) openDrill({ domain: "titoli", title: `Ramo — ${r}`, extra: { _ramo: r } });
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="ramo" type="category" className="text-xs" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Bar dataKey="premio_medio" fill="hsl(var(--chart-4))" name="Premio medio" radius={[0,4,4,0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              title="Premio Medio per Agenzia"
              isLoading={premioMedioCompQ.isLoading}
              isError={premioMedioCompQ.isError}
              error={premioMedioCompQ.error}
              isEmpty={premioMedioComp.length === 0}
              onRetry={() => premioMedioCompQ.refetch()}
              height={350}
            >
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={premioMedioComp} layout="vertical" margin={{ left: 130 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="agenzia" type="category" className="text-xs" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Bar dataKey="premio_medio" fill="hsl(var(--chart-5))" name="Premio medio" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              className="lg:col-span-2"
              title="Mix Ramo × Produttore (Treemap)"
              isLoading={matriceProdRamoQ.isLoading}
              isError={matriceProdRamoQ.isError}
              error={matriceProdRamoQ.error}
              isEmpty={treemapData.length === 0}
              onRetry={() => matriceProdRamoQ.refetch()}
              height={400}
            >
              <ResponsiveContainer width="100%" height={400}>
                <Treemap data={treemapData} dataKey="size" stroke="hsl(var(--background))" fill="hsl(var(--primary))" />
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              title="Loss Ratio per Ramo (%)"
              subtitle="Clicca per dettaglio sinistri"
              isLoading={lossRatioQ.isLoading}
              isError={lossRatioQ.isError}
              error={lossRatioQ.error}
              isEmpty={lossRatio.length === 0}
              onRetry={() => lossRatioQ.refetch()}
              height={350}
            >
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={lossRatio}
                  layout="vertical"
                  margin={{ left: 130 }}
                  onClick={(e: any) => {
                    const r = e?.activeLabel;
                    if (r) openDrill({ domain: "sinistri", title: `Sinistri — Ramo ${r}`, extra: { _ramo: r } });
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="ramo" type="category" className="text-xs" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="loss_ratio_pct" fill="hsl(var(--destructive))" name="Loss Ratio %" radius={[0,4,4,0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              title="Età Sinistri Aperti"
              isLoading={etaSinistriQ.isLoading}
              isError={etaSinistriQ.isError}
              error={etaSinistriQ.error}
              isEmpty={etaSinistri.length === 0}
              onRetry={() => etaSinistriQ.refetch()}
              height={300}
            >
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={etaSinistri} dataKey="num" nameKey="fascia" cx="50%" cy="50%" outerRadius={100} label={({ fascia, num }) => `${fascia}: ${num}`}>
                    {etaSinistri.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              className="lg:col-span-2"
              title="Sinistri per Agenzia"
              isLoading={sinistriCompagniaQ.isLoading}
              isError={sinistriCompagniaQ.isError}
              error={sinistriCompagniaQ.error}
              isEmpty={sinistriCompagnia.length === 0}
              onRetry={() => sinistriCompagniaQ.refetch()}
              height={350}
            >
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={sinistriCompagnia}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="agenzia" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="num_sinistri" fill="hsl(var(--chart-3))" name="N. Sinistri" radius={[4,4,0,0]} />
                  <Bar yAxisId="right" dataKey="liquidato" fill="hsl(var(--destructive))" name="Liquidato €" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CfoChartCard>

            <CfoChartCard
              className="lg:col-span-2"
              title="Top Combinazioni Sede × Agenzia"
              subtitle="Clicca una riga per vedere i titoli"
              isLoading={matriceSedeCompQ.isLoading}
              isError={matriceSedeCompQ.isError}
              error={matriceSedeCompQ.error}
              isEmpty={matriceSedeComp.length === 0}
              onRetry={() => matriceSedeCompQ.refetch()}
              height={400}
            >
              <div className="max-h-[400px] overflow-y-auto -mx-6">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Sede</TableHead>
                      <TableHead>Agenzia</TableHead>
                      <TableHead className="text-right">Premi €</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matriceSedeComp.slice(0, 30).map((r: any, i: number) => (
                      <TableRow
                        key={i}
                        className={`cursor-pointer ${i % 2 ? "bg-muted/20" : ""}`}
                        onClick={() => openDrill({ domain: "titoli", title: `${r.sede} × ${r.compagnia}`, extra: {} })}
                      >
                        <TableCell className="font-medium">{r.sede}</TableCell>
                        <TableCell>{r.compagnia}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(r.totale)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CfoChartCard>
          </div>
        </TabsContent>


        {/* AI ANALISTA */}
        <TabsContent value="ai" className="mt-4">
          <CfoAiChat filters={filterParams} />
        </TabsContent>

        {/* REPORT */}
        <TabsContent value="report" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Genera Report Titoli</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <Button onClick={generateReport} disabled={reportLoading}>
                  {reportLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                  {reportLoading ? "Generando..." : "Genera Report"}
                </Button>
                {reportData && reportData.length > 0 && (
                  <Button variant="outline" onClick={exportCSV}>
                    <Download className="w-4 h-4 mr-2" />Esporta CSV
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Usa i filtri globali in alto per filtrare il report</p>
              </div>

              {reportData && (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>N. Titolo</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Agenzia</TableHead>
                        <TableHead>Ramo</TableHead>
                        <TableHead>Sede</TableHead>
                        <TableHead>Produttore</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Premio €</TableHead>
                        <TableHead>Incassato €</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((r: any, i: number) => (
                        <TableRow key={i} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{r.numero_titolo || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={r.stato === "incassato" ? "default" : "secondary"} className="text-xs">
                              {r.stato}
                            </Badge>
                          </TableCell>
                          <TableCell>{r.compagnia || "—"}</TableCell>
                          <TableCell>{r.ramo || "—"}</TableCell>
                          <TableCell>{r.ufficio || "—"}</TableCell>
                          <TableCell>{r.produttore || "—"}</TableCell>
                          <TableCell>{r.cliente || "—"}</TableCell>
                          <TableCell className="font-mono text-right">{r.premio_lordo?.toFixed(2) ?? "—"}</TableCell>
                          <TableCell className="font-mono text-right">{r.importo_incassato?.toFixed(2) ?? "—"}</TableCell>
                          <TableCell>{r.data_incasso || "—"}</TableCell>
                        </TableRow>
                      ))}
                      {reportData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nessun risultato</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAGAMENTI PROVVIGIONI */}
        <TabsContent value="pagamenti" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Provvigioni Non Pagate per Utente</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Utente</TableHead>
                      <TableHead>N. Provvigioni</TableHead>
                      <TableHead>Totale Non Pagato €</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {provvNonPagate.map((p: any) => (
                      <TableRow key={p.user_id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{p.nome} {p.cognome}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{p.num_provvigioni}</Badge>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-destructive">{fmt(p.totale_non_pagato)}</TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => pagaMutation.mutate(p.user_id)} disabled={pagaMutation.isPending}>
                            <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                            Segna come pagate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {provvNonPagate.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nessuna provvigione da pagare</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CfoDrillDownDialog state={drill} onClose={closeDrill} baseFilters={filterParams} />
    </div>
  );
};

export default AreaCFO;
