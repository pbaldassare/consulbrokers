import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Landmark, TrendingUp, Users, Briefcase, Receipt, Download } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { fmtEuro, fmtPct } from "@/lib/formatCurrency";
import { ProvvigioniKpiCard } from "@/components/provvigioni/ProvvigioniKpiCard";
import { ProvvigioniFiltersBar, defaultFilters, ProvvigioniFilters } from "@/components/provvigioni/ProvvigioniFiltersBar";
import { ProvvigioniBarChart, ProvvigioniLineChart, ProvvigioniPieChart } from "@/components/provvigioni/ProvvigioniCharts";
import { useNavigate } from "react-router-dom";

type Row = any;

const aggregate = <T,>(rows: Row[], keyFn: (r: Row) => string | null, labelFn: (r: Row) => string, valFn: (r: Row) => number) => {
  const map = new Map<string, { name: string; value: number }>();
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    const cur = map.get(k) || { name: labelFn(r), value: 0 };
    cur.value += valFn(r);
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
};

const exportCsv = (rows: Row[]) => {
  const headers = ["Polizza", "Compagnia", "Ramo", "Cliente", "Commerciale", "Premio", "Provv.Agenzia", "%Comm", "Provv.Comm", "Provv.Consul"];
  const csv = [headers.join(";")].concat(
    rows.map((t: any) => {
      const provvAg = t.provvigioni_firma || 0;
      const pc = t.percentuale_commerciale ?? 100;
      const comm = provvAg * pc / 100;
      const sede = provvAg * (100 - pc) / 100;
      const cli = t.clienti?.ragione_sociale || `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`.trim();
      const cm = t.commerciale ? `${t.commerciale.cognome} ${t.commerciale.nome}` : "Consul";
      return [t.numero_titolo || "", t.compagnia_diretta?.nome || "", t.ramo?.descrizione || "", cli, cm,
        (t.premio_lordo || 0).toFixed(2), provvAg.toFixed(2), pc, comm.toFixed(2), sede.toFixed(2)].join(";");
    })
  ).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `provvigioni-consul-${format(new Date(), "yyyyMMdd")}.csv`; a.click();
  URL.revokeObjectURL(url);
};

