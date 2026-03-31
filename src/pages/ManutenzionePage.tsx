import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, Bell, Loader2, CheckCircle, ShieldCheck, Users, Upload, Database } from "lucide-react";
import { toast } from "sonner";

interface JobResult {
  label: string;
  result: any;
  error?: string;
}

// Helper to parse Excel date serial numbers or date strings
const parseExcelDate = (val: any): string | null => {
  if (!val) return null;
  if (typeof val === "number") {
    // Excel serial date
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().split("T")[0];
  }
  if (val instanceof Date) return val.toISOString().split("T")[0];
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
  }
  return null;
};

const ManutenzionePage = () => {
  const [results, setResults] = useState<JobResult[]>([]);
  const [importStatus, setImportStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshKpi = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("refresh_cfo_kpi_mensili" as any);
      if (error) throw error;
      await logAttivita({ azione: "refresh_kpi_manuale", entita_tipo: "manutenzione", entita_id: "00000000-0000-0000-0000-000000000000" });
    },
    onSuccess: () => { setResults(prev => [...prev, { label: "Refresh KPI CFO", result: { stato: "completato" } }]); toast.success("KPI aggiornati con successo"); },
    onError: (e: any) => { setResults(prev => [...prev, { label: "Refresh KPI CFO", result: null, error: e.message }]); toast.error("Errore"); },
  });

  const checkScadenze = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("segna_eventi_sinistri_scaduti" as any);
      if (error) throw error;
      await logAttivita({ azione: "controllo_scadenze_sinistri", entita_tipo: "manutenzione", entita_id: "00000000-0000-0000-0000-000000000000", dettagli_json: data as any });
      return data;
    },
    onSuccess: (data) => { setResults(prev => [...prev, { label: "Scadenze Sinistri", result: data }]); toast.success("Controllo scadenze completato"); },
    onError: (e: any) => { setResults(prev => [...prev, { label: "Scadenze Sinistri", result: null, error: e.message }]); toast.error("Errore"); },
  });

  const archiviaNotifiche = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("archivia_notifiche_vecchie" as any);
      if (error) throw error;
      await logAttivita({ azione: "archiviazione_notifiche", entita_tipo: "manutenzione", entita_id: "00000000-0000-0000-0000-000000000000", dettagli_json: data as any });
      return data;
    },
    onSuccess: (data) => { setResults(prev => [...prev, { label: "Archiviazione Notifiche", result: data }]); toast.success("Notifiche archiviate"); },
    onError: (e: any) => { setResults(prev => [...prev, { label: "Archiviazione Notifiche", result: null, error: e.message }]); toast.error("Errore"); },
  });

  const runQuality = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("run_data_quality_checks" as any);
      if (error) throw error;
      await logAttivita({ azione: "controllo_qualita_dati", entita_tipo: "manutenzione", entita_id: "00000000-0000-0000-0000-000000000000", dettagli_json: data as any });
      return data;
    },
    onSuccess: (data: any) => { setResults(prev => [...prev, { label: "Controlli Qualità Dati", result: data }]); toast.success("Controlli qualità completati", { description: `${data?.totale_nuove || 0} nuove anomalie` }); },
    onError: (e: any) => { setResults(prev => [...prev, { label: "Controlli Qualità Dati", result: null, error: e.message }]); toast.error("Errore"); },
  });

  const provisionClienti = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.functions.invoke("provision-clienti-users"); if (error) throw error; return data; },
    onSuccess: (data: any) => { setResults(prev => [...prev, { label: "Provisioning Clienti", result: data }]); toast.success("Provisioning completato", { description: `${data?.creati || 0} utenti creati, ${data?.errori || 0} errori` }); },
    onError: (e: any) => { setResults(prev => [...prev, { label: "Provisioning Clienti", result: null, error: e.message }]); toast.error("Errore"); },
  });

  const provisionCorrispondenti = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.functions.invoke("provision-corrispondenti-users"); if (error) throw error; return data; },
    onSuccess: (data: any) => { setResults(prev => [...prev, { label: "Provisioning Corrispondenti", result: data }]); toast.success("Provisioning completato", { description: `${data?.creati || 0} utenti creati, ${data?.errori || 0} errori` }); },
    onError: (e: any) => { setResults(prev => [...prev, { label: "Provisioning Corrispondenti", result: null, error: e.message }]); toast.error("Errore"); },
  });

  const importClienti = useMutation({
    mutationFn: async (file: File) => {
      setImportStatus("Leggendo file Excel...");
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

      setImportStatus(`Trovati ${rows.length} record. Preparando dati...`);

      const clienti: any[] = [];
      const codici_commerciali: any[] = [];

      for (const row of rows) {
        const codice = row["Codice"] ? String(row["Codice"]).padStart(6, "0") : null;
        const tipo = row["F/G"] || "F";
        
        clienti.push({
          codice,
          nome: row["Nome"] || null,
          indirizzo: row["Indirizzo"] || null,
          cap: row["Cap"] ? String(row["Cap"]) : null,
          comune: row["Comune"] || null,
          prov: row["Prov"] || null,
          tel: row["Tel"] ? String(row["Tel"]) : null,
          email: row["Email"] || null,
          atten_di: row["AttenDi"] || null,
          tipo,
          cf: row["CF"] || null,
          piva: row["PIva"] ? String(row["PIva"]) : null,
          gru_stat: row["GruStat"] || null,
          gru_fin: row["GruFin"] || null,
          indotto: row["Indotto"] || null,
          zona: row["Zona"] || null,
          attivita: row["Attivita"] || null,
          specialist_sx: row["SpecialistSX"] || null,
          stato: row["Stato"] || "Attivo",
          fatturato: row["Fatturato"] || null,
          dipendenti: row["Dipendenti"] ? String(row["Dipendenti"]) : null,
        });

        codici_commerciali.push({
          codice,
          brand: row["Brand"] || "Consulbrokers",
          unit: row["Unit"] || null,
          specialist: row["Specialist"] || null,
          prod1: row["Prod1"] || null,
          prod2: row["Prod2"] || null,
          prod3: row["Prod3"] || null,
          acquisito: parseExcelDate(row["Acquisito"]),
          scad_mandato: parseExcelDate(row["ScadMandato"]),
        });
      }

      setImportStatus(`Inviando ${clienti.length} clienti alla Edge Function...`);

      const { data, error } = await supabase.functions.invoke("import-clienti", {
        body: { action: "replace_all", clienti, codici_commerciali },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      setImportStatus("");
      setResults(prev => [...prev, { label: "Reimportazione Clienti Napoli", result: data }]);
      toast.success("Reimportazione completata!", {
        description: `${data?.clienti_inseriti || 0} clienti, ${data?.cc_inseriti || 0} codici comm., ${data?.gf_creati || 0} gruppi fin.`,
      });
    },
    onError: (e: any) => {
      setImportStatus("");
      setResults(prev => [...prev, { label: "Reimportazione Clienti Napoli", result: null, error: e.message }]);
      toast.error("Errore reimportazione", { description: e.message });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(`Stai per reimportare TUTTI i clienti dal file "${file.name}".\n\nQuesta operazione:\n- Cancellerà TUTTI i clienti esistenti\n- Cancellerà tutti i codici commerciali\n- Reinserirà i clienti dal file Excel\n\nSei sicuro?`)) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    importClienti.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isAnyRunning = refreshKpi.isPending || checkScadenze.isPending || archiviaNotifiche.isPending || runQuality.isPending || provisionClienti.isPending || provisionCorrispondenti.isPending || importClienti.isPending;

  const runAll = async () => {
    setResults([]);
    await refreshKpi.mutateAsync().catch(() => {});
    await checkScadenze.mutateAsync().catch(() => {});
    await archiviaNotifiche.mutateAsync().catch(() => {});
    await runQuality.mutateAsync().catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manutenzione</h1>
        <p className="text-muted-foreground text-sm">Operazioni di manutenzione e job schedulati manuali</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh KPI CFO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Aggiorna la materialized view dei KPI mensili per la dashboard CFO.</p>
            <Button size="sm" onClick={() => refreshKpi.mutate()} disabled={isAnyRunning}>
              {refreshKpi.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Scadenze Sinistri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Marca come scaduti gli eventi sinistri con data superata.</p>
            <Button size="sm" onClick={() => checkScadenze.mutate()} disabled={isAnyRunning}>
              {checkScadenze.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" /> Archivia Notifiche
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Elimina notifiche lette più vecchie di 90 giorni.</p>
            <Button size="sm" onClick={() => archiviaNotifiche.mutate()} disabled={isAnyRunning}>
              {archiviaNotifiche.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Bell className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Controlli Qualità Dati
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Esegui tutti i controlli di data quality e genera anomalie per incongruenze trovate.</p>
            <Button size="sm" onClick={() => runQuality.mutate()} disabled={isAnyRunning}>
              {runQuality.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Provisioning Clienti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Crea utenti auth per tutti i clienti senza account. Password default: Leone123!</p>
            <Button size="sm" onClick={() => provisionClienti.mutate()} disabled={isAnyRunning}>
              {provisionClienti.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Users className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Provisioning Corrispondenti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Crea utenti auth per tutti i corrispondenti in anagrafica. Password default: Leone123!</p>
            <Button size="sm" onClick={() => provisionCorrispondenti.mutate()} disabled={isAnyRunning}>
              {provisionCorrispondenti.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Users className="w-4 h-4 mr-1" />} Esegui
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" /> Reimporta Clienti Napoli
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Carica il file Excel Clienti_Napoli.xlsx per reimportare tutti i clienti con codici commerciali e relazioni.
              <span className="text-destructive font-medium"> Cancella tutti i clienti esistenti!</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              size="sm"
              variant="destructive"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnyRunning}
            >
              {importClienti.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              Carica Excel
            </Button>
            {importStatus && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> {importStatus}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Button onClick={runAll} disabled={isAnyRunning} variant="outline">
        {isAnyRunning ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
        Esegui Tutti
      </Button>

      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Risultati</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                {r.error ? (
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.label}</p>
                  {r.error ? (
                    <p className="text-xs text-destructive">{r.error}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{JSON.stringify(r.result)}</p>
                  )}
                </div>
                <Badge variant={r.error ? "destructive" : "default"} className="text-[10px]">
                  {r.error ? "Errore" : "OK"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ManutenzionePage;
