import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const statoBadge: Record<string, string> = {
  attivo: "bg-green-100 text-green-800",
  scaduto: "bg-red-100 text-red-800",
  sospeso: "bg-yellow-100 text-yellow-800",
  incassato: "bg-blue-100 text-blue-800",
};

const ClientePolizze = () => {
  const [titoli, setTitoli] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("titoli")
      .select("id, numero_titolo, stato, premio_lordo, data_incasso, prodotto_id, prodotti(nome_prodotto)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTitoli(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Le tue Polizze</h1>
      {titoli.length === 0 ? (
        <p className="text-muted-foreground">Nessuna polizza trovata.</p>
      ) : (
        <div className="grid gap-3">
          {titoli.map((t) => (
            <Link key={t.id} to={`/cliente/polizze/${t.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold text-foreground">{t.numero_titolo || "N/D"}</p>
                    <p className="text-sm text-muted-foreground">{(t.prodotti as any)?.nome_prodotto ?? "—"}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge className={statoBadge[t.stato] ?? "bg-muted text-muted-foreground"}>{t.stato}</Badge>
                    <p className="text-xs text-muted-foreground">Incasso {t.data_incasso ?? "—"}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientePolizze;
