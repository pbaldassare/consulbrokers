import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Calendar, Building2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";

const statoBadge: Record<string, string> = {
  attivo: "bg-emerald-100 text-emerald-800 border-emerald-300",
  scaduto: "bg-red-100 text-red-800 border-red-300",
  sospeso: "bg-yellow-100 text-yellow-800 border-yellow-300",
  incassato: "bg-blue-100 text-blue-800 border-blue-300",
};

const fmt = (v: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);

const ClientePolizze = () => {
  const { user } = useAuth();
  const [titoli, setTitoli] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) { setLoading(false); return; }
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, stato, premio_lordo, data_scadenza, durata_da, periodicita, descrizione_polizza, compagnie(nome), rami(descrizione)")
        .in("cliente_anagrafica_id", clienteIds.map((c: any) => c))
        .order("created_at", { ascending: false });
      setTitoli(data ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}</div>;

  const today = new Date();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <Shield className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Le tue Polizze</h1>
          <p className="text-sm text-muted-foreground">{titoli.length} polizze trovate</p>
        </div>
      </div>

      {titoli.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nessuna polizza trovata.</p>
      ) : (
        <div className="grid gap-4">
          {titoli.map((t) => {
            const giorni = t.data_scadenza ? differenceInDays(new Date(t.data_scadenza), today) : null;
            return (
              <Link key={t.id} to={`/cliente/polizze/${t.id}`}>
                <Card className="hover:shadow-lg transition-all border-l-4 border-l-emerald-500 hover:border-l-emerald-600">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground text-base">{t.numero_titolo || "N/D"}</p>
                          <Badge className={`text-xs ${statoBadge[t.stato] ?? "bg-muted text-muted-foreground"}`}>{t.stato}</Badge>
                        </div>
                        <p className="text-sm font-medium text-teal-700">{(t.rami as any)?.descrizione ?? "—"}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{(t.compagnie as any)?.nome ?? "—"}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{t.periodicita ?? "—"}</span>
                        </div>
                      </div>
                      <div className="text-right space-y-1 shrink-0">
                        <p className="text-lg font-bold text-foreground">{t.premio_lordo ? fmt(t.premio_lordo) : "—"}</p>
                        {t.data_scadenza && (
                          <p className="text-xs text-muted-foreground">
                            Scade: {format(new Date(t.data_scadenza), "dd MMM yyyy", { locale: it })}
                          </p>
                        )}
                        {giorni !== null && giorni >= 0 && giorni <= 90 && (
                          <Badge className={giorni <= 30 ? "bg-red-100 text-red-700 text-xs" : "bg-orange-100 text-orange-700 text-xs"}>
                            {giorni} gg
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientePolizze;
