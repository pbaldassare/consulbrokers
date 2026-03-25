import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const BancaImport = () => {
  const queryClient = useQueryClient();
  const { user, profile, isAdmin } = useAuth();

  const [selectedUfficio, setSelectedUfficio] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detailDoc, setDetailDoc] = useState<any>(null);

  const isCfoOrAdmin = isAdmin || (profile as any)?.ruolo === "cfo";
  const userUfficioId = (profile as any)?.ufficio_id;

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uffici").select("*").eq("attivo", true);
      if (error) throw error;
      return data;
    },
  });

  const effectiveUfficioId = isCfoOrAdmin ? selectedUfficio : userUfficioId;

  const { data: documenti = [], isLoading } = useQuery({
    queryKey: ["banca_documenti", effectiveUfficioId],
    queryFn: async () => {
      const q = supabase.from("banca_documenti" as any).select("*, uffici(nome_ufficio)").order("created_at", { ascending: false }) as any;
      if (effectiveUfficioId) q.eq("ufficio_id", effectiveUfficioId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: detailEstrattiRaw = [] } = useQuery({
    queryKey: ["estratti_documento", detailDoc?.id],
    queryFn: async () => {
      if (!detailDoc) return [];
      const { data, error } = await (supabase.from("estratti_conto").select("*") as any).eq("documento_id", detailDoc.id).order("data_operazione", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!detailDoc,
  });

  const detailEstratti = detailEstrattiRaw as any[];

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Seleziona un file");
      if (selectedFile.size > MAX_FILE_SIZE) throw new Error("File troppo grande (max 10MB)");

      const ufficioId = effectiveUfficioId;
      if (!ufficioId) throw new Error("Seleziona un ufficio");

      const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "";
      let tipoDoc = "csv";
      if (ext === "pdf") tipoDoc = "pdf";
      else if (["jpg", "jpeg", "png"].includes(ext)) tipoDoc = ext === "jpeg" ? "jpg" : ext;
      else if (ext !== "csv") throw new Error("Formato non supportato. Usa PDF, JPG, PNG o CSV");

      const path = `${ufficioId}/${Date.now()}_${selectedFile.name}`;

      // Upload to storage
      const { error: uploadErr } = await supabase.storage.from("documenti_banca").upload(path, selectedFile);
      if (uploadErr) throw uploadErr;

      // Create record
      const { data: doc, error: docErr } = await supabase.from("banca_documenti" as any).insert({
        ufficio_id: ufficioId,
        nome_file: selectedFile.name,
        path_storage: path,
        tipo_documento: tipoDoc,
        stato: "caricato",
        created_by: user?.id,
      } as any).select().single();
      if (docErr) throw docErr;

      await logAttivita({
        azione: "upload_documento_banca",
        entita_tipo: "banca_documento",
        entita_id: (doc as any).id,
        dettagli_json: { nome_file: selectedFile.name, tipo: tipoDoc },
      });

      // Trigger parsing
      const { error: parseErr } = await supabase.functions.invoke("parse-bank-document", {
        body: { documento_id: (doc as any).id, user_id: user?.id },
      });
      if (parseErr) console.error("Parse error:", parseErr);

      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banca_documenti"] });
      setSelectedFile(null);
      toast.success("Documento caricato e analisi avviata");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const matchMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { data, error } = await supabase.functions.invoke("match-bank-rows", {
        body: { documento_id: docId, user_id: user?.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["banca_documenti"] });
      queryClient.invalidateQueries({ queryKey: ["estratti_documento"] });
      queryClient.invalidateQueries({ queryKey: ["estratti_conto"] });
      queryClient.invalidateQueries({ queryKey: ["incroci_bancari"] });
      toast.success("Matching completato", { description: `OK: ${data?.ok || 0}, KO: ${data?.ko || 0}, Parziali: ${data?.parziale || 0}` });
    },
    onError: (err: any) => toast.error("Errore matching"),
  });

  const statoBadge = (stato: string) => {
    switch (stato) {
      case "elaborato": return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Elaborato</Badge>;
      case "errore": return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Errore</Badge>;
      case "in_elaborazione": return <Badge variant="outline"><Loader2 className="w-3 h-3 mr-1 animate-spin" />In elaborazione</Badge>;
      default: return <Badge variant="outline">{stato}</Badge>;
    }
  };

  const okCount = detailEstratti.filter((e: any) => e.stato === "ok").length;
  const koCount = detailEstratti.filter((e: any) => e.stato === "ko").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Banca / Import Documenti</h1>
        <p className="text-muted-foreground">Carica estratti conto e analizza automaticamente i movimenti</p>
      </div>

      {/* Upload section */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" />Carica Documento Banca</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isCfoOrAdmin && (
            <div>
              <Label>Ufficio *</Label>
              <Select value={selectedUfficio} onValueChange={setSelectedUfficio}>
                <SelectTrigger><SelectValue placeholder="Seleziona ufficio" /></SelectTrigger>
                <SelectContent>
                  {uffici.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>File (PDF, JPG, PNG, CSV - max 10MB)</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </div>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!selectedFile || (!effectiveUfficioId) || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Caricamento...</> : <><Upload className="w-4 h-4 mr-2" />Carica e Analizza</>}
          </Button>
        </CardContent>
      </Card>

      {/* Documents list */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Documenti Caricati</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome File</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Righe</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documenti.map((doc: any) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.nome_file}</TableCell>
                  <TableCell><Badge variant="outline">{doc.tipo_documento?.toUpperCase()}</Badge></TableCell>
                  <TableCell>{statoBadge(doc.stato)}</TableCell>
                  <TableCell>{doc.righe_estratte || 0}</TableCell>
                  <TableCell>{doc.created_at ? new Date(doc.created_at).toLocaleDateString("it-IT") : "—"}</TableCell>
                  <TableCell className="flex gap-1">
                    {doc.stato === "elaborato" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setDetailDoc(doc)}>Dettaglio</Button>
                        <Button size="sm" variant="outline" onClick={() => matchMutation.mutate(doc.id)} disabled={matchMutation.isPending}>
                          <RefreshCw className="w-3 h-3 mr-1" />Match
                        </Button>
                      </>
                    )}
                    {doc.stato === "errore" && (
                      <span className="text-sm text-destructive">{doc.error_message}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {documenti.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nessun documento</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailDoc} onOpenChange={(open) => !open && setDetailDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dettaglio: {detailDoc?.nome_file}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4 mb-4">
            <Badge variant="default">OK: {okCount}</Badge>
            <Badge variant="destructive">KO: {koCount}</Badge>
            <Badge variant="outline">Da verificare: {detailEstratti.filter((e: any) => e.stato === "da_verificare").length}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Importo</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailEstratti.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{e.data_operazione}</TableCell>
                  <TableCell className="max-w-[300px] truncate">{e.descrizione || "—"}</TableCell>
                  <TableCell className="font-mono">€ {e.importo?.toFixed(2)}</TableCell>
                  <TableCell className="font-mono">{e.saldo != null ? `€ ${e.saldo.toFixed(2)}` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={e.stato === "ok" ? "default" : e.stato === "ko" ? "destructive" : "outline"}>
                      {e.stato === "ok" ? "OK" : e.stato === "ko" ? "KO" : "Da verificare"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BancaImport;
