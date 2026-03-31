import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Clock, AlertTriangle } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { it } from "date-fns/locale";

const ClienteScadenze = () => {
  const { user } = useAuth();
  const [polizze, setPolizze] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) { setLoading(false); return; }
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, stato, premio_lordo, data_scadenza, compagnie(nome), rami(descrizione)")
        .in("cliente_anagrafica_id", clienteIds.map((c: any) => c))
        .eq("stato", "attivo")
        .not("data_scadenza", "is", null)
        .order("data_scadenza", { ascending: true });
      setPolizze(data ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>;

  const today = new Date();
  const withDays = polizze.map(p => ({ ...p, giorni: differenceInDays(new Date(p.data_scadenza), today) })).filter(p => p.giorni >= 0);

  const entro30 = withDays.filter(p => p.giorni <= 30).length;
  const entro60 = withDays.filter(p => p.giorni <= 60).length;
  const entro90 = withDays.filter(p => p.giorni <= 90).length;

  const kpis = [
    { label: "Entro 30 gg", value: entro30, color: "text-red-600", bg: "bg-red-100", border: "#dc2626" },
    { label: "Entro 60 gg", value: entro60, color: "text-orange-600", bg: "bg-orange-100", border: "#ea580c" },
    { label: "Entro 90 gg", value: entro90, color: "text-yellow-600", bg: "bg-yellow-100", border: "#ca8a04" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
          <CalendarClock className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Scadenziario Polizze</h1>
          <p className="text-sm text-muted-foreground">{withDays.length} polizze con scadenza futura</p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {kpis.map(k => (
          <Card key={k.label} className="border-l-4" style={{ borderLeftColor: k.border }}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase">{k.label}</p>
              <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista Scadenze */}
      <div className="space-y-3">
        {withDays.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">Nessuna scadenza futura</p>
        ) : withDays.map(p => {
          const urgente = p.giorni <= 30;
          const inScadenza = p.giorni <= 60;
          const barWidth = Math.max(5, Math.min(100, 100 - (p.giorni / 365) * 100));
          const barColor = urgente ? "bg-red-500" : inScadenza ? "bg-orange-400" : "bg-yellow-400";

          return (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-foreground">{p.numero_titolo}</p>
                      {urgente && <Badge className="bg-red-100 text-red-800 text-xs">🔴 URGENTE</Badge>}
                      {!urgente && inScadenza && <Badge className="bg-orange-100 text-orange-800 text-xs">🟠 IN SCADENZA</Badge>}
                    </div>
                    <p className="text-sm text-teal-700">{(p.rami as any)?.descrizione}</p>
                    <p className="text-xs text-muted-foreground">{(p.compagnie as any)?.nome}</p>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${barWidth}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Clock className={`h-4 w-4 ${urgente ? "text-red-500" : "text-muted-foreground"}`} />
                      <span className={`text-2xl font-bold ${urgente ? "text-red-600" : inScadenza ? "text-orange-600" : "text-foreground"}`}>{p.giorni}</span>
                      <span className="text-xs text-muted-foreground">gg</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(p.data_scadenza), "dd MMM yyyy", { locale: it })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ClienteScadenze;
