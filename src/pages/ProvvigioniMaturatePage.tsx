import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, CreditCard, ArrowRight, Briefcase, Receipt } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { fmtEuro } from "@/lib/formatCurrency";
import { usePagination } from "@/hooks/usePagination";
import { ProvvigioniKpiCard } from "@/components/provvigioni/ProvvigioniKpiCard";
import { ProvvigioniFiltersBar, defaultFilters, ProvvigioniFilters } from "@/components/provvigioni/ProvvigioniFiltersBar";
import { ProvvigioniBarChart, ProvvigioniLineChart, ProvvigioniPieChart } from "@/components/provvigioni/ProvvigioniCharts";
import { KpiCardSkeleton, ChartSkeleton, TableRowsSkeleton } from "@/components/provvigioni/ProvvigioniSkeletons";
import { useProduttoriLookup } from "@/hooks/useProduttoriLookup";

const tipoBadge = (tipo: string | null) => {
  switch (tipo) {
    case "commerciale": return <Badge className="bg-blue-100 text-blue-800 border-blue-300" variant="outline">Produttore</Badge>;
    case "ae": return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300" variant="outline">Account Executive</Badge>;
    case "admin": return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300" variant="outline">Consulbrokers SPA</Badge>;
    case "sede": return <Badge className="bg-purple-100 text-purple-800 border-purple-300" variant="outline">Sede</Badge>;
    case "consul": return <Badge className="bg-amber-100 text-amber-800 border-amber-300" variant="outline">Consul (legacy)</Badge>;
    default: return <Badge variant="outline">—</Badge>;
  }
};


// PAGE_SIZE gestita da usePagination (default 25)

