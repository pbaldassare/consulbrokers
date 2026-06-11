import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

type Props = {
  clienteId: string;
  trigger?: React.ReactNode;
};

type ExtractedData = {
  prodotto: {
    nome_prodotto: string;
    compagnia?: string;
    ramo?: string;
    edizione?: string;
    sommario_ai?: string;
  };
  garanzie_prodotto?: Array<{
    garanzia: string;
    massimale_standard?: number;
    franchigia_standard?: number;
    scoperto_percentuale?: number;
    note?: string;
  }>;
  condizioni_prodotto?: Array<{
    tipo: string;
    titolo?: string;
    testo: string;
    rilevante_sinistri?: boolean;
  }>;
  dati_personali?: { sommario_personalizzato?: string };
  garanzie_personali?: Array<{
    garanzia: string;
    massimale_personalizzato?: number;
    franchigia_personalizzata?: number;
    scoperto_personalizzato?: number;
    note_personali?: string;
  }>;
  testo_completo?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AnalizzaPolizzaCgaDialog({ clienteId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [esiste, setEsiste] = useState<{ id: string } | null>(null);
  const qc = useQueryClient();

  const reset = () => {
    setFile(null);
    setExtracted(null);
    setEsiste(null);
    setExtracting(false);
  };

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    try {
      const b64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("parse-cga", {
        body: { fileBase64: b64, mimeType: file.type || "application/pdf" },
      });
      if (error) throw error;
      const ed = data?.data as ExtractedData;
      if (!ed?.prodotto?.nome_prodotto) throw new Error("AI non ha riconosciuto il prodotto");
      setExtracted(ed);

      // Dedup prodotto
      const { data: existing } = await supabase
        .from("prodotti_cga")
        .select("id")
        .eq("nome_prodotto", ed.prodotto.nome_prodotto)
        .eq("compagnia", ed.prodotto.compagnia ?? "")
        .eq("edizione", ed.prodotto.edizione ?? "")
        .maybeSingle();
      setEsiste(existing ?? null);
    } catch (e: any) {
      toast.error("Errore estrazione AI: " + (e?.message ?? "sconosciuto"));
    } finally {
      setExtracting(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (stato: "approvato" | "bozza") => {
      if (!extracted || !file) throw new Error("Dati mancanti");
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Upload PDF
      const path = `cliente/${clienteId}/cga/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("documenti_clienti").upload(path, file);
      if (upErr) throw upErr;
      const { data: docRow, error: docErr } = await supabase.from("documenti").insert({
        nome_file: file.name, path_storage: path, bucket_name: "documenti_clienti",
        entita_tipo: "cliente", entita_id: clienteId, caricato_da: user?.id, categoria: "cga_polizza",
      }).select("id").single();
      if (docErr) throw docErr;

      // 2. Trova o crea prodotto
      let prodottoId = esiste?.id;
      if (!prodottoId) {
        const { data: newProd, error: prodErr } = await supabase.from("prodotti_cga").insert({
          nome_prodotto: extracted.prodotto.nome_prodotto,
          compagnia: extracted.prodotto.compagnia ?? null,
          ramo: extracted.prodotto.ramo ?? null,
          edizione: extracted.prodotto.edizione ?? null,
          sommario_ai: extracted.prodotto.sommario_ai ?? null,
          testo_completo: extracted.testo_completo ?? null,
          created_by: user?.id,
        }).select("id").single();
        if (prodErr) throw prodErr;
        prodottoId = newProd.id;

        // garanzie standard
        if (extracted.garanzie_prodotto?.length) {
          await supabase.from("prodotti_garanzie").insert(
            extracted.garanzie_prodotto.map(g => ({
              prodotto_id: prodottoId,
              garanzia: g.garanzia,
              massimale_standard: g.massimale_standard ?? null,
              franchigia_standard: g.franchigia_standard ?? null,
              scoperto_percentuale: g.scoperto_percentuale ?? null,
              note: g.note ?? null,
            }))
          );
        }
        // condizioni
        if (extracted.condizioni_prodotto?.length) {
          await supabase.from("prodotti_condizioni").insert(
            extracted.condizioni_prodotto.map(c => ({
              prodotto_id: prodottoId,
              tipo: c.tipo,
              titolo: c.titolo ?? null,
              testo: c.testo,
              rilevante_sinistri: c.rilevante_sinistri ?? true,
            }))
          );
        }
      }

      // 3. Crea polizza_cga
      const { data: pc, error: pcErr } = await supabase.from("polizza_cga").insert({
        cliente_id: clienteId,
        prodotto_id: prodottoId,
        documento_id: docRow.id,
        sommario_personalizzato: extracted.dati_personali?.sommario_personalizzato ?? null,
        stato,
        approvato_da: stato === "approvato" ? user?.id : null,
        approvato_at: stato === "approvato" ? new Date().toISOString() : null,
        created_by: user?.id,
      }).select("id").single();
      if (pcErr) throw pcErr;

      // 4. Override personali — match per nome garanzia
      if (extracted.garanzie_personali?.length) {
        const { data: gp } = await supabase.from("prodotti_garanzie").select("id, garanzia").eq("prodotto_id", prodottoId);
        const byName = new Map((gp ?? []).map((x: any) => [x.garanzia.toLowerCase(), x.id]));
        await supabase.from("polizza_garanzie_personali").insert(
          extracted.garanzie_personali.map(g => ({
            polizza_cga_id: pc.id,
            prodotto_garanzia_id: byName.get(g.garanzia.toLowerCase()) ?? null,
            massimale_personalizzato: g.massimale_personalizzato ?? null,
            franchigia_personalizzata: g.franchigia_personalizzata ?? null,
            scoperto_personalizzato: g.scoperto_personalizzato ?? null,
            note_personali: g.note_personali ?? null,
          }))
        );
      }
    },
    onSuccess: () => {
      toast.success("Polizza CGA salvata");
      qc.invalidateQueries({ queryKey: ["polizze-cga", clienteId] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error("Errore salvataggio: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Analizza Polizza CGA
          </Button>
        )}
      </div>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Analizza Polizza CGA
          </DialogTitle>
          <DialogDescription>
            Carica il PDF delle Condizioni Generali. L'AI estrarrà dati di prodotto e dati personali del cliente.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          {!extracted ? (
            <div className="space-y-3 py-2">
              <Label>PDF della polizza</Label>
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3 w-3" /> {file.name}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Dati del Prodotto</CardTitle>
                    {esiste ? (
                      <Badge className="bg-green-600">Prodotto già in libreria</Badge>
                    ) : (
                      <Badge className="bg-blue-600">Nuovo prodotto</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Nome:</span> <b>{extracted.prodotto.nome_prodotto}</b></div>
                    <div><span className="text-muted-foreground">Compagnia:</span> {extracted.prodotto.compagnia ?? "—"}</div>
                    <div><span className="text-muted-foreground">Ramo:</span> {extracted.prodotto.ramo ?? "—"}</div>
                    <div><span className="text-muted-foreground">Edizione:</span> {extracted.prodotto.edizione ?? "—"}</div>
                  </div>
                  {extracted.prodotto.sommario_ai && (
                    <p className="text-muted-foreground text-xs italic">{extracted.prodotto.sommario_ai}</p>
                  )}
                  {!!extracted.garanzie_prodotto?.length && (
                    <div>
                      <div className="font-medium mb-1">Garanzie standard</div>
                      <table className="w-full text-xs">
                        <thead><tr className="text-left text-muted-foreground">
                          <th>Garanzia</th><th>Massimale</th><th>Franchigia</th><th>Scop.%</th>
                        </tr></thead>
                        <tbody>
                          {extracted.garanzie_prodotto.map((g, i) => (
                            <tr key={i} className="odd:bg-muted/30">
                              <td>{g.garanzia}</td>
                              <td>{g.massimale_standard ?? "—"}</td>
                              <td>{g.franchigia_standard ?? "—"}</td>
                              <td>{g.scoperto_percentuale ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!!extracted.condizioni_prodotto?.length && (
                    <div>
                      <div className="font-medium mb-1">Condizioni rilevanti ({extracted.condizioni_prodotto.length})</div>
                      <ul className="text-xs space-y-1">
                        {extracted.condizioni_prodotto.slice(0, 5).map((c, i) => (
                          <li key={i}><Badge variant="outline" className="mr-1 text-[10px]">{c.tipo}</Badge>{c.titolo ?? c.testo.slice(0, 80)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/40 bg-primary/5">
                <CardHeader className="pb-3"><CardTitle className="text-base">Dati Personali Cliente</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {extracted.dati_personali?.sommario_personalizzato ? (
                    <p>{extracted.dati_personali.sommario_personalizzato}</p>
                  ) : (
                    <p className="text-muted-foreground italic">Nessuna condizione specifica negoziata rilevata.</p>
                  )}
                  {!!extracted.garanzie_personali?.length && (
                    <div>
                      <div className="font-medium mb-1">Override personali</div>
                      <table className="w-full text-xs">
                        <thead><tr className="text-left text-muted-foreground">
                          <th>Garanzia</th><th>Massimale</th><th>Franchigia</th><th>Scop.%</th><th>Note</th>
                        </tr></thead>
                        <tbody>
                          {extracted.garanzie_personali.map((g, i) => (
                            <tr key={i} className="odd:bg-muted/30">
                              <td>{g.garanzia}</td>
                              <td>{g.massimale_personalizzato ?? "—"}</td>
                              <td>{g.franchigia_personalizzata ?? "—"}</td>
                              <td>{g.scoperto_personalizzato ?? "—"}</td>
                              <td>{g.note_personali ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          {!extracted ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
              <Button onClick={handleExtract} disabled={!file || extracting} className="gap-2">
                {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Avvia Analisi AI
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={reset}>Scarta</Button>
              <Button variant="outline" onClick={() => saveMutation.mutate("bozza")} disabled={saveMutation.isPending}>
                Salva come Bozza
              </Button>
              <Button onClick={() => saveMutation.mutate("approvato")} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Approva e Salva
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
