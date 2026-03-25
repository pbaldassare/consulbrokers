import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ClienteDocumenti = () => {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("documenti")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setDocs(data ?? []);
        setLoading(false);
      });
  }, []);

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from(doc.bucket_name).createSignedUrl(doc.path_storage, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">I tuoi Documenti</h1>
      {docs.length === 0 ? (
        <p className="text-muted-foreground">Nessun documento disponibile.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{d.nome_file}</p>
                    <p className="text-xs text-muted-foreground">{d.categoria ?? d.entita_tipo} · {d.created_at?.slice(0, 10)}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDownload(d)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClienteDocumenti;