const ProvvigioniMaturatePage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ProvvigioniFilters>(defaultFilters());
  

  // Lookups
  const { data: rami = [], isLoading: lkRami } = useQuery({
    queryKey: ["lookup-rami"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione").order("codice");
      return (data || []).map((r) => ({ value: r.id, label: `${r.codice} - ${r.descrizione}` }));
    },
  });
  const { data: produttori = [], isLoading: lkProd } = useProduttoriLookup();
  

  const { data: provvigioni = [], isLoading } = useQuery({
    queryKey: ["provvigioni-maturate", filters],
    queryFn: async () => {
      let q = supabase
        .from("provvigioni_generate")
        .select(`
          id, percentuale, importo_provvigione, calcolata_il, pagata, tipo_destinatario, solo_statistico, user_id,
          titoli!inner(
            id, numero_titolo, premio_lordo, data_messa_cassa, stato, produttore_nome, ramo_id, compagnia_id, cliente_id, anagrafica_commerciale_id,
            compagnie!titoli_compagnia_id_fkey(nome),
            rami!titoli_ramo_id_fkey(codice, descrizione),
            clienti:clienti!titoli_cliente_id_fkey(id, nome, cognome, ragione_sociale),
            anagrafica_commerciale:anagrafiche_professionali!titoli_anagrafica_commerciale_id_fkey(id, nome, cognome, ragione_sociale)
          ),
          profiles!provvigioni_generate_user_id_fkey(nome, cognome)
        `)
        .eq("solo_statistico", false)
        .gte("titoli.data_messa_cassa", filters.da)
        .lte("titoli.data_messa_cassa", filters.a);
      if (filters.ramoId) q = q.eq("titoli.ramo_id", filters.ramoId);
      if (filters.produttoreId) q = q.eq("titoli.anagrafica_commerciale_id", filters.produttoreId);
      if (filters.tipoDestinatario) q = q.eq("tipo_destinatario", filters.tipoDestinatario);
      const { data } = await q.order("calcolata_il", { ascending: false }).limit(1000);
      return data || [];
    },
  });

  // Trend 12 mesi (independent)
  const { data: trend12 = [] } = useQuery({
    queryKey: ["provvigioni-maturate-trend", filters.produttoreId, filters.ramoId, filters.tipoDestinatario],
    queryFn: async () => {
      const da = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
      let q = supabase
        .from("provvigioni_generate")
        .select("importo_provvigione, titoli!inner(data_messa_cassa, ramo_id, anagrafica_commerciale_id), tipo_destinatario, user_id")
        .eq("solo_statistico", false)
        .gte("titoli.data_messa_cassa", da);
      if (filters.ramoId) q = q.eq("titoli.ramo_id", filters.ramoId);
      if (filters.produttoreId) q = q.eq("titoli.anagrafica_commerciale_id", filters.produttoreId);
      if (filters.tipoDestinatario) q = q.eq("tipo_destinatario", filters.tipoDestinatario);
      const { data } = await q.limit(5000);
      const buckets = new Map<string, number>();
      for (const p of (data as any[]) || []) {
        const d = p.titoli?.data_messa_cassa;
        if (!d) continue;
        const k = d.slice(0, 7);
        buckets.set(k, (buckets.get(k) || 0) + (p.importo_provvigione || 0));
      }
      return [...buckets.entries()].sort().map(([mese, value]) => ({
        mese: format(new Date(mese + "-01"), "MMM yy", { locale: it }),
        value,
      }));
    },
  });

  const filtered = useMemo(() => {
    if (!filters.search.trim()) return provvigioni;
    const s = filters.search.toLowerCase();
    return provvigioni.filter((p: any) => {
      const cli = (p.titoli?.clienti?.ragione_sociale || `${p.titoli?.clienti?.cognome || ""} ${p.titoli?.clienti?.nome || ""}`).toLowerCase();
      return (p.titoli?.numero_titolo || "").toLowerCase().includes(s) || cli.includes(s);
    });
  }, [provvigioni, filters.search]);

  const totals = useMemo(() => {
    const t = filtered.reduce((acc: any, p: any) => {
      acc.maturato += p.importo_provvigione || 0;
      acc.premio += p.titoli?.premio_lordo || 0;
      if (p.profiles) acc.dest.add(`${p.profiles.cognome || ""} ${p.profiles.nome || ""}`.trim());
      else if (p.titoli?.produttore_nome) acc.dest.add(p.titoli.produttore_nome);
      return acc;
    }, { maturato: 0, premio: 0, dest: new Set<string>() });
    return { maturato: t.maturato, premio: t.premio, destinatari: t.dest.size, count: filtered.length, medio: filtered.length ? t.maturato / filtered.length : 0 };
  }, [filtered]);

  const aggBy = (keyFn: (p: any) => string | null, labelFn: (p: any) => string) => {
    const m = new Map<string, { name: string; value: number }>();
    for (const p of filtered) {
      const k = keyFn(p);
      if (!k) continue;
      const cur = m.get(k) || { name: labelFn(p), value: 0 };
      cur.value += p.importo_provvigione || 0;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  };

  const labelAnag = (a: any) =>
    (a?.ragione_sociale && a.ragione_sociale.trim()) ||
    `${a?.cognome || ""} ${a?.nome || ""}`.trim();
  const byProduttore = useMemo(() => aggBy(
    (p) => p.titoli?.anagrafica_commerciale_id || (p.titoli?.produttore_nome ? `n:${p.titoli.produttore_nome}` : null),
    (p) => labelAnag(p.titoli?.anagrafica_commerciale) || (p.titoli?.produttore_nome || "—"),
  ), [filtered]);
  const byRamo = useMemo(() => aggBy((p) => p.titoli?.ramo_id, (p) => p.titoli?.rami?.descrizione || "—"), [filtered]);
  const byTipo = useMemo(() => aggBy((p) => p.tipo_destinatario, (p) => {
    const map: any = { admin: "Consulbrokers SPA", commerciale: "Produttore", ae: "Account Executive", sede: "Sede", consul: "Consul (legacy)" };
    return map[p.tipo_destinatario] || p.tipo_destinatario || "—";
  }), [filtered]);


  const { page, setPage, pages, pageRows, resetPage } = usePagination(filtered);

  const labelDa = format(new Date(filters.da), "dd/MM/yyyy");
  const labelA = format(new Date(filters.a), "dd/MM/yyyy");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Provvigioni Maturate</h1>
          <p className="text-sm text-muted-foreground">Provvigioni dei produttori · {labelDa} → {labelA}</p>
        </div>
        <Button onClick={() => navigate("/pagamenti-provvigioni")}>
          <ArrowRight className="mr-2 h-4 w-4" /> Pagamenti
        </Button>
      </div>

      <ProvvigioniFiltersBar
        filters={filters}
        onChange={(f) => { setFilters(f); resetPage(); }}
        rami={rami} produttori={produttori} showTipo
        loadingRami={lkRami} loadingProduttori={lkProd}
      />

      {isLoading ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartSkeleton /><ChartSkeleton /><ChartSkeleton /><ChartSkeleton />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <ProvvigioniKpiCard icon={TrendingUp} label="Totale Maturato" value={fmtEuro(totals.maturato)} accent="primary" />
            <ProvvigioniKpiCard icon={CreditCard} label="N. Provvigioni" value={String(totals.count)} />
            <ProvvigioniKpiCard icon={Users} label="Destinatari" value={String(totals.destinatari)} />
            <ProvvigioniKpiCard icon={Briefcase} label="Premio Incassato" value={fmtEuro(totals.premio)} />
            <ProvvigioniKpiCard icon={Receipt} label="Importo medio" value={fmtEuro(totals.medio)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ProvvigioniBarChart title="Top Produttori" data={byProduttore.slice(0, 10)} />
            <ProvvigioniBarChart title="Per Ramo" data={byRamo.slice(0, 10)} />
            <ProvvigioniPieChart title="Per Tipo Destinatario" data={byTipo} />
            <ProvvigioniLineChart title="Trend ultimi 12 mesi" data={trend12} />
          </div>
        </>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Polizza</TableHead>
                <TableHead>Compagnia</TableHead>
                <TableHead>Ramo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Premio</TableHead>
                <TableHead>Messa a cassa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Destinatario</TableHead>
                <TableHead className="text-right">Provvigione</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="p-0"><TableRowsSkeleton rows={8} cellTypes={["short","text","text","text","num","short","badge","text","num","badge"]} /></TableCell></TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nessuna provvigione per i filtri selezionati</TableCell></TableRow>
              ) : (
                pageRows.map((p: any, i: number) => {
                  const cli = p.titoli?.clienti?.ragione_sociale || `${p.titoli?.clienti?.cognome || ""} ${p.titoli?.clienti?.nome || ""}`.trim();
                  return (
                    <TableRow key={p.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                      <TableCell className="font-medium">{p.titoli?.numero_titolo || "—"}</TableCell>
                      <TableCell>{p.titoli?.compagnie?.nome || "—"}</TableCell>
                      <TableCell>{p.titoli?.rami?.descrizione || "—"}</TableCell>
                      <TableCell className="text-xs">{cli || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-sans">{fmtEuro(p.titoli?.premio_lordo)}</TableCell>
                      <TableCell>{p.titoli?.data_messa_cassa ? format(new Date(p.titoli.data_messa_cassa), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>{tipoBadge(p.tipo_destinatario)}</TableCell>
                      <TableCell>{p.profiles ? `${p.profiles.cognome || ""} ${p.profiles.nome || ""}`.trim() : (p.titoli?.produttore_nome || "—")}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold font-sans">{fmtEuro(p.importo_provvigione)}</TableCell>
                      <TableCell>
                        {p.pagata ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">Pagata</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Da pagare</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {pages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <span className="text-xs text-muted-foreground">Pagina {page + 1} di {pages} · {filtered.length} righe</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prec</Button>
                <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Succ</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProvvigioniMaturatePage;
