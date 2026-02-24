import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Trash2, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAttivita } from "@/lib/logAttivita";

interface DocumentiTabProps {
  entitaTipo: string;
  entitaId: string;
  bucketName?: string;
  readOnly?: boolean;
}

const BUCKET_MAP: Record<string, string> = {
  cliente: "documenti_clienti",
  sinistro: "documenti_sinistri",
  titolo: "documenti_titoli",
  prospect: "documenti_generali",
  trattativa: "documenti_generali",
  rimessa: "documenti_generali",
};

export default function DocumentiTab({ entitaTipo, entitaId, bucketName, readOnly = false }: DocumentiTabProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const bucket = bucketName || BUCKET_MAP[entitaTipo] || "documenti_generali";

  const { data: documenti } = useQuery({
    queryKey: ["documenti", entitaTipo, entitaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("documenti")
        .select("*, profiles:caricato_da(nome, cognome)")
        .eq("entita_tipo", entitaTipo)
        .eq("entita_id", entitaId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${entitaTipo}/${entitaId}/${Date.now()}_${file.name}`;

      const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, file);
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("documenti").insert({
        nome_file: file.name,
        path_storage: path,
        bucket_name: bucket,
        entita_tipo: entitaTipo,
        entita_id: entitaId,
        caricato_da: user?.id,
      });
      if (insertErr) throw insertErr;

      await logAttivita({ azione: "upload_documento", entita_tipo: entitaTipo, entita_id: entitaId, dettagli_json: { nome_file: file.name } });
      toast.success("Documento caricato");
      qc.invalidateQueries({ queryKey: ["documenti", entitaTipo, entitaId] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async (doc: any) => {
    const { data, error } = await supabase.storage.from(doc.bucket_name).download(doc.path_storage);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.nome_file;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleVisibilita = async (doc: any) => {
    await supabase.from("documenti").update({ visibile_al_cliente: !doc.visibile_al_cliente }).eq("id", doc.id);
    qc.invalidateQueries({ queryKey: ["documenti", entitaTipo, entitaId] });
  };

  const handleDelete = async (doc: any) => {
    await supabase.storage.from(doc.bucket_name).remove([doc.path_storage]);
    await supabase.from("documenti").delete().eq("id", doc.id);
    toast.success("Documento eliminato");
    qc.invalidateQueries({ queryKey: ["documenti", entitaTipo, entitaId] });
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-1" /> {uploading ? "Caricamento..." : "Carica Documento"}
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome File</TableHead>
            <TableHead>Caricato da</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Visibile al cliente</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documenti?.map((doc: any) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{doc.nome_file}</TableCell>
              <TableCell>{doc.profiles ? `${doc.profiles.nome} ${doc.profiles.cognome}` : "—"}</TableCell>
              <TableCell>{format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
              <TableCell>
                <Switch checked={doc.visibile_al_cliente} onCheckedChange={() => toggleVisibilita(doc)} disabled={readOnly} />
              </TableCell>
              <TableCell className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => handleDownload(doc)}><Download className="h-4 w-4" /></Button>
                {!readOnly && <Button size="icon" variant="ghost" onClick={() => handleDelete(doc)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
          {!documenti?.length && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nessun documento</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}
