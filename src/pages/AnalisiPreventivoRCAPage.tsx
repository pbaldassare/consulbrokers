import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, X, FileText, Image, Loader2, Car, Shield } from "lucide-react";

interface FileItem {
  file: File;
  preview?: string;
}

interface Garanzia {
  nome_garanzia: string;
  massimale?: string;
  franchigia?: string;
  premio: number;
  inclusa: boolean;
}

interface RisultatoAnalisi {
  nome_file: string;
  risultato?: {
    contraente?: string;
    codice_fiscale?: string;
    targa?: string;
    veicolo_marca_modello?: string;
    data_effetto?: string;
    data_scadenza?: string;
    premio_lordo_rca?: number;
    premio_lordo_infortuni?: number;
    premio_lordo_furto_incendio?: number;
    premio_lordo_kasko?: number;
    premio_lordo_cristalli?: number;
    premio_lordo_assistenza?: number;
    premio_lordo_tutela_legale?: number;
    premio_lordo_altri?: number;
    premio_lordo_totale?: number;
    garanzie?: Garanzia[];
  };
  errore?: string;
}

const MAX_FILES = 10;
const MAX_SIZE = 10 * 1024 * 1024;

const fmt = (n?: number) => n != null ? `€ ${n.toFixed(2)}` : "—";

export default function AnalisiPreventivoRCAPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [risultati, setRisultati] = useState<RisultatoAnalisi[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid = arr.filter(f => {
      if (f.size > MAX_SIZE) { toast.error(`${f.name} supera 10MB`); return false; }
      if (!f.type.startsWith("image/") && f.type !== "application/pdf") { toast.error(`${f.name}: formato non supportato`); return false; }
      return true;
    });
    setFiles(prev => {
      const total = [...prev, ...valid.map(f => ({ file: f, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined }))];
      if (total.length > MAX_FILES) { toast.error(`Massimo ${MAX_FILES} file`); return total.slice(0, MAX_FILES); }
      return total;
    });
  }, []);

  const removeFile = (idx: number) => {
    setFiles(prev => { if (prev[idx]?.preview) URL.revokeObjectURL(prev[idx].preview!); return prev.filter((_, i) => i !== idx); });
  };

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); addFiles(e.dataTransfer.files); }, [addFiles]);

  const analyzeAll = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setProgress(10);
    setRisultati([]);

    try {
      const encoded = await Promise.all(files.map(async ({ file }) => {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return { base64: btoa(binary), mime_type: file.type, nome_file: file.name };
      }));

      setProgress(30);

      const { data, error } = await supabase.functions.invoke("analisi-documenti-multipli", {
        body: { files: encoded },
      });

      setProgress(90);

      if (error) {
        console.error(error);
        toast.error("Errore nell'analisi dei documenti");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setRisultati(data.risultati || []);
      toast.success(`${(data.risultati || []).length} documenti analizzati`);
    } catch (e) {
      console.error(e);
      toast.error("Errore imprevisto");
    } finally {
      setProgress(100);
      setTimeout(() => setLoading(false), 300);
    }
  };

  const premiRows = (r: RisultatoAnalisi["risultato"]) => {
    if (!r) return [];
    return [
      { label: "RCA", value: r.premio_lordo_rca },
      { label: "Infortuni Conducente", value: r.premio_lordo_infortuni },
      { label: "Furto / Incendio", value: r.premio_lordo_furto_incendio },
      { label: "Kasko", value: r.premio_lordo_kasko },
      { label: "Cristalli", value: r.premio_lordo_cristalli },
      { label: "Assistenza Stradale", value: r.premio_lordo_assistenza },
      { label: "Tutela Legale", value: r.premio_lordo_tutela_legale },
      { label: "Altri", value: r.premio_lordo_altri },
    ].filter(p => p.value != null && p.value > 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Car className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analisi Preventivo RCA</h1>
          <p className="text-sm text-muted-foreground">Carica foto o PDF di preventivi auto e l'AI estrarrà i dati</p>
        </div>
      </div>

      {/* Upload area */}
      <Card>
        <CardContent className="pt-6">
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">Trascina qui i file o clicca per selezionare</p>
            <p className="text-sm text-muted-foreground mt-1">PDF o immagini • max 10MB ciascuno • fino a {MAX_FILES} file</p>
            <input ref={inputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{files.length} file selezionati</span>
                <Button variant="ghost" size="sm" onClick={() => setFiles([])} className="text-destructive">Rimuovi tutti</Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {files.map((f, i) => (
                  <div key={i} className="relative group border rounded-lg p-2 bg-muted/30">
                    {f.preview ? (
                      <img src={f.preview} alt={f.file.name} className="h-20 w-full object-cover rounded" />
                    ) : (
                      <div className="h-20 flex items-center justify-center"><FileText className="h-8 w-8 text-muted-foreground" /></div>
                    )}
                    <p className="text-xs truncate mt-1 text-foreground">{f.file.name}</p>
                    <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <Button onClick={analyzeAll} disabled={loading} className="w-full mt-3">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisi in corso...</> : <><Shield className="h-4 w-4 mr-2" />Analizza tutti ({files.length})</>}
              </Button>
            </div>
          )}

          {loading && <Progress value={progress} className="mt-3" />}
        </CardContent>
      </Card>

      {/* Risultati */}
      {risultati.map((res, idx) => (
        <Card key={idx} className={res.errore ? "border-destructive/50" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                {res.risultato ? <Image className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-destructive" />}
                {res.nome_file}
              </CardTitle>
              {res.errore && <Badge variant="destructive">Errore</Badge>}
              {res.risultato && <Badge className="bg-primary text-primary-foreground">Analizzato</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {res.errore && <p className="text-destructive">{res.errore}</p>}

            {res.risultato && (
              <div className="space-y-4">
                {/* Dati cliente */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { l: "Contraente", v: res.risultato.contraente },
                    { l: "Codice Fiscale", v: res.risultato.codice_fiscale },
                    { l: "Targa", v: res.risultato.targa },
                    { l: "Veicolo", v: res.risultato.veicolo_marca_modello },
                    { l: "Effetto", v: res.risultato.data_effetto },
                    { l: "Scadenza", v: res.risultato.data_scadenza },
                  ].filter(x => x.v).map((item, i) => (
                    <div key={i} className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">{item.l}</p>
                      <p className="font-medium text-sm text-foreground">{item.v}</p>
                    </div>
                  ))}
                </div>

                {/* Premi */}
                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Riepilogo Premi</h4>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Garanzia</TableHead><TableHead className="text-right">Premio Lordo</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {premiRows(res.risultato).map((p, i) => (
                        <TableRow key={i}><TableCell>{p.label}</TableCell><TableCell className="text-right">{fmt(p.value)}</TableCell></TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>TOTALE</TableCell>
                        <TableCell className="text-right text-primary">{fmt(res.risultato.premio_lordo_totale)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Garanzie */}
                {res.risultato.garanzie && res.risultato.garanzie.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-foreground">Dettaglio Garanzie</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Garanzia</TableHead>
                          <TableHead>Massimale</TableHead>
                          <TableHead>Franchigia</TableHead>
                          <TableHead className="text-right">Premio</TableHead>
                          <TableHead className="text-center">Inclusa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {res.risultato.garanzie.map((g, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{g.nome_garanzia}</TableCell>
                            <TableCell>{g.massimale || "—"}</TableCell>
                            <TableCell>{g.franchigia || "—"}</TableCell>
                            <TableCell className="text-right">{fmt(g.premio)}</TableCell>
                            <TableCell className="text-center">
                              {g.inclusa ? <Badge className="bg-primary text-primary-foreground">Sì</Badge> : <Badge variant="secondary">No</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
