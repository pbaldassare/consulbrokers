import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileSearch,
  FileText,
  Loader2,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildElaborazionePdf,
  downloadPdf,
  formatValore,
  renderTemplate,
  type CampoCatalogo,
  type ValoriCampi,
} from "@/lib/elaborazioni/render";

interface ClienteRow {
  id: string;
  ragione_sociale: string | null;
  nome: string | null;
  cognome: string | null;
  codice_fiscale: string | null;
  partita_iva: string | null;
}

interface TitoloRow {
  id: string;
  numero_polizza: string | null;
  prodotto_nome: string | null;
  ramo_id: string | null;
  garanzia_da: string | null;
  garanzia_a: string | null;
}

interface DocumentoRow {
  id: string;
  nome_file: string;
  bucket_name: string;
  path_storage: string;
  categoria: string | null;
  entita_id: string;
  created_at: string;
}

const nomeCliente = (c: ClienteRow) =>
  (c.ragione_sociale?.trim() || `${c.cognome ?? ""} ${c.nome ?? ""}`.trim() || "Cliente");

const CORPO_DEFAULT = `RIEPILOGO POLIZZA

Contraente: {{contraente}}
Numero polizza: {{numero_polizza}}
Compagnia: {{compagnia}}
Decorrenza: {{data_effetto}}   Scadenza: {{data_scadenza}}

Garanzie prestate:
{{garanzie}}

Massimale: {{massimale}}   Franchigia: {{franchigia}}
Premio lordo annuo: {{premio_lordo}}

Note: {{note}}`;

const ElaborazioniPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth() as { profile?: { id?: string; ufficio_id?: string | null } | null };

  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteSearchDeb, setClienteSearchDeb] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [titoloId, setTitoloId] = useState("");
  const [documentoId, setDocumentoId] = useState("");
  const [campiSelezionati, setCampiSelezionati] = useState<string[]>([]);
  const [valori, setValori] = useState<ValoriCampi>({});
  const [noteAi, setNoteAi] = useState<string | null>(null);
  const [analizzando, setAnalizzando] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [corpo, setCorpo] = useState(CORPO_DEFAULT);
  const [nomeTemplate, setNomeTemplate] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setClienteSearchDeb(clienteSearch), 350);
    return () => clearTimeout(t);
  }, [clienteSearch]);

  /* ------------------------------------------------------------------ dati */

  const { data: clienti = [] } = useQuery({
    queryKey: ["elab-clienti", clienteSearchDeb],
    queryFn: async () => {
      let q = supabase
        .from("clienti")
        .select("id, ragione_sociale, nome, cognome, codice_fiscale, partita_iva")
        .order("ragione_sociale", { nullsFirst: false })
        .limit(30);
      const s = clienteSearchDeb.trim();
      if (s) {
        q = q.or(
          `ragione_sociale.ilike.%${s}%,cognome.ilike.%${s}%,nome.ilike.%${s}%,codice_fiscale.ilike.%${s}%,partita_iva.ilike.%${s}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ClienteRow[];
    },
  });

  const { data: titoli = [], isLoading: loadingTitoli } = useQuery({
    queryKey: ["elab-titoli", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("id, numero_polizza, prodotto_nome, ramo_id, garanzia_da, garanzia_a")
        .or(`cliente_id.eq.${clienteId},cliente_anagrafica_id.eq.${clienteId}`)
        .order("garanzia_a", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as TitoloRow[];
    },
  });

  const titoloIds = useMemo(() => titoli.map((t) => t.id), [titoli]);

  const { data: documenti = [], isLoading: loadingDoc } = useQuery({
    queryKey: ["elab-documenti", titoloIds],
    enabled: titoloIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documenti")
        .select("id, nome_file, bucket_name, path_storage, categoria, entita_id, created_at")
        .eq("entita_tipo", "titolo")
        .in("entita_id", titoloIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentoRow[];
    },
  });

  const titoliConDocumenti = useMemo(() => {
    const conDoc = new Set(documenti.map((d) => d.entita_id));
    return titoli.filter((t) => conDoc.has(t.id));
  }, [titoli, documenti]);

  const titoloSel = titoli.find((t) => t.id === titoloId) ?? null;

  const { data: rami = [] } = useQuery({
    queryKey: ["elab-rami"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rami").select("id, gruppo_ramo_id, descrizione");
      if (error) throw error;
      return (data ?? []) as { id: string; gruppo_ramo_id: string | null; descrizione: string | null }[];
    },
  });

  const gruppoRamoId = useMemo(
    () => rami.find((r) => r.id === titoloSel?.ramo_id)?.gruppo_ramo_id ?? null,
    [rami, titoloSel],
  );

  const { data: catalogo = [], isLoading: loadingCampi } = useQuery({
    queryKey: ["elab-catalogo", gruppoRamoId],
    queryFn: async () => {
      let q = supabase
        .from("elaborazioni_campi_catalogo")
        .select("id, chiave, etichetta, tipo, descrizione_ai, gruppo_ramo_id, ordine")
        .eq("attivo", true)
        .order("ordine");
      q = gruppoRamoId
        ? q.or(`gruppo_ramo_id.is.null,gruppo_ramo_id.eq.${gruppoRamoId}`)
        : q.is("gruppo_ramo_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CampoCatalogo[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["elab-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elaborazioni_template")
        .select("id, nome, descrizione, gruppo_ramo_id, campi, corpo")
        .eq("attivo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as {
        id: string; nome: string; descrizione: string | null;
        gruppo_ramo_id: string | null; campi: unknown; corpo: string;
      }[];
    },
  });

  const { data: storico = [] } = useQuery({
    queryKey: ["elab-storico", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elaborazioni")
        .select("id, titolo, created_at, stato, titolo_id, contenuto, campi_estratti")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as {
        id: string; titolo: string | null; created_at: string; stato: string;
        titolo_id: string | null; contenuto: string | null; campi_estratti: ValoriCampi;
      }[];
    },
  });

  /* --------------------------------------------------------------- effetti */

  // Preseleziona tutti i campi disponibili quando cambia il catalogo
  useEffect(() => {
    setCampiSelezionati(catalogo.map((c) => c.chiave));
  }, [catalogo]);

  useEffect(() => {
    setTitoloId("");
    setDocumentoId("");
    setValori({});
    setNoteAi(null);
  }, [clienteId]);

  useEffect(() => {
    setDocumentoId("");
    setValori({});
    setNoteAi(null);
  }, [titoloId]);

  const documentiPolizza = useMemo(
    () => documenti.filter((d) => d.entita_id === titoloId),
    [documenti, titoloId],
  );

  const clienteSel = clienti.find((c) => c.id === clienteId) ?? null;
  const campiScelti = useMemo(
    () => catalogo.filter((c) => campiSelezionati.includes(c.chiave)),
    [catalogo, campiSelezionati],
  );

  const anteprima = useMemo(() => renderTemplate(corpo, valori, catalogo), [corpo, valori, catalogo]);

  /* ---------------------------------------------------------------- azioni */

  const toggleCampo = (chiave: string) =>
    setCampiSelezionati((prev) =>
      prev.includes(chiave) ? prev.filter((c) => c !== chiave) : [...prev, chiave],
    );

  const applicaTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setCorpo(t.corpo || CORPO_DEFAULT);
    setNomeTemplate(t.nome);
    const campiT = Array.isArray(t.campi) ? (t.campi as string[]) : [];
    if (campiT.length) setCampiSelezionati(campiT);
  };

  const analizza = async () => {
    const doc = documenti.find((d) => d.id === documentoId);
    if (!doc || campiScelti.length === 0) return;
    setAnalizzando(true);
    setNoteAi(null);
    try {
      const { data: file, error: dlErr } = await supabase.storage
        .from(doc.bucket_name)
        .download(doc.path_storage);
      if (dlErr || !file) throw new Error(dlErr?.message || "Documento non scaricabile");

      const buf = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      const fileBase64 = btoa(binary);
      const mimeType = file.type || (doc.nome_file.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "application/octet-stream");

      const contesto = [
        clienteSel ? `Contraente atteso: ${nomeCliente(clienteSel)}` : null,
        titoloSel?.numero_polizza ? `Numero polizza atteso: ${titoloSel.numero_polizza}` : null,
        titoloSel?.prodotto_nome ? `Prodotto: ${titoloSel.prodotto_nome}` : null,
      ].filter(Boolean).join("\n");

      const { data, error } = await supabase.functions.invoke("elabora-documento-polizza", {
        body: {
          fileBase64,
          mimeType,
          contesto,
          campi: campiScelti.map((c) => ({
            chiave: c.chiave,
            etichetta: c.etichetta,
            tipo: c.tipo,
            descrizione_ai: c.descrizione_ai,
          })),
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);

      const estratti = ((data as { campi?: ValoriCampi })?.campi ?? {}) as ValoriCampi;
      setValori(estratti);
      setNoteAi((data as { note?: string | null })?.note ?? null);
      const trovati = Object.values(estratti).filter((v) => v !== null && v !== "").length;
      toast.success(`Analisi completata: ${trovati} campi estratti su ${campiScelti.length}`);
    } catch (e) {
      toast.error((e as Error).message || "Errore durante l'analisi del documento");
    } finally {
      setAnalizzando(false);
    }
  };

  const salvaTemplate = async () => {
    if (!nomeTemplate.trim()) {
      toast.error("Indica un nome per il template");
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        nome: nomeTemplate.trim(),
        gruppo_ramo_id: gruppoRamoId,
        campi: campiSelezionati,
        corpo,
        created_by: profile?.id ?? null,
        ufficio_id: profile?.ufficio_id ?? null,
      };
      if (templateId) {
        const { error } = await supabase
          .from("elaborazioni_template")
          .update({ nome: payload.nome, campi: payload.campi, corpo: payload.corpo, gruppo_ramo_id: payload.gruppo_ramo_id })
          .eq("id", templateId);
        if (error) throw error;
        toast.success("Template aggiornato");
      } else {
        const { data, error } = await supabase
          .from("elaborazioni_template")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setTemplateId(data.id);
        toast.success("Template salvato");
      }
      queryClient.invalidateQueries({ queryKey: ["elab-templates"] });
    } catch (e) {
      toast.error((e as Error).message || "Errore salvataggio template");
    } finally {
      setSalvando(false);
    }
  };

  const salvaElaborazione = async () => {
    if (!clienteId) return;
    const titolo = `${nomeTemplate.trim() || "Elaborazione"}${titoloSel?.numero_polizza ? ` — ${titoloSel.numero_polizza}` : ""}`;
    const { error } = await supabase.from("elaborazioni").insert({
      cliente_id: clienteId,
      titolo_id: titoloId || null,
      documento_id: documentoId || null,
      template_id: templateId || null,
      gruppo_ramo_id: gruppoRamoId,
      titolo,
      campi_estratti: valori as never,
      contenuto: anteprima,
      stato: "generata",
      created_by: profile?.id ?? null,
      ufficio_id: profile?.ufficio_id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Elaborazione salvata nello storico");
    queryClient.invalidateQueries({ queryKey: ["elab-storico", clienteId] });
  };

  const generaPdf = async () => {
    try {
      const bytes = await buildElaborazionePdf(anteprima, {
        titolo: nomeTemplate.trim() || "Elaborazione polizza",
        cliente: clienteSel ? nomeCliente(clienteSel) : null,
        polizza: titoloSel?.numero_polizza ?? null,
      });
      downloadPdf(bytes, `elaborazione-${titoloSel?.numero_polizza ?? "polizza"}.pdf`);
      await salvaElaborazione();
    } catch (e) {
      toast.error((e as Error).message || "Errore generazione PDF");
    }
  };

  /* ------------------------------------------------------------------- UI */

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Elaborazioni</h1>
          <p className="text-sm text-muted-foreground">
            Analizza con l'IA i documenti già caricati sulle polizze e genera documenti da template
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Selezione */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-primary" /> 1. Cliente, polizza e documento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <SearchableSelect
                options={clienti.map((c) => ({
                  value: c.id,
                  label: nomeCliente(c),
                  description: c.partita_iva || c.codice_fiscale || undefined,
                }))}
                value={clienteId}
                onValueChange={setClienteId}
                searchValue={clienteSearch}
                onSearchChange={setClienteSearch}
                serverSideSearch
                placeholder="Seleziona cliente..."
                searchPlaceholder="Cerca per nome, CF o P.IVA..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Polizza con documenti</Label>
              {loadingTitoli || loadingDoc ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <SearchableSelect
                  options={titoliConDocumenti.map((t) => ({
                    value: t.id,
                    label: `${t.numero_polizza ?? "—"}${t.prodotto_nome ? ` · ${t.prodotto_nome}` : ""}`,
                    description: `${documenti.filter((d) => d.entita_id === t.id).length} documenti`,
                  }))}
                  value={titoloId}
                  onValueChange={setTitoloId}
                  disabled={!clienteId || titoliConDocumenti.length === 0}
                  placeholder={
                    !clienteId
                      ? "Seleziona prima un cliente"
                      : titoliConDocumenti.length === 0
                      ? "Nessuna polizza con documenti"
                      : "Seleziona polizza..."
                  }
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Documento da analizzare</Label>
              <SearchableSelect
                options={documentiPolizza.map((d) => ({
                  value: d.id,
                  label: d.nome_file,
                  description: [d.categoria, new Date(d.created_at).toLocaleDateString("it-IT")]
                    .filter(Boolean)
                    .join(" · "),
                }))}
                value={documentoId}
                onValueChange={setDocumentoId}
                disabled={!titoloId || documentiPolizza.length === 0}
                placeholder={titoloId ? "Seleziona documento..." : "Seleziona prima una polizza"}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label className="text-sm">
                Campi da estrarre{" "}
                <span className="text-muted-foreground font-normal">
                  ({campiSelezionati.length}/{catalogo.length})
                </span>
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCampiSelezionati(
                    campiSelezionati.length === catalogo.length ? [] : catalogo.map((c) => c.chiave),
                  )
                }
              >
                {campiSelezionati.length === catalogo.length ? "Deseleziona tutti" : "Seleziona tutti"}
              </Button>
            </div>

            {loadingCampi ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ScrollArea className="h-52 rounded-md border border-border p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {catalogo.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-start gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-accent/40"
                    >
                      <Checkbox
                        checked={campiSelezionati.includes(c.chiave)}
                        onCheckedChange={() => toggleCampo(c.chiave)}
                        className="mt-0.5"
                      />
                      <span>
                        {c.etichetta}
                        {c.gruppo_ramo_id && (
                          <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">
                            ramo
                          </Badge>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}

            <Button
              onClick={analizza}
              disabled={!documentoId || campiScelti.length === 0 || analizzando}
              className="w-full"
            >
              {analizzando ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisi in corso…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Analizza documento con IA</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 2. Campi estratti */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" /> 2. Campi estratti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {noteAi && <p className="text-xs text-muted-foreground italic">{noteAi}</p>}
            {Object.keys(valori).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nessun campo estratto. Seleziona un documento e avvia l'analisi IA.
              </p>
            ) : (
              <ScrollArea className="h-[420px] pr-3">
                <div className="space-y-3">
                  {campiScelti.map((c) => (
                    <div key={c.chiave} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {c.etichetta} <code className="ml-1">{`{{${c.chiave}}}`}</code>
                      </Label>
                      <Input
                        value={formatValore(valori[c.chiave], c.tipo)}
                        onChange={(e) =>
                          setValori((prev) => ({ ...prev, [c.chiave]: e.target.value }))
                        }
                        placeholder="—"
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Template */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> 3. Template e documento generato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Template esistente</Label>
              <SearchableSelect
                options={templates.map((t) => ({ value: t.id, label: t.nome, description: t.descrizione ?? undefined }))}
                value={templateId}
                onValueChange={applicaTemplate}
                clearable
                clearLabel="— Nuovo template —"
                placeholder="Nuovo template"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome template</Label>
              <Input
                value={nomeTemplate}
                onChange={(e) => setNomeTemplate(e.target.value)}
                placeholder="Es. Riepilogo polizza RCA"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={salvaTemplate} disabled={salvando} className="flex-1">
                {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salva template
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Corpo del template (usa i segnaposto {`{{campo}}`})</Label>
              <Textarea
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                rows={18}
                className="font-mono text-xs"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {campiScelti.map((c) => (
                  <button
                    key={c.chiave}
                    type="button"
                    onClick={() => setCorpo((p) => `${p}{{${c.chiave}}}`)}
                    className="text-[11px] rounded border border-border px-1.5 py-0.5 hover:bg-accent"
                  >
                    {`{{${c.chiave}}}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Anteprima</Label>
              <div className="rounded-md border border-border bg-card p-4 h-[430px] overflow-auto whitespace-pre-wrap text-sm">
                {anteprima}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={salvaElaborazione} disabled={!clienteId}>
              <Save className="w-4 h-4 mr-2" /> Salva elaborazione
            </Button>
            <Button onClick={generaPdf} disabled={!clienteId}>
              <FileText className="w-4 h-4 mr-2" /> Genera PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Storico */}
      {clienteId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Storico elaborazioni del cliente</CardTitle>
          </CardHeader>
          <CardContent>
            {storico.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nessuna elaborazione salvata per questo cliente.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storico.map((s, i) => (
                    <TableRow key={s.id} className={i % 2 ? "bg-muted/30" : undefined}>
                      <TableCell>{new Date(s.created_at).toLocaleString("it-IT")}</TableCell>
                      <TableCell>{s.titolo ?? "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{s.stato}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCorpo(s.contenuto ?? "");
                            setValori(s.campi_estratti ?? {});
                            toast.info("Elaborazione caricata nell'editor");
                          }}
                        >
                          Riapri
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ElaborazioniPage;
