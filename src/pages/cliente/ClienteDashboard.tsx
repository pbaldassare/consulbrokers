import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CalendarClock, Bell, FileText, AlertTriangle, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { fmtEuro0 as fmt } from "@/lib/formatCurrency";
import InfoHint from "@/components/cliente/InfoHint";

const COLORS = ["#0d9488", "#f59e0b", "#6366f1", "#ef4444", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"];
const COLORS_OPEN = ["#3b82f6", "#f97316", "#a855f7", "#ef4444", "#14b8a6", "#eab308"];
const COLORS_CLOSED = ["#93c5fd", "#fdba74", "#d8b4fe", "#fca5a5", "#5eead4", "#fde047"];

const ClienteDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [polizze, setPolizze] = useState<any[]>([]);
  const [sinistri, setSinistri] = useState<any[]>([]);
  const [notifiche, setNotifiche] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) { setLoading(false); return; }

      const ids = clienteIds.map((c: any) => c);

      const [polRes, cgaRes, sinRes, notRes] = await Promise.all([
        supabase.from("titoli").select("id, numero_titolo, stato, premio_lordo, data_scadenza, durata_da, compagnia_id, ramo_id, descrizione_polizza, compagnie(nome), rami(descrizione)").in("cliente_anagrafica_id", ids),
        supabase.from("polizza_cga").select("id, numero_polizza, stato, premio_lordo_totale, data_scadenza, data_decorrenza, prodotti_cga(nome_prodotto, compagnia, ramo)").in("cliente_id", ids).eq("stato", "approvato"),
        supabase.from("sinistri").select("id, numero_sinistro, stato, tipo_sinistro, importo_riserva, importo_liquidato, data_evento, data_apertura, ramo_sinistro, titoli(numero_titolo)").in("cliente_anagrafica_id", ids).order("data_apertura", { ascending: false }),
        supabase.from("notifiche").select("id", { count: "exact" }).eq("letto", false),
      ]);

      const cgaMapped = (cgaRes.data ?? []).map((c: any) => ({
        id: c.id,
        _source: "cga" as const,
        _detailPath: `/cliente/assistente?polizza=${c.id}`,
        numero_titolo: c.numero_polizza,
        stato: "attivo",
        premio_lordo: c.premio_lordo_totale || 0,
        data_scadenza: c.data_scadenza,
        durata_da: c.data_decorrenza,
        descrizione_polizza: c.prodotti_cga?.nome_prodotto,
        compagnie: { nome: c.prodotti_cga?.compagnia || "—" },
        rami: { descrizione: c.prodotti_cga?.ramo || "Altro" },
      }));

      const titoliMapped = (polRes.data ?? []).map((t: any) => ({
        ...t,
        _source: "titoli" as const,
        _detailPath: `/cliente/polizze/${t.id}#scadenziario`,
      }));

      setPolizze([...titoliMapped, ...cgaMapped]);

      setSinistri(sinRes.data ?? []);
      setNotifiche(notRes.count ?? 0);
      setLoading(false);
    };
    load();
  }, [user]);

  const attive = polizze.filter(p => p.stato === "attivo");
  const premiTotali = attive.reduce((s, p) => s + (p.premio_lordo || 0), 0);
  const sinAperti = sinistri.filter(s => !["chiuso", "respinto"].includes(s.stato)).length;
  const today = new Date();
  const prossimeScadenze = attive.filter(p => p.data_scadenza && differenceInDays(new Date(p.data_scadenza), today) <= 90 && differenceInDays(new Date(p.data_scadenza), today) >= 0).length;

  // Charts data
  const premiPerRamo = attive.reduce((acc: any[], p) => {
    const name = p.rami?.descrizione || "Altro";
    const existing = acc.find(a => a.name === name);
    if (existing) existing.value += (p.premio_lordo || 0);
    else acc.push({ name, value: p.premio_lordo || 0 });
    return acc;
  }, []);

  const premiPerCompagnia = attive.reduce((acc: any[], p) => {
    const name = p.compagnie?.nome || "Altro";
    const existing = acc.find(a => a.name === name);
    if (existing) existing.value += (p.premio_lordo || 0);
    else acc.push({ name, value: p.premio_lordo || 0 });
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  // Sinistri per Ramo (aperti vs chiusi) - pie chart data
  const sinPerRamo = sinistri.reduce((acc: any[], s: any) => {
    const ramo = s.ramo_sinistro || "Altro";
    const isOpen = !["chiuso", "respinto"].includes(s.stato);
    const key = `${ramo} (${isOpen ? "Aperti" : "Chiusi"})`;
    const existing = acc.find(a => a.name === key);
    if (existing) existing.value++;
    else acc.push({ name: key, value: 1, ramo, isOpen });
    return acc;
  }, []);

  // Rapporto Premi/Sinistri per Anno
  const anniPremi: Record<string, { premi: number; sinistri: number }> = {};
  polizze.forEach(p => {
    const anno = p.durata_da ? new Date(p.durata_da).getFullYear().toString() : null;
    if (anno) {
      if (!anniPremi[anno]) anniPremi[anno] = { premi: 0, sinistri: 0 };
      anniPremi[anno].premi += (p.premio_lordo || 0);
    }
  });
  sinistri.forEach(s => {
    const anno = s.data_apertura ? new Date(s.data_apertura).getFullYear().toString() : null;
    if (anno) {
      if (!anniPremi[anno]) anniPremi[anno] = { premi: 0, sinistri: 0 };
      anniPremi[anno].sinistri += (s.importo_liquidato || s.importo_riserva || 0);
    }
  });
  const barPremiSinistri = Object.entries(anniPremi)
    .map(([anno, v]) => ({ anno, premi: v.premi, sinistri: v.sinistri }))
    .sort((a, b) => a.anno.localeCompare(b.anno));

  const kpis = [
    { title: "Polizze Attive", value: attive.length, icon: Shield, color: "text-emerald-600", bg: "bg-emerald-100", link: "/cliente/polizze", hint: "Polizze in stato 'attivo' del tuo ente. Esclude polizze scadute, annullate o sospese." },
    { title: "Premi Totali", value: fmt(premiTotali), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-100", link: "/cliente/polizze", hint: "Somma dei premi lordi annui delle polizze attive (importo che l'ente paga per la copertura)." },
    { title: "Sinistri Aperti", value: sinAperti, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-100", link: "/cliente/sinistri", hint: "Sinistri non ancora chiusi o respinti: in valutazione, lavorazione, attesa documenti o liquidazione." },
    { title: "Scadenze 90gg", value: prossimeScadenze, icon: CalendarClock, color: "text-red-600", bg: "bg-red-100", link: "/cliente/scadenze", hint: "Polizze attive che scadono nei prossimi 90 giorni: pianifica i rinnovi per tempo." },
  ];

  const scadenzeVicine = attive
    .filter(p => p.data_scadenza)
    .map(p => ({ ...p, giorni: differenceInDays(new Date(p.data_scadenza), today) }))
    .filter(p => p.giorni >= 0)
    .sort((a, b) => a.giorni - b.giorni)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Benvenuto nella tua Area Clienti</h1>
        <p className="text-muted-foreground text-sm mt-1">Panoramica della tua situazione assicurativa</p>
      </div>

      {/* KPI Cards */}
      <div data-tour="cl-dash-kpi" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Link key={k.title} to={k.link}>
            <Card className="hover:shadow-lg transition-all cursor-pointer border-l-4" style={{ borderLeftColor: k.color.includes("emerald") ? "#059669" : k.color.includes("blue") ? "#2563eb" : k.color.includes("orange") ? "#ea580c" : "#dc2626" }}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      {k.title}
                      {k.hint && <InfoHint text={k.hint} size="xs" />}
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">{loading ? "…" : k.value}</p>
                  </div>
                  <div className={`h-11 w-11 rounded-full ${k.bg} flex items-center justify-center`}>
                    <k.icon className={`h-5 w-5 ${k.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts Row */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart - Premi per Ramo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ripartizione Premi per Ramo</CardTitle>
            </CardHeader>
            <CardContent>
              {premiPerRamo.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={premiPerRamo} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name.substring(0, 15)} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {premiPerRamo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Nessun dato</p>}
            </CardContent>
          </Card>

          {/* Bar Chart - Premi per Agenzia */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Premi per Agenzia</CardTitle>
            </CardHeader>
            <CardContent>
              {premiPerCompagnia.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={premiPerCompagnia} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" fill="#0d9488" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Nessun dato</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Row - Scadenze + 2 nuovi grafici sinistri */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Prossime Scadenze */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-red-500" /> Prossime Scadenze
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {scadenzeVicine.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nessuna scadenza nei prossimi 90 giorni</p>
              ) : scadenzeVicine.map(s => (
                <Link
                  key={s.id}
                  to={`/cliente/polizze/${s.id}#scadenziario`}
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded-md border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium truncate">{s.numero_titolo}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.rami?.descrizione}</p>
                    {s.compagnie?.nome && <p className="text-[11px] text-muted-foreground/80 truncate">{s.compagnie.nome}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={s.giorni <= 30 ? "bg-red-100 text-red-800" : s.giorni <= 60 ? "bg-orange-100 text-orange-800" : "bg-yellow-100 text-yellow-800"}>
                      {s.giorni} gg
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(s.data_scadenza), "dd MMM yyyy", { locale: it })}</p>
                  </div>
                </Link>
              ))}
              {scadenzeVicine.length > 0 && (
                <div className="pt-2 text-right">
                  <Link to="/cliente/scadenze" className="text-xs text-teal-700 hover:underline">Vedi tutte →</Link>
                </div>
              )}
            </CardContent>

          </Card>

          {/* Pie - Sinistri per Ramo (Aperti vs Chiusi) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" /> Sinistri per Ramo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sinPerRamo.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={sinPerRamo} cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2} dataKey="value" label={({ name, value }) => `${value}`} labelLine={false}>
                      {sinPerRamo.map((entry, i) => (
                        <Cell key={i} fill={entry.isOpen ? COLORS_OPEN[i % COLORS_OPEN.length] : COLORS_CLOSED[i % COLORS_CLOSED.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Nessun sinistro</p>}
            </CardContent>
          </Card>

          {/* Bar - Rapporto Premi/Sinistri per Anno */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-teal-600" /> Premi vs Sinistri per Anno
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barPremiSinistri.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barPremiSinistri}>
                    <XAxis dataKey="anno" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="premi" name="Premi Pagati" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sinistri" name="Sinistri Liquidati" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-12">Nessun dato</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Azioni rapide</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          
          <Link to="/cliente/chat"><Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm hover:bg-muted">💬 Scrivi all'agenzia</Badge></Link>
          <Link to="/cliente/polizze"><Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm hover:bg-muted">📋 Vedi polizze</Badge></Link>
          <Link to="/cliente/sinistri"><Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm hover:bg-muted">⚠️ Sinistri</Badge></Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteDashboard;
