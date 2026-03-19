import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ScanLine, Upload, Loader2, CheckCircle2, X } from "lucide-react";

export type DocumentType = "carta_identita" | "tessera_sanitaria" | "visura_camerale" | "copia_polizza";

const DOC_LABELS: Record<DocumentType, string> = {
  carta_identita: "Carta d'Identità",
  tessera_sanitaria: "Tessera Sanitaria",
  visura_camerale: "Visura Camerale",
  copia_polizza: "Copia Polizza",
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface AiDocumentScannerProps {
  documentType: DocumentType;
  onExtracted: (data: Record<string, unknown>) => void;
  onFileReady?: (file: File, documentType: DocumentType) => void;
  label?: string;
  className?: string;
}

const AiDocumentScanner = ({ documentType, onExtracted, label, className = "" }: AiDocumentScannerProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastResult, setLastResult] = useState<"success" | "error" | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Formato non supportato", description: "Carica un file JPG, PNG, WEBP o PDF", variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: "File troppo grande", description: "Il file non deve superare 10MB", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setLastResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const { data, error } = await supabase.functions.invoke("extract-document-data", {
        body: {
          file_base64: base64,
          tipo_documento: documentType,
          mime_type: file.type,
        },
      });

      if (error) throw new Error(error.message || "Errore durante l'elaborazione");
      if (data?.error) throw new Error(data.error);
      if (!data?.data) throw new Error("Nessun dato estratto");

      onExtracted(data.data);
      setLastResult("success");
      setIsExpanded(false);
      toast({ title: "Dati estratti con successo", description: `Documento ${DOC_LABELS[documentType]} elaborato` });
    } catch (err: unknown) {
      setLastResult("error");
      const message = err instanceof Error ? err.message : "Errore sconosciuto";
      toast({ title: "Errore estrazione", description: message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [documentType, onExtracted, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const buttonLabel = label || `Scansiona ${DOC_LABELS[documentType]}`;

  if (!isExpanded) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(true)}
        disabled={isProcessing}
        className={`gap-2 ${className}`}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : lastResult === "success" ? (
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        ) : (
          <ScanLine className="w-4 h-4" />
        )}
        {isProcessing ? "Elaborazione AI..." : buttonLabel}
      </Button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
          ${isProcessing ? "pointer-events-none opacity-70" : ""}
        `}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6"
          onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
        >
          <X className="w-3.5 h-3.5" />
        </Button>

        {isProcessing ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisi AI in corso...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{buttonLabel}</p>
            <p className="text-xs text-muted-foreground">
              Trascina o clicca per caricare • JPG, PNG, WEBP, PDF (max 10MB)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiDocumentScanner;
