import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Download, Save, Play, Bookmark, BarChart3 } from "lucide-react";
import { format } from "date-fns";

interface ReportConfig {
  tipo: string;
  label: string;
  filtri: { key: string; label: string; type: "date" | "select" | "checkbox" }[];
  colonne: { key: string; label: string; align?: string; format?: string }[];
  rpcName: string;
}

const REPORT_CONFIGS: ReportConfig[] = [
  {
    tipo: "titoli",
    label: "Titoli Incassati",
    rpcName: "report_titoli_incassati",
    filtri: [
      { key: "_data_da", label: "Data Da", type: "date" },
      { key: "_data_a", label: "Data A", type: "date" },
      { key: "_ufficio_id", label: "Ufficio", type: "select" },
      { key: "_compagnia_id", label: "Compagnia", type: "select" },
    ],
    colonne: [
      { key: "numero_titolo", label: "N. Titolo" },
      { key: "cliente", label: "Cliente" },
      { key: "prodotto", label: "Prodotto" },
      { key: "compagnia", label: "Compagnia" },
      { key: "ufficio", label: "Ufficio" },
      { key: "premio_lordo", label: "Premio Lordo", align: "right", format: "euro" },
      { key: "importo_incassato", label: "Incassato", align: "right", format: "euro" },
      { key: "data_incasso", label: "Data Incasso", format: "date" },
    ],
  },
  {
    tipo: "provvigioni",
    label: "Provvigioni per Produttore",
    rpcName: "report_provvigioni_produttore",
    filtri: [
      { key: "_data_da", label: "Data Da", type: "date" },
      { key: "_data_a", label: "Data A", type: "date" },
      { key: "_user_id", label: "Produttore", type: "select" },
      { key: "_solo_non_pagate", label: "Solo non pagate", type: "checkbox" },
    ],
    colonne: [
      { key: "produttore", label: "Produttore" },
      { key: "numero_titolo", label: "Titolo" },
      { key: "prodotto", label: "Prodotto" },
      { key: "premio_lordo", label: "Premio", align: "right", format: "euro" },
      { key: "percentuale", label: "%", align: "right" },
      { key: "importo_provvigione", label: "Provvigione", align: "right", format: "euro" },
      { key: "pagata", label: "Pagata", format: "boolean" },
      { key: "calcolata_il", label: "Data", format: "date" },
    ],
  },
  {
    tipo: "contabilita",
    label: "Contabilità Entrate/Uscite",
    rpcName: "report_contabilita",
    filtri: [
      { key: "_data_da", label: "Data Da", type: "date" },
      { key: "_data_a", label: "Data A", type: "date" },
      { key: "_ufficio_id", label: "Ufficio", type: "select" },
      { key: "_categoria", label: "Categoria", type: "select" },
    ],
    colonne: [
      { key: "data_movimento", label: "Data", format: "date" },
      { key: "tipo", label: "Tipo" },
      { key: "categoria", label: "Categoria" },
      { key: "descrizione", label: "Descrizione" },
      { key: "importo", label: "Importo", align: "right", format: "euro" },
      { key: "ufficio", label: "Ufficio" },
      { key: "stato", label: "Stato" },
    ],
  },
  {
    tipo: "sinistri",
    label: "Sinistri",
    rpcName: "report_sinistri",
    filtri: [
      { key: "_data_da", label: "Data Da", type: "date" },
      { key: "_data_a", label: "Data A", type: "date" },
      { key: "_ufficio_id", label: "Ufficio", type: "select" },
      { key: "_stato", label: "Stato", type: "select" },
    ],
    colonne: [
      { key: "numero_sinistro", label: "N. Sinistro" },
      { key: "stato", label: "Stato" },
      { key: "cliente", label: "Cliente" },
      { key: "compagnia", label: "Compagnia" },
      { key: "responsabile", label: "Responsabile" },
      { key: "data_apertura", label: "Apertura", format: "date" },
      { key: "data_chiusura", label: "Chiusura", format: "date" },
      { key: "eventi_scaduti", label: "Ev. Scaduti", align: "right" },
      { key: "ufficio", label: "Ufficio" },
    ],
  },
  {
    tipo: "banca",
    label: "Banca KO Aperti",
    rpcName: "report_banca_ko",
    filtri: [
      { key: "_ufficio_id", label: "Ufficio", type: "select" },
    ],
    colonne: [
      { key: "created_at", label: "Data KO", format: "date" },
      { key: "desc_estratto", label: "Desc. Estratto" },
      { key: "importo_estratto", label: "Imp. Estratto", align: "right", format: "euro" },
      { key: "desc_movimento", label: "Desc. Movimento" },
      { key: "importo_movimento", label: "Imp. Movimento", align: "right", format: "euro" },
      { key: "differenza", label: "Differenza", align: "right", format: "euro" },
      { key: "giorni_apertura", label: "Giorni", align: "right", format: "int" },
      { key: "note", label: "Note" },
    ],
  },
];

