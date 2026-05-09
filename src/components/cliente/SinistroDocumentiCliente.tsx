import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Download } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sinistroId: string;
}

export const SinistroDocumentiCliente = ({ sinistroId }: Props) => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("documenti")
      .select("id, nome_file, path_storage, bucket_name, created_at, caricato_da_cliente")
      .eq("entita_tipo", "sinistro")
      .eq("entita_id", sinistroId)
      .eq("visibile_al_cliente", true)
      .order("created_at", { ascending: false });
    setDocs(data ?? []);
  };

  useEffect(() => { load(); }, [sinistroId]);

  const upload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const path = `${sinistroId}/${Date.now()}_${file.name}`;
      const { error: sErr } = await supabase.storage.from("documenti_sinistri").upload(path, file);
      if (sErr) throw sErr;
      const { error: dErr } = await supabase.from("documenti").insert({
        entita_tipo: "sinistro",
        entita_id: sinistroId,
        nome_file: file.name,
        path_storage: path,
        bucket_name: "documenti_sinistri",
        caricato_da: user.id,
        caricato_da_cliente: true,
        visibile_al_cliente: true,
        categoria: "allegato_cliente",
      });
      if (dErr) throw dErr;
      toast.success("Documento caricato");
      setFile(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Errore upload");
    } finally {
      setUploading(false);
    }
  };

  const download = async (d: any) => {
    const { data, error } = await supabase.storage.from(d.bucket_name).createSignedUrl(d.path_storage, 60);
    if (error || !data) { toast.error("Impossibile scaricare"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="border-t pt-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <FileText className="h-3 w-3" /> Documenti del sinistro
      </p>
      {docs.length === 0 && <p className="text-xs text-muted-foreground">Nessun documento</p>}
      <ul className="space-y-1">
        {docs.map(d => (
          <li key={d.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1">
            <span className="truncate flex-1">
              {d.nome_file}
              {d.caricato_da_cliente && <span className="ml-2 text-[10px] text-primary">tuo</span>}
            </span>
            <Button variant="ghost" size="sm" onClick={() => download(d)}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 pt-1">
        <Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
        <Button size="sm" onClick={upload} disabled={!file || uploading}>
          <Upload className="h-3.5 w-3.5 mr-1" />
          {uploading ? "..." : "Carica"}
        </Button>
      </div>
    </div>
  );
};

export default SinistroDocumentiCliente;
