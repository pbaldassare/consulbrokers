import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Upload, Trash2, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TIPI_APPENDICE = [
  { value: "modifica", label: "Modifica" },
  { value: "integrazione", label: "Integrazione" },
  { value: "rettifica", label: "Rettifica" },
  { value: "annullamento_parziale", label: "Annullamento parziale" },
];

const AppendiciPolizzaPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const paramPolizza = searchParams.get("polizza") || "";
  const paramRiga = searchParams.get("riga") || "";
  const paramClienteId = searchParams.get("clienteId") || "";
  const paramTitoloId = searchParams.get("titoloId") || "";

  // Form state
  const [numeroAppendice, setNumeroAppendice] = useState("");
  const [dataAppendice, setDataAppendice] = useState(new Date().toISOString().slice(0, 10));
  const [dataEffetto, setDataEffetto] = useState("");
  const [oggetto, setOggetto] = useState("");
  const [tipo, setTipo] = useState("modifica");
  const [testo, setTesto] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [contentTab, setContentTab] = useState("testo");
  const [viewText, setViewText] = useState<string | null>(null);

  // Lookup cliente
  const { data: clienteData } = useQuery({
    queryKey: ["cliente-by-id-appendici", paramClienteId],
    queryFn: async () => {
      const { data } = await supabase.from("clienti").select("id, nome, cognome, ragione_sociale, tipo_cliente").eq("id", paramClienteId).maybeSingle();
      return data;
    },
    enabled: !!paramClienteId,
  });

  // Lookup titolo per ottenere titolo_id reale
  const { data: titoloData } = useQuery({
    queryKey: ["titolo-appendici", paramTitoloId],
    queryFn: async () => {
      const { data } = await supabase.from("titoli").select("id, numero_titolo, riga").eq("id", paramTitoloId).maybeSingle();
      return data;
    },
    enabled: !!paramTitoloId,
  });

  // Lista appendici esistenti per questo titolo
  const { data: appendici = [], isLoading: loadingAppendici } = useQuery({
    queryKey: ["appendici-polizza", paramTitoloId],
    queryFn: async () => {
      const { data } = await supabase
        .from("appendici_polizza")
        .select("*")
        .eq("titolo_id", paramTitoloId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!paramTitoloId,
  });

  // Suggerisci prossimo numero appendice
  useEffect(() => {
    if (appendici.length > 0 && !numeroAppendice) {
      const maxNum = Math.max(...appendici.map((a: any) => parseInt(a.numero_appendice) || 0));
      setNumeroAppendice(String(maxNum + 1));
    } else if (appendici.length === 0 && !numeroAppendice) {
      setNumeroAppendice("1");
    }
  }, [appendici]);

  // Salva appendice
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!paramTitoloId) throw new Error("Titolo non specificato");
      if (!numeroAppendice.trim()) throw new Error("Numero appendice obbligatorio");

      let filePath: string | null = null;
      let nomeFile: string | null = null;

      // Upload file se presente
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `appendici/${paramTitoloId}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("documenti_titoli").upload(path, file);
        if (uploadErr) throw uploadErr;
        filePath = path;
        nomeFile = file.name;
      }

      const { error } = await supabase.from("appendici_polizza").insert({
        titolo_id: paramTitoloId,
        numero_appendice: numeroAppendice.trim(),
        data_appendice: dataAppendice || null,
        data_effetto: dataEffetto || null,
        oggetto: oggetto.trim() || null,
        testo: testo.trim() || null,
        tipo,
        file_path: filePath,
        nome_file: nomeFile,
        note: note.trim() || null,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appendice salvata con successo");
      queryClient.invalidateQueries({ queryKey: ["appendici-polizza", paramTitoloId] });
      // Reset form
      setOggetto("");
      setTesto("");
      setNote("");
      setFile(null);
      setDataEffetto("");
      setNumeroAppendice("");
    },
    onError: (err: any) => toast.error(err.message || "Errore nel salvataggio"),
  });

  // Elimina appendice
  const deleteMutation = useMutation({
    mutationFn: async (appendice: any) => {
      if (appendice.file_path) {
        await supabase.storage.from("documenti_titoli").remove([appendice.file_path]);
      }
      const { error } = await supabase.from("appendici_polizza").delete().eq("id", appendice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appendice eliminata");
      queryClient.invalidateQueries({ queryKey: ["appendici-polizza", paramTitoloId] });
    },
    onError: () => toast.error("Errore nell'eliminazione"),
  });

  // Download file
  const handleDownload = async (filePath: string, nomeFile: string) => {
    const { data, error } = await supabase.storage.from("documenti_titoli").download(filePath);
    if (error || !data) { toast.error("Errore download"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeFile;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clienteLabel = clienteData
    ? (clienteData.tipo_cliente === "privato"
      ? `${clienteData.cognome || ""} ${clienteData.nome || ""}`.trim()
      : clienteData.ragione_sociale || "—")
    : "—";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Appendici Polizza</h1>
        <p className="text-sm text-muted-foreground mt-1">Crea e gestisci appendici per la polizza {paramPolizza}</p>
      </div>

      {/* INFO POLIZZA (read-only) */}
      <fieldset className="border border-border rounded-lg p-5 space-y-3">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Polizza</legend>
        <div className="flex items-center gap-6 flex-wrap text-sm">
          <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{clienteLabel}</span></div>
          <div><span className="text-muted-foreground">Polizza:</span> <span className="font-mono font-medium">{paramPolizza || "—"}</span></div>
          <div><span className="text-muted-foreground">Riga:</span> <span className="font-mono">{paramRiga || "—"}</span></div>
        </div>
      </fieldset>

      {/* NUOVA APPENDICE */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Nuova Appendice</legend>
        
        <div className="flex gap-4 flex-wrap">
          <div className="space-y-1.5 w-[120px]">
            <Label>N° Appendice</Label>
            <Input value={numeroAppendice} onChange={(e) => setNumeroAppendice(e.target.value)} placeholder="1" />
          </div>
          <div className="space-y-1.5 w-[160px]">
            <Label>Data Appendice</Label>
            <Input type="date" value={dataAppendice} onChange={(e) => setDataAppendice(e.target.value)} />
          </div>
          <div className="space-y-1.5 w-[160px]">
            <Label>Data Effetto</Label>
            <Input type="date" value={dataEffetto} onChange={(e) => setDataEffetto(e.target.value)} />
          </div>
          <div className="space-y-1.5 w-[200px]">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPI_APPENDICE.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Oggetto</Label>
          <Input value={oggetto} onChange={(e) => setOggetto(e.target.value)} placeholder="Oggetto dell'appendice..." />
        </div>

        {/* Tab contenuto */}
        <Tabs value={contentTab} onValueChange={setContentTab}>
          <TabsList>
            <TabsTrigger value="testo"><FileText className="w-4 h-4 mr-1" />Scrivi testo</TabsTrigger>
            <TabsTrigger value="file"><Upload className="w-4 h-4 mr-1" />Allega documento</TabsTrigger>
          </TabsList>
          <TabsContent value="testo" className="mt-3">
            <Textarea
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              placeholder="Redigi il testo dell'appendice..."
              rows={8}
            />
          </TabsContent>
          <TabsContent value="file" className="mt-3">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center space-y-3">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Seleziona un file (PDF, DOC, immagini)</p>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
              {file && <p className="text-sm font-medium text-foreground">📎 {file.name}</p>}
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-1.5">
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note aggiuntive..." />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => paramTitoloId ? navigate(`/titoli/${paramTitoloId}`) : navigate("/portafoglio/gestione-polizze")}>
            Chiudi
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvataggio..." : "Salva Appendice"}
          </Button>
        </div>
      </fieldset>

      {/* LISTA APPENDICI ESISTENTI */}
      <fieldset className="border border-border rounded-lg p-5 space-y-3">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">
          Appendici Esistenti ({appendici.length})
        </legend>
        {loadingAppendici ? (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        ) : appendici.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna appendice registrata per questa polizza.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">N°</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Effetto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Oggetto</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="w-24">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appendici.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono font-bold">{a.numero_appendice}</TableCell>
                    <TableCell className="text-sm">{a.data_appendice ? format(new Date(a.data_appendice), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                    <TableCell className="text-sm">{a.data_effetto ? format(new Date(a.data_effetto), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{a.tipo}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{a.oggetto || "—"}</TableCell>
                    <TableCell>
                      {a.nome_file ? (
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleDownload(a.file_path, a.nome_file)}>
                          <Download className="w-3 h-3 mr-1" />{a.nome_file}
                        </Button>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {a.testo && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewText(a.testo)} title="Visualizza testo">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(a)} title="Elimina">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </fieldset>

      {/* Dialog per visualizzare testo appendice */}
      <Dialog open={!!viewText} onOpenChange={() => setViewText(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Testo Appendice</DialogTitle>
          </DialogHeader>
          <p className="text-sm whitespace-pre-wrap">{viewText}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppendiciPolizzaPage;
