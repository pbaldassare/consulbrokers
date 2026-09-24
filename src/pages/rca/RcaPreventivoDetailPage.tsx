import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RcaPageHeader } from "@/components/rca/RcaPageChrome";
import { labelGaranziaAssicurapp } from "@/lib/rca/garanzie";
import {
  INSURANCE_TYPES,
  prodottoLabel,
  statoPreventivoLabel,
  type RcaPreventivoRow,
} from "@/lib/rca/preventivi";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value || "—"}</dd>
    </div>
  );
}

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

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <p className="text-muted-foreground">Caricamento…</p>
      </div>
    );
  }
  if (error || !row) {
    return (
      <div className="mx-auto max-w-6xl space-y-3">
        <p className="text-destructive">Preventivo non trovato.</p>
        <Button variant="outline" onClick={() => navigate("/rca/preventivi")}>
          Torna ai preventivi
        </Button>
      </div>
    );
  }

  const client = row.client_snapshot as Record<string, any>;
  const vehicle = row.vehicle_snapshot as Record<string, any>;
  const quote = row.quote_snapshot as Record<string, any>;
  const offerte = Array.isArray(row.offerte_snapshot) ? row.offerte_snapshot : [];
  const tipoLabel = INSURANCE_TYPES.find((t) => t.value === row.insurance_type)?.label || row.insurance_type;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <RcaPageHeader
        title={`Preventivo ${row.targa}`}
        subtitle={`${client.display_name || "—"} · ${prodottoLabel(row.prodotto_code)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/rca/preventivi")}>
              Lista
            </Button>
            {row.titolo_id && (
              <Button variant="outline" onClick={() => navigate(`/titoli/${row.titolo_id}`)}>
                Apri polizza
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{statoPreventivoLabel(row.stato)}</Badge>
        <Badge variant="outline">{tipoLabel}</Badge>
        {row.quote_uid && <Badge variant="outline">UID {row.quote_uid}</Badge>}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoRow label="Nominativo" value={client.display_name || "—"} />
            <InfoRow label="CF / P.IVA" value={client.cf || "—"} />
            <InfoRow label="Telefono" value={client.phone || "—"} />
            <InfoRow label="Email" value={client.email || "—"} />
            <InfoRow label="Indirizzo" value={client.address?.full_address || "—"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Veicolo e richieste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoRow
              label="Veicolo"
              value={[vehicle.plate || row.targa, vehicle.brand, vehicle.model].filter(Boolean).join(" · ")}
            />
            <InfoRow
              label="Guida"
              value={`${row.driving_type} · ${row.fractionation === 2 ? "Semestrale" : "Annuale"}`}
            />
            <InfoRow label="Compagnia" value={quote.insurance?.current_insurance_provider || "—"} />
            <InfoRow label="Scadenza" value={quote.insurance?.insurance_expire || "—"} />
            <InfoRow
              label="Garanzie"
              value={(row.garanzie_richieste || []).map(labelGaranziaAssicurapp).join(", ") || "nessuna accessoria"}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Offerte compagnie</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Le quotazioni non partono ancora: il passo Assicurapp lo colleghiamo dopo. I dati di questa scheda
            sono già pronti per quella chiamata.
          </p>
        </CardHeader>
        <CardContent className="p-0">
            <Table className="w-full min-w-0 table-fixed" containerClassName="overflow-x-hidden">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[36%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3">Compagnia</TableHead>
                  <TableHead className="px-3">Stato</TableHead>
                  <TableHead className="px-3">Premio rata</TableHead>
                  <TableHead className="px-3">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offerte.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                      Nessuna offerta. Quando collegheremo l’API compariranno qui.
                    </TableCell>
                  </TableRow>
                ) : (
                  offerte.map((o: any, i: number) => (
                    <TableRow key={o.id || i}>
                      <TableCell className="px-3 py-2.5">{o.label || o.company_slug || "—"}</TableCell>
                      <TableCell className="px-3 py-2.5">{o.status || "—"}</TableCell>
                      <TableCell className="px-3 py-2.5">
                        {o.prices?.total_gross != null ? `€ ${o.prices.total_gross}` : "—"}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-muted-foreground">{o.notes || "—"}</TableCell>
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
