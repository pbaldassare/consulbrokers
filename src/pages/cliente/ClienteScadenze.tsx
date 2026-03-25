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
      .select("id, numero_titolo, data_incasso, stato, prodotti(nome_prodotto)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setScadenze(data ?? []);
        setLoading(false);
      });
  }, []);

  

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
          {scadenze.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-foreground">{s.numero_titolo || "N/D"}</p>
                    <p className="text-sm text-muted-foreground">{(s.prodotti as any)?.nome_prodotto ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={s.stato === "attivo" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                      {s.stato}
                    </Badge>
                    {s.data_incasso && <p className="text-xs text-muted-foreground mt-1">{s.data_incasso}</p>}
                  </div>
                </CardContent>
              </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClienteScadenze;
