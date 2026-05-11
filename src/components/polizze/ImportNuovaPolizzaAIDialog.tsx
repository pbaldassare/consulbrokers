import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sparkles, UploadCloud, Loader2, FileText, CheckCircle2, AlertTriangle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type ParsedPolizzaData = {
  compagnia?: string;
  intermediario?: string;
  contraente_nome?: string;
  contraente_codice_fiscale?: string;
  contraente_partita_iva?: string;
  contraente_indirizzo?: string;
  contraente_comune?: string;
  contraente_provincia?: string;
  contraente_cap?: string;
  contraente_nazione?: string;
  contraente_email?: string;
  contraente_telefono?: string;
  numero_polizza?: string;
  prodotto?: string;
  ramo_descrizione?: string;
  decorrenza?: string;
  scadenza?: string;
  prossima_quietanza?: string;
  frazionamento?: string;
  tacito_rinnovo?: boolean;
  premio_firma_netto?: number;
  premio_firma_accessori?: number;
  premio_firma_imposte?: number;
  premio_firma_lordo?: number;
  premio_quietanza_netto?: number;
  premio_quietanza_accessori?: number;
  premio_quietanza_imposte?: number;
  premio_quietanza_lordo?: number;
  targa?: string;
  garanzie?: { descrizione: string; massimale?: number; premio_netto?: number }[];
};

export type MatchResult = {
  data: ParsedPolizzaData;
  cliente?: { id: string; label: string } | null;
  compagnia?: { id: string; label: string } | null;
  ramo?: { gruppoRamoId: string; ramoId: string; label: string } | null;
};

const fmtEur = (n?: number | null) =>
  n == null || isNaN(Number(n))
    ? "—"
    : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(n));

export function ImportNuovaPolizzaAIDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApply: (m: MatchResult) => void;
}) {
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMatch(null);
    setFileName(null);
    setParsing(false);
  };

  const lookupMatches = async (data: ParsedPolizzaData): Promise<MatchResult> => {
    const result: MatchResult = { data, cliente: null, compagnia: null, ramo: null };

    // Cliente: lookup esatto su CF o P.IVA
    const cf = (data.contraente_codice_fiscale || "").trim().toUpperCase();
    const piva = (data.contraente_partita_iva || "").trim();
    if (cf || piva) {
      const orParts: string[] = [];
      if (cf) orParts.push(`codice_fiscale.eq.${cf}`);
      if (piva) orParts.push(`partita_iva.eq.${piva}`);
      const { data: clienti } = await supabase
        .from("clienti")
        .select("id, ragione_sociale, cognome, nome, codice_fiscale, partita_iva")
        .or(orParts.join(","))
        .limit(1);
      const c = (clienti || [])[0];
      if (c) {
        result.cliente = {
          id: c.id,
          label: c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim(),
        };
      }
    }

    // Compagnia: ILIKE su nome
    const compName = (data.compagnia || "").trim();
    if (compName) {
      // Estraggo prima parola significativa per fuzzy
      const firstWord = compName.split(/\s+/)[0];
      const { data: comps } = await supabase
        .from("compagnie")
        .select("id, codice, nome")
        .or(`nome.ilike.%${firstWord}%,gruppo_compagnia.ilike.%${firstWord}%`)
        .limit(5);
      const c = (comps || [])[0];
      if (c) {
        result.compagnia = { id: c.id, label: `${c.codice || ""} - ${c.nome}`.trim() };
      }
    }

    // Ramo: ILIKE su descrizione
    const ramoDesc = (data.ramo_descrizione || "").trim();
    if (ramoDesc) {
      // Estraggo parole chiave
      const keywords = ramoDesc
        .replace(/[^\p{L}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3)
        .slice(0, 3);
      if (keywords.length > 0) {
        const orFilter = keywords.map((k) => `descrizione.ilike.%${k}%`).join(",");
        const { data: rami } = await supabase
          .from("rami")
          .select("id, codice, descrizione, gruppo_ramo_id")
          .or(orFilter)
          .limit(5);
        const r = (rami || [])[0];
        if (r && r.gruppo_ramo_id) {
          result.ramo = {
            gruppoRamoId: r.gruppo_ramo_id,
            ramoId: r.id,
            label: `${r.codice} - ${r.descrizione}`,
          };
        }
      }
    }

    return result;
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File troppo grande (max 15MB)");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      const { data, error } = await supabase.functions.invoke("parse-polizza-completa", {
        body: { fileBase64: b64, mimeType: file.type || "application/pdf" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const parsed: ParsedPolizzaData = (data as any)?.data || {};
      const m = await lookupMatches(parsed);
      setMatch(m);
      toast.success("Documento analizzato");
    } catch (e: any) {
      console.error(e);
      toast.error("Estrazione fallita: " + (e?.message || "errore"));
      setFileName(null);
    } finally {
      setParsing(false);
    }
  };

  const apply = () => {
    if (!match) return;
    onApply(match);
    onOpenChange(false);
    reset();
  };

  const d = match?.data;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600" />
            Importa polizza da PDF (AI)
          </DialogTitle>
          <DialogDescription>
            Carica la scheda di polizza. L'AI riconosce cliente, compagnia, ramo e premi.
            Verifica i dati e applica per pre-compilare il form.
          </DialogDescription>
        </DialogHeader>

        {!match && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileInput.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors",
              dragOver ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30" : "border-muted-foreground/30 hover:border-teal-400",
            )}
          >
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept="application/pdf,image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {parsing ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                <span>Analisi del documento in corso…</span>
                {fileName && <span className="text-xs">{fileName}</span>}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <UploadCloud className="h-10 w-10 text-teal-600" />
                <span className="font-medium">Trascina la scheda di polizza o clicca per selezionare</span>
                <span className="text-xs">PDF o immagini, max 15MB</span>
              </div>
            )}
          </div>
        )}

        {match && d && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium">{fileName}</span>
              <Badge variant="secondary">analizzato</Badge>
            </div>

            {/* CLIENTE */}
            <section className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  Cliente
                  {match.cliente ? (
                    <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Esistente
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300">
                      <UserPlus className="h-3 w-3" /> Nuovo
                    </Badge>
                  )}
                </h3>
              </div>
              {match.cliente ? (
                <p className="text-sm">
                  ✓ Trovato: <strong>{match.cliente.label}</strong>
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Field label="Nome / Ragione Sociale" value={d.contraente_nome} />
                  <Field label="Codice Fiscale" value={d.contraente_codice_fiscale} />
                  <Field label="P.IVA" value={d.contraente_partita_iva} />
                  <Field label="Indirizzo" value={d.contraente_indirizzo} />
                  <Field label="Comune" value={d.contraente_comune} />
                  <Field label="Prov" value={d.contraente_provincia} />
                  <Field label="CAP" value={d.contraente_cap} />
                  <Field label="Nazione" value={d.contraente_nazione} />
                </div>
              )}
              {!match.cliente && (
                <p className="text-xs text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Nessun cliente trovato con questo CF/P.IVA. Dopo "Applica", usa il pulsante
                  "Nuovo Cliente" per crearlo.
                </p>
              )}
            </section>

            {/* COMPAGNIA & RAMO */}
            <section className="border rounded-lg p-3 space-y-2">
              <h3 className="font-semibold text-sm">Compagnia & Ramo</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Compagnia (dal PDF)</div>
                  <div className="font-medium">{d.compagnia || "—"}</div>
                  {match.compagnia ? (
                    <div className="text-teal-700 mt-1">
                      ✓ Match: <strong>{match.compagnia.label}</strong>
                    </div>
                  ) : (
                    <div className="text-amber-700 mt-1">⚠ Nessun match — selezionala manualmente</div>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground">Ramo (suggerito)</div>
                  <div className="font-medium">{d.ramo_descrizione || "—"}</div>
                  {match.ramo ? (
                    <div className="text-teal-700 mt-1">
                      ✓ Mappato: <strong>{match.ramo.label}</strong>
                    </div>
                  ) : (
                    <div className="text-amber-700 mt-1">⚠ Da selezionare manualmente</div>
                  )}
                </div>
                <Field label="Prodotto" value={d.prodotto} />
                <Field label="Numero Polizza" value={d.numero_polizza} />
              </div>
            </section>

            {/* PERIODO */}
            <section className="border rounded-lg p-3">
              <h3 className="font-semibold text-sm mb-2">Periodo</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <Field label="Decorrenza" value={d.decorrenza} />
                <Field label="Scadenza" value={d.scadenza} />
                <Field label="Frazionamento" value={d.frazionamento} />
                <Field label="Tacito rinnovo" value={d.tacito_rinnovo ? "Sì" : "No"} />
              </div>
            </section>

            {/* PREMI */}
            <section className="border rounded-lg p-3">
              <h3 className="font-semibold text-sm mb-2">Premi</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <div className="font-medium text-muted-foreground">Alla Firma</div>
                  <Field label="Netto" value={fmtEur(d.premio_firma_netto)} />
                  <Field label="Imposte" value={fmtEur(d.premio_firma_imposte)} />
                  <Field label="Lordo" value={fmtEur(d.premio_firma_lordo)} bold />
                </div>
                <div className="space-y-1">
                  <div className="font-medium text-muted-foreground">Prossima Quietanza</div>
                  <Field label="Netto" value={fmtEur(d.premio_quietanza_netto)} />
                  <Field label="Imposte" value={fmtEur(d.premio_quietanza_imposte)} />
                  <Field label="Lordo" value={fmtEur(d.premio_quietanza_lordo)} bold />
                </div>
              </div>
            </section>

            {/* GARANZIE */}
            {d.garanzie && d.garanzie.length > 0 && (
              <section className="border rounded-lg p-3">
                <h3 className="font-semibold text-sm mb-2">Garanzie operanti ({d.garanzie.length})</h3>
                <ul className="text-xs space-y-1">
                  {d.garanzie.map((g, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{g.descrizione}</span>
                      {g.massimale != null && (
                        <span className="text-muted-foreground tabular-nums">
                          mass. {fmtEur(g.massimale)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        <DialogFooter>
          {match && (
            <>
              <Button variant="outline" onClick={reset}>Cambia file</Button>
              <Button onClick={apply}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Applica al form
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, bold }: { label: string; value?: string | number | null; bold?: boolean }) {
  return (
    <div>
      <div className="text-muted-foreground text-[11px]">{label}</div>
      <div className={cn(bold && "font-semibold")}>{value || "—"}</div>
    </div>
  );
}
