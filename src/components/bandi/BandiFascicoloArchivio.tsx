import { useEffect, useMemo, useState } from "react";
import { FolderOpen, FileText, Download, Trash2, Loader2, FileDown, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  TIPI_DOCUMENTO_BANDO,
  documentiVisibili,
  groupDocumentiByTipo,
  labelStatoDocumentoBando,
  labelTipoDocumentoBando,
  type BandoDocumentoRow,
} from "@/lib/bandiDocumenti";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bando: { id: string; titolo?: string | null; oggetto?: string | null; ente?: string | null } | null;
  documenti: BandoDocumentoRow[];
  downloading?: boolean;
  onScaricaTutti?: () => void;
  onRefresh: () => void;
};

export function BandiFascicoloArchivio({
  open,
  onOpenChange,
  bando,
  documenti,
  downloading,
  onScaricaTutti,
  onRefresh,
}: Props) {
  const visibili = useMemo(() => documentiVisibili(documenti), [documenti]);
  const gruppi = useMemo(() => groupDocumentiByTipo(visibili), [visibili]);
  const [filtroTipo, setFiltroTipo] = useState("tutti");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState("");
  const [saving, setSaving] = useState(false);

  const lista = filtroTipo === "tutti"
    ? visibili
    : visibili.filter((d) => d.tipo === filtroTipo);
  const selected = lista.find((d) => d.id === selectedId) || lista[0] || null;

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setPreviewUrl(null);
      setFiltroTipo("tutti");
      return;
    }
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [open, selected, selectedId]);

  useEffect(() => {
    if (!selected) {
      setPreviewUrl(null);
      setNomeEdit("");
      return;
    }
    setNomeEdit(selected.nome || "");
    let cancelled = false;
    const load = async () => {
      if (!selected.storage_path) {
        setPreviewUrl(selected.url_origine);
        return;
      }
      const { data } = await supabase.storage
        .from("documenti_generali")
        .createSignedUrl(selected.storage_path, 3600);
      if (!cancelled) setPreviewUrl(data?.signedUrl || null);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.storage_path, selected?.url_origine, selected?.nome]);

  const updateDoc = async (patch: Partial<BandoDocumentoRow>) => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("bandi_documenti")
        .update(patch)
        .eq("id", selected.id);
      if (error) throw error;
      toast.success("Documento aggiornato");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Impossibile aggiornare il documento");
    } finally {
      setSaving(false);
    }
  };

  const rimuovi = async () => {
    if (!selected) return;
    if (!window.confirm(`Rimuovere «${selected.nome || "documento"}» dall'archivio?`)) return;
    await updateDoc({ stato: "rimosso" });
    setSelectedId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Archivio documenti
          </DialogTitle>
          <DialogDescription>
            {bando?.ente ? `${bando.ente} · ` : ""}
            {bando?.titolo || bando?.oggetto || "Bando"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{visibili.length} file</Badge>
          {onScaricaTutti && (
            <Button size="sm" className="gap-1" disabled={downloading} onClick={onScaricaTutti}>
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              Scarica dal portale
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3 min-h-0 flex-1">
          <div className="border rounded-md flex flex-col min-h-0">
            <div className="p-2 border-b flex flex-wrap gap-1">
              <button
                type="button"
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px]",
                  filtroTipo === "tutti" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
                onClick={() => setFiltroTipo("tutti")}
              >
                Tutti ({visibili.length})
              </button>
              {gruppi.map((g) => (
                <button
                  key={g.tipo}
                  type="button"
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px]",
                    filtroTipo === g.tipo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                  onClick={() => setFiltroTipo(g.tipo)}
                >
                  {g.label} ({g.docs.length})
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-1">
              {lista.length === 0 && (
                <p className="text-xs text-muted-foreground p-3">
                  Nessun documento in archivio. Usa «Scarica dal portale».
                </p>
              )}
              {lista.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedId(doc.id)}
                  className={cn(
                    "w-full text-left rounded-md px-2 py-2 mb-1 text-sm",
                    selected?.id === doc.id ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{doc.nome || "documento"}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{labelTipoDocumentoBando(doc.tipo)}</span>
                        <Badge variant="outline" className="text-[10px]">{labelStatoDocumentoBando(doc.stato)}</Badge>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="border rounded-md flex flex-col min-h-0">
            {selected ? (
              <>
                <div className="p-3 border-b grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={nomeEdit}
                      onChange={(e) => setNomeEdit(e.target.value)}
                      onBlur={() => {
                        if (nomeEdit.trim() && nomeEdit.trim() !== selected.nome) {
                          void updateDoc({ nome: nomeEdit.trim() });
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Categoria</Label>
                    <Select
                      value={selected.tipo}
                      onValueChange={(v) => void updateDoc({ tipo: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPI_DOCUMENTO_BANDO.map((t) => (
                          <SelectItem key={t} value={t}>{labelTipoDocumentoBando(t)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap gap-2">
                    {previewUrl && (
                      <>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(previewUrl, "_blank")}>
                          <ExternalLink className="h-3.5 w-3.5" /> Apri
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" asChild>
                          <a href={previewUrl} download={selected.nome || "documento.pdf"}>
                            <Download className="h-3.5 w-3.5" /> Scarica
                          </a>
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" className="gap-1 text-destructive" disabled={saving} onClick={() => void rimuovi()}>
                      <Trash2 className="h-3.5 w-3.5" /> Rimuovi
                    </Button>
                  </div>
                </div>
                {previewUrl ? (
                  <iframe
                    title={selected.nome || "PDF"}
                    src={previewUrl}
                    className="flex-1 w-full min-h-[40vh] bg-muted/20"
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    Anteprima non disponibile
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Seleziona un documento a sinistra
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
