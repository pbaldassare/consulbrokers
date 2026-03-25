import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ClientePolizzaDetail = () => {
  const { id } = useParams();
  const [titolo, setTitolo] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("titoli").select("*, prodotti(nome_prodotto), compagnie:prodotti(compagnia_id)").eq("id", id).maybeSingle(),
      supabase.from("documenti").select("*").eq("entita_tipo", "titolo").eq("entita_id", id),
    ]).then(([tRes, dRes]) => {
      setTitolo(tRes.data);
      setDocs(dRes.data ?? []);
      setLoading(false);
    });
  }, [id]);

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from(doc.bucket_name).createSignedUrl(doc.path_storage, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (!titolo) return <p className="text-muted-foreground">Polizza non trovata.</p>;

  return (
    <div className="space-y-4">
      <Link to="/cliente/polizze">
        <Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" />Torna alle polizze</Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Polizza {titolo.numero_titolo}</span>
            <Badge>{titolo.stato}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Prodotto:</span> <span className="font-medium">{(titolo.prodotti as any)?.nome_prodotto ?? "—"}</span></div>
          <div><span className="text-muted-foreground">Premio lordo:</span> <span className="font-medium">€ {titolo.premio_lordo?.toFixed(2) ?? "—"}</span></div>
          <div><span className="text-muted-foreground">Data incasso:</span> <span className="font-medium">{titolo.data_incasso ?? "—"}</span></div>
          <div><span className="text-muted-foreground">Stato:</span> <span className="font-medium">{titolo.stato}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Documenti allegati</CardTitle></CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun documento disponibile.</p>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm">{d.nome_file}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(d)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientePolizzaDetail;
