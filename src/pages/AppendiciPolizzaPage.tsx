import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, Download, Pencil, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";

const TIPI_APPENDICE = [
  { value: "modifica", label: "Modifica" },
  { value: "integrazione", label: "Integrazione" },
  { value: "rettifica", label: "Rettifica" },
  { value: "annullamento_parziale", label: "Annullamento parziale" },
];

const AppendiciPolizzaPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const paramPolizza = searchParams.get("polizza") || "";
  
  const paramClienteId = searchParams.get("clienteId") || "";
  const paramTitoloId = searchParams.get("titoloId") || "";

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [numeroAppendice, setNumeroAppendice] = useState("");
  const [dataAppendice, setDataAppendice] = useState(new Date().toISOString().slice(0, 10));
  const [dataEffetto, setDataEffetto] = useState("");
  const [oggetto, setOggetto] = useState("");
  const [tipo, setTipo] = useState("modifica");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [viewText, setViewText] = useState<string | null>(null);
  // Track existing file when editing
  const [existingFilePath, setExistingFilePath] = useState<string | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setNumeroAppendice("");
    setDataAppendice(new Date().toISOString().slice(0, 10));
    setDataEffetto("");
    setOggetto("");
    setTipo("modifica");
    setNote("");
    setFile(null);
    setExistingFilePath(null);
    setExistingFileName(null);
    setRemoveExistingFile(false);
  };

  const startEdit = (a: any) => {
    setEditingId(a.id);
    setNumeroAppendice(a.numero_appendice || "");
    setDataAppendice(a.data_appendice || "");
    setDataEffetto(a.data_effetto || "");
    setOggetto(a.oggetto || "");
    setTipo(a.tipo || "modifica");
    setNote(a.note || "");
    setFile(null);
    setExistingFilePath(a.file_path || null);
    setExistingFileName(a.nome_file || null);
    setRemoveExistingFile(false);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Lookup cliente
  const { data: clienteData } = useQuery({
    queryKey: ["cliente-by-id-appendici", paramClienteId],
    queryFn: async () => {
      const { data } = await supabase.from("clienti").select("id, nome, cognome, ragione_sociale, tipo_cliente").eq("id", paramClienteId).maybeSingle();
      return data;
    },
    enabled: !!paramClienteId,
  });

  const { data: titoloData } = useQuery({
    queryKey: ["titolo-appendici", paramTitoloId],
    queryFn: async () => {
      const { data } = await supabase.from("titoli").select("id, numero_titolo, riga").eq("id", paramTitoloId).maybeSingle();
      return data;
    },
    enabled: !!paramTitoloId,
  });

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

  // Auto-suggest next number only when creating
  useEffect(() => {
    if (editingId) return;
    if (appendici.length > 0 && !numeroAppendice) {
      const maxNum = Math.max(...appendici.map((a: any) => parseInt(a.numero_appendice) || 0));
      setNumeroAppendice(String(maxNum + 1));
    } else if (appendici.length === 0 && !numeroAppendice) {
      setNumeroAppendice("1");
    }
  }, [appendici, editingId]);

  // Deep-link: auto-open edit mode if appendiceId is in query params
  const paramAppendiceId = searchParams.get("appendiceId") || "";
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  useEffect(() => {
    if (deepLinkHandled || !paramAppendiceId || appendici.length === 0) return;
    const target = appendici.find((a: any) => a.id === paramAppendiceId);
    if (target) {
      startEdit(target);
      setDeepLinkHandled(true);
    }
  }, [paramAppendiceId, appendici, deepLinkHandled]);

  // Save / Update
  const saveMutation = useMutation({
    mutationFn: async (): Promise<{ wasUpdate: boolean; record?: any }> => {
      if (!paramTitoloId) throw new Error("Titolo non specificato");
      if (!numeroAppendice.trim()) throw new Error("Numero appendice obbligatorio");

      const currentEditingId = editingId;

      let filePath: string | null = null;
      let nomeFile: string | null = null;

      // Handle file upload / removal
      if (file) {
        if (currentEditingId && existingFilePath) {
          await supabase.storage.from("documenti_titoli").remove([existingFilePath]);
        }
        const path = `appendici/${paramTitoloId}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("documenti_titoli").upload(path, file);
        if (uploadErr) throw uploadErr;
        filePath = path;
        nomeFile = file.name;
      } else if (currentEditingId && removeExistingFile && existingFilePath) {
        await supabase.storage.from("documenti_titoli").remove([existingFilePath]);
        filePath = null;
        nomeFile = null;
      } else if (currentEditingId && existingFilePath && !removeExistingFile) {
        filePath = existingFilePath;
        nomeFile = existingFileName;
      }

      const payload = {
        titolo_id: paramTitoloId,
        numero_appendice: numeroAppendice.trim(),
        data_appendice: dataAppendice || null,
        data_effetto: dataEffetto || null,
        oggetto: oggetto.trim() || null,
        tipo,
        file_path: filePath,
        nome_file: nomeFile,
        note: note.trim() || null,
      };

      if (currentEditingId) {
        const { data, error } = await supabase.from("appendici_polizza").update(payload).eq("id", currentEditingId).select().single();
        if (error) throw error;
        return { wasUpdate: true, record: data };
      } else {
        const { data, error } = await supabase.from("appendici_polizza").insert({
          ...payload,
          created_by: user?.id || null,
        }).select().single();
        if (error) throw error;
        return { wasUpdate: false, record: data };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["appendici-polizza", paramTitoloId] });
      if (result.wasUpdate) {
        toast.success("Appendice aggiornata");
      } else {
        toast.success("Appendice creata con successo");
      }
      // Always switch to edit mode on the saved record
      if (result.record) {
        startEdit(result.record);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("appendiceId", result.record.id);
          return next;
        });
      }
    },
    onError: (err: any) => toast.error(err.message || "Errore nel salvataggio"),
  });

  // Delete
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
      // If we were editing the deleted one, reset
      resetForm();
    },
    onError: () => toast.error("Errore nell'eliminazione"),
  });

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

      {/* INFO POLIZZA */}
      <PolizzaSection title="Polizza">
        <div className="flex items-center gap-6 flex-wrap text-sm">
          <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{clienteLabel}</span></div>
          <div><span className="text-muted-foreground">Polizza:</span> <span className="font-mono font-medium">{paramPolizza || "—"}</span></div>
          
        </div>
      </PolizzaSection>

      {/* FORM APPENDICE */}
      <PolizzaSection title={editingId ? `Modifica Appendice #${numeroAppendice}` : "Nuova Appendice"}>

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

        <div className="space-y-1.5">
          <Label>Allega documento</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center space-y-3">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Seleziona un file (PDF, DOC, immagini)</p>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setRemoveExistingFile(false); }}
                className="text-sm"
              />
              {file && <p className="text-sm font-medium text-foreground">📎 {file.name}</p>}
              {/* Show existing file info when editing */}
              {editingId && existingFileName && !removeExistingFile && !file && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <span className="text-muted-foreground">File attuale:</span>
                  <span className="font-medium">{existingFileName}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-destructive hover:text-destructive" onClick={() => setRemoveExistingFile(true)}>
                    <X className="w-3 h-3 mr-1" />Rimuovi
                  </Button>
                </div>
              )}
              {editingId && removeExistingFile && !file && (
                <p className="text-sm text-destructive">Il file verrà rimosso al salvataggio</p>
              )}
            </div>
        </div>

        <div className="space-y-1.5">
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note aggiuntive..." />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {editingId && (
            <>
              <Button variant="outline" onClick={() => {
                resetForm();
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("appendiceId");
                  return next;
                });
              }}>
                <Plus className="w-4 h-4 mr-1" />Nuova Appendice
              </Button>
              <Button variant="outline" onClick={() => {
                resetForm();
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("appendiceId");
                  return next;
                });
              }}>
                <X className="w-4 h-4 mr-1" />Annulla modifica
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={() => paramTitoloId ? navigate(`/titoli/${paramTitoloId}`) : navigate("/portafoglio/attive")}>
            Chiudi
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvataggio..." : editingId ? "Aggiorna Appendice" : "Salva Appendice"}
          </Button>
        </div>
      </PolizzaSection>

      {/* LISTA APPENDICI ESISTENTI */}
      <PolizzaSection title={`Appendici Esistenti (${appendici.length})`}>
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
                  <TableHead className="w-28">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appendici.map((a: any) => (
                  <TableRow key={a.id} className={editingId === a.id ? "bg-accent/30" : ""}>
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
                        {/* testo legacy non più visualizzato */}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(a)} title="Modifica">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Elimina">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sei sicuro di voler eliminare l'appendice #{a.numero_appendice}? Questa azione non può essere annullata.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(a)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PolizzaSection>
    </div>
  );
};

export default AppendiciPolizzaPage;
