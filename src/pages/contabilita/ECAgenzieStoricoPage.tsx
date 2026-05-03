import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const ECAgenzieStoricoPage = () => {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ec-agenzie-storico"],
    queryFn: async () => {
      const { data: docs, error } = await supabase
        .from("documenti")
        .select("id, nome_file, path_storage, bucket_name, entita_id, created_at, caricato_da, categoria")
        .eq("categoria", "EC Agenzia")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const compIds = Array.from(new Set((docs || []).map((d: any) => d.entita_id).filter(Boolean)));
      const compMap: Record<string, string> = {};
      if (compIds.length) {
        const { data: comps } = await supabase
          .from("compagnie")
          .select("id, nome")
          .in("id", compIds);
        (comps || []).forEach((c: any) => { compMap[c.id] = c.nome; });
      }
      return (docs || []).map((d: any) => ({
        ...d,
        agenzia_nome: compMap[d.entita_id] || "—",
      }));
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data || [];
    return (data || []).filter((d: any) =>
      (d.nome_file || "").toLowerCase().includes(term) ||
      (d.agenzia_nome || "").toLowerCase().includes(term)
    );
  }, [data, q]);

  const handleDownload = async (row: any) => {
    try {
      const { data: blob, error } = await supabase.storage
        .from(row.bucket_name || "documenti_generali")
        .download(row.path_storage);
      if (error) throw error;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = row.nome_file;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e: any) {
      toast.error("Errore download: " + (e?.message || e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Storico E/C Agenzie</h1>
          <p className="text-sm text-muted-foreground">PDF "Estratto Conto Agenzia" archiviati</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca per agenzia o nome file..."
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Agenzia</TableHead>
              <TableHead>Nome File / Riferimento</TableHead>
              <TableHead className="w-[120px] text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nessun E/C archiviato</TableCell></TableRow>
            ) : filtered.map((d: any, i: number) => (
              <TableRow key={d.id} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                <TableCell className="text-sm">{d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                <TableCell className="font-medium">{d.agenzia_nome}</TableCell>
                <TableCell className="text-sm font-mono">{d.nome_file}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(d)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Scarica
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ECAgenzieStoricoPage;
