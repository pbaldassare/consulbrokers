import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock } from "lucide-react";

const ClienteScadenze = () => {
  const [scadenze, setScadenze] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("titoli")
      .select("id, numero_titolo, data_scadenza, stato, prodotti(nome_prodotto)")
      .not("data_scadenza", "is", null)
      .order("data_scadenza", { ascending: true })
      .then(({ data }) => {
        setScadenze(data ?? []);
        setLoading(false);
      });
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-accent" /> Scadenziario
      </h1>
      {scadenze.length === 0 ? (
        <p className="text-muted-foreground">Nessuna scadenza registrata.</p>
      ) : (
        <div className="grid gap-3">
          {scadenze.map((s) => {
            const isExpired = s.data_scadenza < today;
            const isSoon = !isExpired && s.data_scadenza <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
            return (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-foreground">{s.numero_titolo || "N/D"}</p>
                    <p className="text-sm text-muted-foreground">{(s.prodotti as any)?.nome_prodotto ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={isExpired ? "bg-destructive text-destructive-foreground" : isSoon ? "bg-yellow-100 text-yellow-800" : "bg-muted text-muted-foreground"}>
                      {s.data_scadenza}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClienteScadenze;
