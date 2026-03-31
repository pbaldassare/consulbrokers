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

const COLORS = ["#0d9488", "#f59e0b", "#6366f1", "#ef4444", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"];

const fmt = (v: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

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

      const [polRes, sinRes, notRes] = await Promise.all([
        supabase.from("titoli").select("id, numero_titolo, stato, premio_lordo, data_scadenza, durata_da, compagnia_id, ramo_id, descrizione_polizza, compagnie(nome), rami(descrizione)").in("cliente_anagrafica_id", ids),
        supabase.from("sinistri").select("id, numero_sinistro, stato, tipo_sinistro, importo_riserva, importo_liquidato, data_evento, titoli(numero_titolo)").in("cliente_anagrafica_id", ids).order("data_apertura", { ascending: false }),
        supabase.from("notifiche").select("id", { count: "exact" }).eq("letto", false),
      ]);

      setPolizze(polRes.data ?? []);
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
    const name = (p.rami as any)?.descrizione || "Altro";
    const existing = acc.find(a => a.name === name);
    if (existing) existing.value += (p.premio_lordo || 0);
    else acc.push({ name, value: p.premio_lordo || 0 });
    return acc;
  }, []);

  const premiPerCompagnia = attive.reduce((acc: any[], p) => {
    const name = (p.compagnie as any)?.nome || "Altro";
    const existing = acc.find(a => a.name === name);
    if (existing) existing.value += (p.premio_lordo || 0);
    else acc.push({ name, value: p.premio_lordo || 0 });
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  const kpis = [
    { title: "Polizze Attive", value: attive.length, icon: Shield, color: "text-emerald-600", bg: "bg-emerald-100", link: "/cliente/polizze" },
    { title: "Premi Totali", value: fmt(premiTotali), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-100", link: "/cliente/polizze" },
    { title: "Sinistri Aperti", value: sinAperti, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-100", link: "/cliente/sinistri" },
    { title: "Scadenze 90gg", value: prossimeScadenze, icon: CalendarClock, color: "text-red-600", bg: "bg-red-100", link: "/cliente/scadenze" },
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Link key={k.title} to={k.link}>
            <Card className="hover:shadow-lg transition-all cursor-pointer border-l-4" style={{ borderLeftColor: k.color.includes("emerald") ? "#059669" : k.color.includes("blue") ? "#2563eb" : k.color.includes("orange") ? "#ea580c" : "#dc2626" }}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.title}</p>
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

          {/* Bar Chart - Premi per Compagnia */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Premi per Compagnia</CardTitle>
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

      {/* Bottom Row */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Prossime Scadenze */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-red-500" /> Prossime Scadenze
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {scadenzeVicine.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nessuna scadenza nei prossimi 90 giorni</p>
              ) : scadenzeVicine.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{s.numero_titolo}</p>
                    <p className="text-xs text-muted-foreground">{(s.rami as any)?.descrizione}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={s.giorni <= 30 ? "bg-red-100 text-red-800" : s.giorni <= 60 ? "bg-orange-100 text-orange-800" : "bg-yellow-100 text-yellow-800"}>
                      {s.giorni} gg
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(s.data_scadenza), "dd MMM yyyy", { locale: it })}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Sinistri Recenti */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" /> Sinistri Recenti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sinistri.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nessun sinistro</p>
              ) : sinistri.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{s.numero_sinistro}</p>
                    <p className="text-xs text-muted-foreground">{s.titoli?.numero_titolo}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={
                      s.stato === "chiuso" ? "bg-green-100 text-green-800" :
                      s.stato === "aperto" ? "bg-blue-100 text-blue-800" :
                      "bg-orange-100 text-orange-800"
                    }>{s.stato?.replace(/_/g, " ")}</Badge>
                    {(s.importo_riserva || 0) > 0 && <p className="text-xs text-muted-foreground mt-0.5">Riserva {fmt(s.importo_riserva)}</p>}
                  </div>
                </div>
              ))}
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
          <Link to="/cliente/upload"><Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm hover:bg-muted">📤 Carica documento</Badge></Link>
          <Link to="/cliente/comunicazioni"><Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm hover:bg-muted">💬 Scrivi all'agenzia</Badge></Link>
          <Link to="/cliente/polizze"><Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm hover:bg-muted">📋 Vedi polizze</Badge></Link>
          <Link to="/cliente/sinistri"><Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm hover:bg-muted">⚠️ Sinistri</Badge></Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteDashboard;