const ProvvigioniSedePage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ProvvigioniFilters>(defaultFilters());

  // Lookup options
  const { data: rami = [] } = useQuery({
    queryKey: ["lookup-rami"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione").order("codice");
      return (data || []).map((r) => ({ value: r.id, label: `${r.codice} - ${r.descrizione}` }));
    },
  });
  const { data: compagnie = [] } = useQuery({
    queryKey: ["lookup-compagnie-active"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").order("nome");
      return (data || []).map((c) => ({ value: c.id, label: c.nome }));
    },
  });
  const { data: produttori = [] } = useQuery({
    queryKey: ["lookup-produttori"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      return (data || []).map((p) => ({ value: p.id, label: `${p.cognome || ""} ${p.nome || ""}`.trim() }));
    },
  });

  // Main query - filtered titoli incassati
  const { data: titoli = [], isLoading } = useQuery({
    queryKey: ["provvigioni-consul", filters],
    queryFn: async () => {
      let q = supabase
        .from("titoli")
        .select(`
          id, numero_titolo, premio_lordo, provvigioni_firma, percentuale_commerciale, stato,
          data_messa_cassa, ramo_id, compagnia_id, commerciale_id, cliente_id,
          compagnia_diretta:compagnie!titoli_compagnia_id_fkey(nome),
          ramo:rami!titoli_ramo_id_fkey(codice, descrizione),
          commerciale:profiles!titoli_commerciale_id_fkey(nome, cognome),
          clienti:clienti!titoli_cliente_id_fkey(id, nome, cognome, ragione_sociale)
        `)
        .eq("stato", "incassato")
        .not("provvigioni_firma", "is", null)
        .gte("data_messa_cassa", filters.da)
        .lte("data_messa_cassa", filters.a);
      if (filters.ramoId) q = q.eq("ramo_id", filters.ramoId);
      if (filters.compagniaId) q = q.eq("compagnia_id", filters.compagniaId);
      if (filters.produttoreId) q = q.eq("commerciale_id", filters.produttoreId);
      if (filters.clienteId) q = q.eq("cliente_id", filters.clienteId);
      const { data } = await q.order("data_messa_cassa", { ascending: false }).limit(1000);
      return data || [];
    },
  });

  // Trend 12 mesi (separate, ignores period filter)
  const { data: trend12 = [] } = useQuery({
    queryKey: ["provvigioni-consul-trend", filters.ramoId, filters.compagniaId, filters.produttoreId],
    queryFn: async () => {
      const da = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
      let q = supabase
        .from("titoli")
        .select("data_messa_cassa, provvigioni_firma, percentuale_commerciale")
        .eq("stato", "incassato")
        .not("provvigioni_firma", "is", null)
        .gte("data_messa_cassa", da);
      if (filters.ramoId) q = q.eq("ramo_id", filters.ramoId);
      if (filters.compagniaId) q = q.eq("compagnia_id", filters.compagniaId);
      if (filters.produttoreId) q = q.eq("commerciale_id", filters.produttoreId);
      const { data } = await q.limit(5000);
      const buckets = new Map<string, number>();
      for (const t of data || []) {
        if (!t.data_messa_cassa) continue;
        const k = t.data_messa_cassa.slice(0, 7);
        const sede = (t.provvigioni_firma || 0) * (100 - (t.percentuale_commerciale ?? 100)) / 100;
        buckets.set(k, (buckets.get(k) || 0) + sede);
      }
      return [...buckets.entries()].sort().map(([mese, value]) => ({
        mese: format(new Date(mese + "-01"), "MMM yy", { locale: it }),
        value,
      }));
    },
  });

  // Search filter (cliente list also derived from current titoli so user can pick from them)
  const filteredTitoli = useMemo(() => {
    if (!filters.search.trim()) return titoli;
    const s = filters.search.toLowerCase();
    return titoli.filter((t: any) => {
      const cli = (t.clienti?.ragione_sociale || `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`).toLowerCase();
      return (t.numero_titolo || "").toLowerCase().includes(s) || cli.includes(s);
    });
  }, [titoli, filters.search]);

  const totals = useMemo(() => filteredTitoli.reduce((acc: any, t: any) => {
    const provvAg = t.provvigioni_firma || 0;
    const pc = t.percentuale_commerciale ?? 100;
    acc.agenzia += provvAg;
    acc.comm += provvAg * pc / 100;
    acc.consul += provvAg * (100 - pc) / 100;
    acc.premio += t.premio_lordo || 0;
    return acc;
  }, { agenzia: 0, comm: 0, consul: 0, premio: 0 }), [filteredTitoli]);

  const byRamo = useMemo(() => aggregate(filteredTitoli,
    (t) => t.ramo_id,
    (t) => t.ramo?.descrizione || "—",
    (t) => (t.provvigioni_firma || 0) * (100 - (t.percentuale_commerciale ?? 100)) / 100
  ), [filteredTitoli]);

  const byProduttore = useMemo(() => aggregate(filteredTitoli,
    (t) => t.commerciale_id || "__no_comm__",
    (t) => t.commerciale ? `${t.commerciale.cognome} ${t.commerciale.nome}` : "Consul (no commerciale)",
    (t) => (t.provvigioni_firma || 0) * (100 - (t.percentuale_commerciale ?? 100)) / 100
  ), [filteredTitoli]);

  const byCliente = useMemo(() => aggregate(filteredTitoli,
    (t) => t.cliente_id,
    (t) => t.clienti?.ragione_sociale || `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`.trim() || "—",
    (t) => (t.provvigioni_firma || 0) * (100 - (t.percentuale_commerciale ?? 100)) / 100
  ).slice(0, 50), [filteredTitoli]);

  const splitConsulComm = [
    { name: "Consulbrokers SPA", value: totals.consul },
    { name: "Commerciali", value: totals.comm },
  ];

  const labelDa = format(new Date(filters.da), "dd/MM/yyyy");
  const labelA = format(new Date(filters.a), "dd/MM/yyyy");

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Provvigioni Consul</h1>
          <p className="text-sm text-muted-foreground mt-1">Quota Consulbrokers SPA su titoli incassati · {labelDa} → {labelA}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportCsv(filteredTitoli)} disabled={!filteredTitoli.length}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <ProvvigioniFiltersBar filters={filters} onChange={setFilters} rami={rami} compagnie={compagnie} produttori={produttori} />

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <ProvvigioniKpiCard icon={Landmark} label="Provv. Consul" value={fmtEuro(totals.consul)} accent="primary" hint={fmtPct(totals.agenzia ? totals.consul / totals.agenzia * 100 : 0)} />
        <ProvvigioniKpiCard icon={Users} label="Provv. Commerciali" value={fmtEuro(totals.comm)} hint={fmtPct(totals.agenzia ? totals.comm / totals.agenzia * 100 : 0)} />
        <ProvvigioniKpiCard icon={TrendingUp} label="Tot. Agenzia" value={fmtEuro(totals.agenzia)} />
        <ProvvigioniKpiCard icon={Briefcase} label="Premio Incassato" value={fmtEuro(totals.premio)} />
        <ProvvigioniKpiCard icon={Receipt} label="N° Polizze" value={String(filteredTitoli.length)} />
      </div>

      {/* Tabs Distribuzione */}
      <Tabs defaultValue="ramo">
        <TabsList>
          <TabsTrigger value="ramo">Per Ramo</TabsTrigger>
          <TabsTrigger value="produttore">Per Produttore</TabsTrigger>
          <TabsTrigger value="cliente">Per Cliente</TabsTrigger>
          <TabsTrigger value="periodo">Trend 12 mesi</TabsTrigger>
        </TabsList>

        <TabsContent value="ramo" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ProvvigioniBarChart title="Provv. Consul per Ramo" data={byRamo.slice(0, 10)} />
            <ProvvigioniPieChart title="Split Consul vs Commerciali" data={splitConsulComm} />
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ramo</TableHead>
                <TableHead className="text-right">Provv. Consul</TableHead>
                <TableHead className="text-right">% sul totale</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {byRamo.map((r, i) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-primary font-sans">{fmtEuro(r.value)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmtPct(totals.consul ? r.value / totals.consul * 100 : 0)}</TableCell>
                  </TableRow>
                ))}
                {byRamo.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nessun dato</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="produttore" className="space-y-4 mt-4">
          <ProvvigioniBarChart title="Top Produttori (quota Consul su loro polizze)" data={byProduttore.slice(0, 10)} />
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Produttore</TableHead>
                <TableHead className="text-right">Provv. Consul</TableHead>
                <TableHead className="text-right">% sul totale</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {byProduttore.map((p, i) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-primary font-sans">{fmtEuro(p.value)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmtPct(totals.consul ? p.value / totals.consul * 100 : 0)}</TableCell>
                  </TableRow>
                ))}
                {byProduttore.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nessun dato</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="cliente" className="space-y-4 mt-4">
          <ProvvigioniBarChart title="Top Clienti (quota Consul)" data={byCliente.slice(0, 10)} />
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Provv. Consul</TableHead>
                <TableHead className="text-right">% sul totale</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {byCliente.map((c, i) => (
                  <TableRow key={i} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-primary font-sans">{fmtEuro(c.value)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmtPct(totals.consul ? c.value / totals.consul * 100 : 0)}</TableCell>
                  </TableRow>
                ))}
                {byCliente.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nessun dato</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="periodo" className="mt-4">
          <ProvvigioniLineChart title="Trend Provv. Consul - ultimi 12 mesi" data={trend12} />
        </TabsContent>
      </Tabs>

      {/* Dettaglio polizze */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Caricamento...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Polizza</TableHead>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Commerciale</TableHead>
                  <TableHead className="text-right">Premio</TableHead>
                  <TableHead className="text-right">Provv. Agenzia</TableHead>
                  <TableHead className="text-right">% C.</TableHead>
                  <TableHead className="text-right">Provv. Comm.</TableHead>
                  <TableHead className="text-right">Provv. Consul</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTitoli.map((t: any, i: number) => {
                  const provvAg = t.provvigioni_firma || 0;
                  const pc = t.percentuale_commerciale ?? 100;
                  const cli = t.clienti?.ragione_sociale || `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`.trim();
                  return (
                    <TableRow key={t.id} className={`cursor-pointer hover:bg-muted/50 ${i % 2 === 0 ? "bg-muted/20" : ""}`} onClick={() => navigate(`/portafoglio/${t.id}`)}>
                      <TableCell className="font-mono text-xs">{t.numero_titolo || t.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{t.compagnia_diretta?.nome || "—"}</TableCell>
                      <TableCell className="text-xs">{t.ramo?.descrizione || "—"}</TableCell>
                      <TableCell className="text-xs">{cli || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {t.commerciale ? `${t.commerciale.cognome} ${t.commerciale.nome}` : <Badge variant="secondary" className="text-[10px]">Consul</Badge>}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs">{fmtEuro(t.premio_lordo)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs">{fmtEuro(provvAg)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs">{pc}%</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs">{fmtEuro(provvAg * pc / 100)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-semibold text-primary font-sans">{fmtEuro(provvAg * (100 - pc) / 100)}</TableCell>
                    </TableRow>
                  );
                })}
                {filteredTitoli.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nessun dato per i filtri selezionati</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProvvigioniSedePage;
