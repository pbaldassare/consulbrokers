import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, CheckCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { sanitizeStorageFileName } from "@/lib/sanitizeFileName";

const ClienteUploadDoc = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [areaType, setAreaType] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("clienti")
      .select("id, area_riservata_tipo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setClienteId(data?.id ?? null);
        setAreaType(data?.area_riservata_tipo ?? null);
      });
  }, [user]);

  if (areaType && areaType !== "completa") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" /> Accesso non disponibile
        </h1>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Il caricamento documenti non è abilitato per il tuo account.<br />
            Contatta la tua agenzia per maggiori informazioni.
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleUpload = async () => {
    if (!file || !clienteId || !user) return;
    setUploading(true);
    try {
      const path = `${clienteId}/${Date.now()}_${file.name}`;
      const { error: storageErr } = await supabase.storage
        .from("documenti_clienti")
        .upload(path, file);
      if (storageErr) throw storageErr;

      const { error: dbErr } = await supabase.from("documenti").insert({
        entita_tipo: "cliente",
        entita_id: clienteId,
        nome_file: file.name,
        path_storage: path,
        bucket_name: "documenti_clienti",
        caricato_da: user.id,
        categoria: "documento_cliente",
      });
      if (dbErr) throw dbErr;

      toast.success("Documento caricato con successo!");
      setFile(null);
    } catch (err: any) {
      toast.error(err.message || "Errore durante il caricamento");
    }
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
        <Upload className="h-5 w-5 text-primary" /> Carica Documento
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invia un documento all'agenzia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
          <Button onClick={handleUpload} disabled={!file || uploading || !clienteId} className="gap-2">
            {uploading ? "Caricamento…" : <><CheckCircle className="h-4 w-4" /> Carica</>}
          </Button>
          {!clienteId && (
            <p className="text-xs text-muted-foreground">
              Il tuo profilo cliente non è ancora collegato. Contatta l'compagnia.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteUploadDoc;