const ReportPage = () => {
  const queryClient = useQueryClient();
  const [tipoReport, setTipoReport] = useState("titoli");
  const [filtri, setFiltri] = useState<Record<string, any>>({});
  const [risultati, setRisultati] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [nomeReport, setNomeReport] = useState("");

  const config = REPORT_CONFIGS.find((c) => c.tipo === tipoReport)!;

  // Lookup data
  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici_report"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie_report"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: utenti = [] } = useQuery({
    queryKey: ["utenti_report"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      return data || [];
    },
  });

  const { data: reportSalvati = [] } = useQuery({
    queryKey: ["report_salvati"],
    queryFn: async () => {
      const { data } = await supabase.from("report_salvati").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const statiSinistri = ["aperto", "in_lavorazione", "chiuso", "riaperto"];

  const getSelectOptions = (key: string) => {
    if (key === "_ufficio_id") return uffici.map((u: any) => ({ value: u.id, label: u.nome_ufficio }));
    if (key === "_compagnia_id") return compagnie.map((c: any) => ({ value: c.id, label: c.nome }));
    if (key === "_user_id") return utenti.map((u: any) => ({ value: u.id, label: `${u.cognome} ${u.nome}` }));
    if (key === "_stato") return statiSinistri.map((s) => ({ value: s, label: s }));
    if (key === "_categoria") return ["premi", "provvigioni", "spese", "rimborsi", "altro"].map((c) => ({ value: c, label: c }));
    return [];
  };

  const MAX_ROWS = 5000;

  const genera = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      config.filtri.forEach((f) => {
        const val = filtri[f.key];
        if (val !== undefined && val !== "" && val !== null) {
          params[f.key] = val;
        }
      });
      const { data, error } = await supabase.rpc(config.rpcName as any, params as any);
      if (error) throw error;
      const parsed = Array.isArray(data) ? data : data ? JSON.parse(data) : [];
      if (parsed.length >= MAX_ROWS) {
        toast.error(`Troppi risultati (${parsed.length}+). Restringi i filtri per ottenere dati più precisi.`);
        setRisultati(parsed.slice(0, MAX_ROWS));
      } else {
        setRisultati(parsed);
      }
    } catch (e: any) {
      toast.error(e.message);
      setRisultati([]);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    if (!risultati || risultati.length === 0) return;
    const header = config.colonne.map((c) => c.label).join(",");
    const rows = risultati.map((r) =>
      config.colonne.map((c) => {
        const v = r[c.key];
        if (v === null || v === undefined) return "";
        if (c.format === "euro") return Number(v).toFixed(2);
        if (c.format === "boolean") return v ? "Sì" : "No";
        if (c.format === "date" && v) return format(new Date(v), "dd/MM/yyyy");
        if (c.format === "int") return Math.round(Number(v));
        return String(v).replace(/,/g, ";");
      }).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${config.tipo}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    await logAttivita({
      azione: "esportazione_report",
      entita_tipo: "report",
      entita_id: config.tipo,
      dettagli_json: { tipo: config.tipo, righe: risultati.length },
    });
    toast.success("CSV esportato");
  };

  const salvaConfig = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");
      const { error } = await supabase.from("report_salvati").insert({
        nome: nomeReport,
        tipo_report: tipoReport,
        filtri_json: filtri as any,
        creato_da: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurazione salvata");
      setSaveDialogOpen(false);
      setNomeReport("");
      queryClient.invalidateQueries({ queryKey: ["report_salvati"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const caricaReport = (r: any) => {
    setTipoReport(r.tipo_report);
    setFiltri(r.filtri_json || {});
    setRisultati(null);
    toast.info(`Caricato: ${r.nome}`);
  };

  const formatCell = (value: any, col: ReportConfig["colonne"][0]) => {
    if (value === null || value === undefined) return "-";
    if (col.format === "euro") return `€${Number(value).toFixed(2)}`;
    if (col.format === "boolean") return value ? "Sì" : "No";
    if (col.format === "date" && value) {
      try { return format(new Date(value), "dd/MM/yyyy"); } catch { return value; }
    }
    if (col.format === "int") return Math.round(Number(value));
    return String(value);
  };

  // Aggregazioni
  const aggregazioni = useMemo(() => {
    if (!risultati || risultati.length === 0) return null;
    const euroCols = config.colonne.filter((c) => c.format === "euro");
    if (euroCols.length === 0) return null;
    const agg: Record<string, number> = {};
    euroCols.forEach((c) => {
      agg[c.key] = risultati.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    });
    return agg;
  }, [risultati, config]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Report</h1>
          <p className="text-muted-foreground text-sm">Generazione report centralizzata</p>
        </div>
      </div>

      {/* Tipo report + report salvati */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configurazione</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tipo Report</Label>
              <Select value={tipoReport} onValueChange={(v) => { setTipoReport(v); setFiltri({}); setRisultati(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_CONFIGS.map((c) => (
                    <SelectItem key={c.tipo} value={c.tipo}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {config.filtri.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  {f.type === "date" && (
                    <Input
                      type="date"
                      value={filtri[f.key] || ""}
                      onChange={(e) => setFiltri({ ...filtri, [f.key]: e.target.value || undefined })}
                    />
                  )}
                  {f.type === "select" && (
                    <Select value={filtri[f.key] || ""} onValueChange={(v) => setFiltri({ ...filtri, [f.key]: v || undefined })}>
                      <SelectTrigger><SelectValue placeholder="Tutti" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Tutti</SelectItem>
                        {getSelectOptions(f.key).map((o: any) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {f.type === "checkbox" && (
                    <div className="flex items-center gap-2 mt-2">
                      <Checkbox
                        checked={!!filtri[f.key]}
                        onCheckedChange={(c) => setFiltri({ ...filtri, [f.key]: c ? true : undefined })}
                      />
                      <span className="text-sm">{f.label}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={genera} disabled={loading}>
                <Play className="w-4 h-4 mr-2" />{loading ? "Generazione..." : "Genera Report"}
              </Button>
              {risultati && risultati.length > 0 && (
                <Button variant="outline" onClick={exportCSV}>
                  <Download className="w-4 h-4 mr-2" />Esporta CSV
                </Button>
              )}
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Save className="w-4 h-4 mr-2" />Salva Config</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Salva configurazione report</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Nome</Label>
                      <Input value={nomeReport} onChange={(e) => setNomeReport(e.target.value)} placeholder="es. Report mensile titoli" />
                    </div>
                    <Button onClick={() => salvaConfig.mutate()} disabled={!nomeReport || salvaConfig.isPending}>
                      {salvaConfig.isPending ? "Salvataggio..." : "Salva"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Report salvati */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Bookmark className="w-4 h-4" />Salvati</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-64 overflow-y-auto">
            {reportSalvati.length === 0 && <p className="text-xs text-muted-foreground">Nessun report salvato</p>}
            {reportSalvati.map((r: any) => (
              <button
                key={r.id}
                onClick={() => caricaReport(r)}
                className="w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-medium truncate">{r.nome}</p>
                <p className="text-xs text-muted-foreground">{REPORT_CONFIGS.find((c) => c.tipo === r.tipo_report)?.label}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Aggregazioni */}
      {aggregazioni && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(aggregazioni).map(([key, val]) => {
            const col = config.colonne.find((c) => c.key === key);
            return (
              <Card key={key}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm text-muted-foreground">{col?.label || key}</CardTitle>
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><p className="text-xl font-bold">€{val.toFixed(2)}</p></CardContent>
              </Card>
            );
          })}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Righe</CardTitle>
            </CardHeader>
            <CardContent><p className="text-xl font-bold">{risultati?.length || 0}</p></CardContent>
          </Card>
        </div>
      )}

      {/* Tabella risultati */}
      {risultati !== null && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {config.colonne.map((c) => (
                      <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>{c.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {risultati.map((r, i) => (
                    <TableRow key={i}>
                      {config.colonne.map((c) => (
                        <TableCell key={c.key} className={c.align === "right" ? "text-right" : ""}>
                          {c.format === "boolean" ? (
                            <Badge variant={r[c.key] ? "default" : "outline"}>{r[c.key] ? "Sì" : "No"}</Badge>
                          ) : (
                            formatCell(r[c.key], c)
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {risultati.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={config.colonne.length} className="text-center text-muted-foreground py-12">
                        Nessun risultato trovato per i filtri selezionati
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportPage;
