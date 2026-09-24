import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { labelGaranziaAssicurapp } from "@/lib/rca/garanzie";
import {
  INSURANCE_TYPES,
  prodottoLabel,
  statoPreventivoLabel,
  type RcaPreventivoRow,
} from "@/lib/rca/preventivi";

export default function RcaPreventivoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: row, isLoading, error } = useQuery({
    queryKey: ["rca-preventivo", id],
    enabled: !!id,
    queryFn: async (): Promise<RcaPreventivoRow> => {
      const { data, error } = await (supabase.from("rca_preventivi") as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Preventivo non trovato");
      return data as RcaPreventivoRow;
    },
  });

  if (isLoading) return <p className="p-8 text-muted-foreground">Caricamento…</p>;
  if (error || !row) {
    return (
      <div className="space-y-3 p-8">
        <p className="text-destructive">Preventivo non trovato.</p>
        <Button variant="outline" onClick={() => navigate("/rca/preventivi")}>Torna ai preventivi</Button>
      </div>
    );
  }

  const client = row.client_snapshot as Record<string, any>;
  const vehicle = row.vehicle_snapshot as Record<string, any>;
  const quote = row.quote_snapshot as Record<string, any>;
  const offerte = Array.isArray(row.offerte_snapshot) ? row.offerte_snapshot : [];
  const tipoLabel = INSURANCE_TYPES.find((t) => t.value === row.insurance_type)?.label || row.insurance_type;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Preventivo {row.targa}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {client.display_name || "—"} · {prodottoLabel(row.prodotto_code)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">{statoPreventivoLabel(row.stato)}</Badge>
            <Badge variant="outline">{tipoLabel}</Badge>
            {row.quote_uid && <Badge variant="outline">UID {row.quote_uid}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/rca/preventivi")}>Lista</Button>
          {row.titolo_id && (
            <Button variant="outline" onClick={() => navigate(`/titoli/${row.titolo_id}`)}>Apri polizza</Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{client.display_name || "—"}</p>
            <p className="text-muted-foreground">{client.cf || "—"}</p>
            <p>{client.phone || "—"} · {client.email || "—"}</p>
            <p>{client.address?.full_address || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Veicolo e richieste</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-mono">{vehicle.plate || row.targa} · {vehicle.brand} {vehicle.model}</p>
            <p>Guida {row.driving_type} · {row.fractionation === 2 ? "Semestrale" : "Annuale"}</p>
            <p>Compagnia attuale: {quote.insurance?.current_insurance_provider || "—"}</p>
            <p>Scadenza: {quote.insurance?.insurance_expire || "—"}</p>
            <p>
              Garanzie:{" "}
              {(row.garanzie_richieste || []).map(labelGaranziaAssicurapp).join(", ") || "nessuna accessoria"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Offerte compagnie</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Le quotazioni non partono ancora: il passo Assicurapp (ANIA, prodotti, save, polling) lo colleghiamo dopo.
            I dati di questa scheda sono già pronti per quella chiamata.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Compagnia</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Premio rata</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offerte.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Nessuna offerta. Quando collegheremo l’API compariranno qui, in aggiornamento finché restano in corso.
                  </TableCell>
                </TableRow>
              ) : (
                offerte.map((o: any, i: number) => (
                  <TableRow key={o.id || i}>
                    <TableCell>{o.label || o.company_slug || "—"}</TableCell>
                    <TableCell>{o.status || "—"}</TableCell>
                    <TableCell>{o.prices?.total_gross != null ? `€ ${o.prices.total_gross}` : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{o.notes || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
