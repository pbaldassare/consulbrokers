import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const ProspectUploadDoc = () => {
  const { user } = useAuth();
  const [prospectId, setProspectId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("prospect")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProspectId(data.id);
      });
  }, [user]);

  const handleUpload = async () => {
    if (!file || !prospectId || !user) return;
    setUploading(true);

    const path = `prospect/${prospectId}/${Date.now()}_${file.name}`;
    const { error: storageError } = await supabase.storage
      .from("documenti_clienti")
      .upload(path, file);

    if (storageError) {
      toast.error("Errore nel caricamento del file");
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("documenti").insert({
      entita_tipo: "prospect",
      entita_id: prospectId,
      nome_file: file.name,
      path_storage: path,
      bucket_name: "documenti_clienti",
      caricato_da: user.id,
      visibile_al_cliente: true,
      categoria: "documento_prospect",
    });

    if (dbError) {
      toast.error("Errore nel salvataggio");
    } else {
      toast.success("Documento caricato con successo");
      setFile(null);
    }
    setUploading(false);
  };

  if (!prospectId) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground">Carica Documenti</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Profilo prospect non collegato. Contatta l'agenzia.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Carica Documenti</h1>
        <p className="text-sm text-muted-foreground mt-1">Carica qui i documenti richiesti dall'agenzia.</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-sm">Seleziona un file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          {file && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </p>
          )}
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Caricamento..." : "Carica"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProspectUploadDoc;
