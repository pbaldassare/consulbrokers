import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Search, Landmark, ExternalLink, CalendarIcon, Filter, Bot, Loader2, X, ChevronDown, MapPin, Link2, History, Building, FileDown, FileText, Plus, Zap, Tag, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface BandoResult {
  id: string;
  titolo: string;
  ente: string;
  ente_tipo?: string | null;
  importo: number | null;
  scadenza: string | null;
  stato: "aperto" | "scaduto" | "in_valutazione";
  dataPublicazione: string;
  link: string | null;
  categoria: string | null;
  scheda_id?: string | null;
  cig?: string | null;
  localita?: string | null;
  regione?: string | null;
  trattative_count?: number;
  pdf_url?: string | null;
  pdf_path?: string | null;
  keyword?: string | null;
}

const regioniItaliane = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
  "Friuli Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
  "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia",
  "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

const KEYWORD_FISSA = "Brokeraggio assicurativo";
const POLL_INTERVAL_MS = 30000;
const MAX_POLL_TIME_MS = 10 * 60 * 1000;
const START_RETRY_FALLBACK_SECONDS = 15;
const MAX_START_WAIT_MS = 2 * 60 * 1000;

const statoBadgeVariant = (stato: string) => {
  switch (stato) {
    case "aperto": return "default";
    case "scaduto": return "destructive";
    case "in_valutazione": return "secondary";
    default: return "outline";
  }
};

const statoLabel = (stato: string) => {
  switch (stato) {
    case "aperto": return "Aperto";
    case "scaduto": return "Scaduto";
    case "in_valutazione": return "In valutazione";
    default: return stato;
  }
};

// Upsert bandi into DB with keyword
async function upsertBandiToDB(bandi: BandoResult[], keyword: string) {
  const rows = bandi
    .filter((b) => b.scheda_id)
    .map((b) => {
      let scadenzaDate: string | null = null;
      if (b.scadenza) {
        const parts = b.scadenza.split("/");
        if (parts.length === 3) {
          scadenzaDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      return {
        scheda_id: b.scheda_id!,
        titolo: b.titolo || null,
        oggetto: b.titolo || null,
        ente: b.ente || null,
        ente_tipo: b.ente_tipo || null,
        tipologia: b.categoria || null,
        importo: b.importo ?? null,
        scadenza: scadenzaDate,
        cig: b.cig || null,
        link: b.link || null,
        localita: b.localita || null,
        regione: b.regione || null,
        stato: b.stato || "aperto",
        pdf_url: b.pdf_url || null,
        keyword: keyword,
      };
    });

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("bandi_pubblici")
    .upsert(rows, { onConflict: "scheda_id", ignoreDuplicates: false });

  if (error) {
    console.error("Upsert bandi error:", error);
    throw error;
  }
  return rows.length;
}

// Auto-create prospects from enti
async function autoCreateProspects(bandi: BandoResult[], ufficio_id: string | undefined) {
  const entiUnici = [...new Set(bandi.map(b => b.ente).filter(Boolean))];
  let created = 0;
  for (const ente of entiUnici) {
    // Check if already exists
    const { data: existing } = await supabase
      .from("prospect")
      .select("id")
      .eq("ragione_sociale", ente)
      .limit(1);
    
    if (existing && existing.length > 0) continue;

    const { error } = await supabase.from("prospect").insert({
      ragione_sociale: ente,
      tipo_cliente: "ente",
      fonte: "API Mondoappalti",
      stato: "nuovo",
      ufficio_id: ufficio_id || null,
    });
    if (!error) created++;
  }
  return created;
}

async function logRicerca(regioni: string[], count: number, userId: string | undefined) {
  await supabase.from("ricerche_bandi").insert({
    regioni,
    risultati_count: count,
    eseguita_da: userId || null,
  });
}

export default function BandiPubbliciPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [regioniSelezionate, setRegioniSelezionate] = useState<string[]>([]);
  const [importoMin, setImportoMin] = useState("");
  const [importoMax, setImportoMax] = useState("");
  const [statoBando, setStatoBando] = useState<string>("");
  const [dataDa, setDataDa] = useState<Date>();
  const [dataA, setDataA] = useState<Date>();
  const [risultatiLive, setRisultatiLive] = useState<BandoResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [fonte, setFonte] = useState("mondoappalti");
  const [regioniOpen, setRegioniOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [sessionsStatus, setSessionsStatus] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [showStoria, setShowStoria] = useState(false);
  const [apiCallCount, setApiCallCount] = useState(0);

  // Dialog crea trattativa
  const [creaTrattativaOpen, setCreaTrattativaOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creatingTrattativa, setCreatingTrattativa] = useState(false);
  const [selectedBando, setSelectedBando] = useState<any>(null);
  const [trattativaProdotto, setTrattativaProdotto] = useState("");
  const [trattativaNote, setTrattativaNote] = useState("");
  const [trattativaPremio, setTrattativaPremio] = useState("");
  const [trattativaScadenza, setTrattativaScadenza] = useState("");

  const pollingRef = useRef(false);
  const searchActiveRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load bandi from DB
  const { data: bandiDB = [], refetch: refetchBandi } = useQuery({
    queryKey: ["bandi_pubblici", statoBando],
    queryFn: async () => {
      let query = supabase
        .from("bandi_pubblici")
        .select("*, bandi_trattative(id, trattativa_id)")
        .order("created_at", { ascending: false });

      if (statoBando && statoBando !== "tutti") {
        query = query.eq("stato", statoBando);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((b: any) => ({
        ...b,
        trattative_count: b.bandi_trattative?.length || 0,
      }));
    },
  });

  // Load ricerche recenti
  const { data: ricercheRecenti = [] } = useQuery({
    queryKey: ["ricerche_bandi_recenti"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ricerche_bandi")
        .select("*, profiles:eseguita_da(nome, cognome)")
        .order("eseguita_il", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const toggleRegione = (regione: string) => {
    setRegioniSelezionate((prev) =>
      prev.includes(regione) ? prev.filter((r) => r !== regione) : [...prev, regione]
    );
  };

  const toggleTutte = () => {
    if (regioniSelezionate.length === regioniItaliane.length) {
      setRegioniSelezionate([]);
    } else {
      setRegioniSelezionate([...regioniItaliane]);
    }
  };

  const removeRegione = (regione: string) => {
    setRegioniSelezionate((prev) => prev.filter((r) => r !== regione));
  };

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    searchActiveRef.current = false;
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
  }, []);

  useEffect(() => { return () => stopPolling(); }, [stopPolling]);

  const waitForRetrySlot = useCallback(async (ms: number) => {
    const end = Date.now() + ms;
    while (searchActiveRef.current && Date.now() < end) {
      const remaining = end - Date.now();
      await new Promise((resolve) => setTimeout(resolve, Math.min(500, Math.max(50, remaining))));
    }
  }, []);

  const cercaBandi = async () => {
    stopPolling();
    searchActiveRef.current = true;
    setLoading(true);
    setHasSearched(true);
    setRisultatiLive([]);
    setElapsedSeconds(0);
    setSearchError(null);
    setProgressMsg("Avvio ricerca...");
    setSessionsStatus({ done: 0, total: 0 });
    setApiCallCount(prev => prev + 1);

    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const requestBody = {
        regioni: regioniSelezionate.length > 0 ? regioniSelezionate : undefined,
        importoMin: importoMin || undefined,
        importoMax: importoMax || undefined,
        statoBando: statoBando || undefined,
        dataDa: dataDa ? format(dataDa, "yyyy-MM-dd") : undefined,
        dataA: dataA ? format(dataA, "yyyy-MM-dd") : undefined,
        fonte,
      };

      const startDeadline = Date.now() + MAX_START_WAIT_MS;
      let startData: any = null;
      let attempt = 0;

      while (searchActiveRef.current && Date.now() < startDeadline) {
        attempt += 1;
        const { data, error } = await supabase.functions.invoke("cerca-bandi", {
          body: { action: "start", ...requestBody },
        });
        if (!searchActiveRef.current) return;
        if (error) throw error;
        if (data?.retryable && (!data?.sessionIds || data.sessionIds.length === 0)) {
          const retryAfterSeconds = Math.max(5, Number(data?.retryAfterSeconds) || START_RETRY_FALLBACK_SECONDS);
          const secondsRemaining = Math.max(0, Math.ceil((startDeadline - Date.now()) / 1000));
          setProgressMsg(`Browser Use occupato, riprovo tra ${retryAfterSeconds}s (tentativo ${attempt}, ${secondsRemaining}s residui)`);
          await waitForRetrySlot(Math.min(retryAfterSeconds * 1000, Math.max(0, startDeadline - Date.now())));
          continue;
        }
        startData = data;
        break;
      }

      if (!searchActiveRef.current) return;
      if (!startData) throw new Error("Browser Use è temporaneamente occupato. Riprova tra poco.");

      const sessionIds: string[] = startData?.sessionIds || [];
      const totalBatches = startData?.totalBatches || sessionIds.length;
      if (sessionIds.length === 0) throw new Error("Nessuna sessione avviata");

      setSessionsStatus({ done: 0, total: totalBatches });
      setProgressMsg(`Ricerca avviata: ${totalBatches} sessione/i`);

      pollingRef.current = true;
      const pollStart = Date.now();

      const poll = async () => {
        if (!pollingRef.current || !searchActiveRef.current) return;
        if (Date.now() - pollStart > MAX_POLL_TIME_MS) {
          stopPolling();
          setLoading(false);
          setSearchError("La ricerca ha superato il tempo massimo. Riprova tra poco o con meno filtri.");
          return;
        }

        try {
          const { data: statusData, error: statusError } = await supabase.functions.invoke("cerca-bandi", {
            body: { action: "status", sessionIds },
          });
          if (!searchActiveRef.current) return;
          if (statusError) { console.error("Poll error:", statusError); return; }

          const sessions = statusData?.sessions || [];
          const doneCount = sessions.filter((s: any) => ["idle", "stopped", "error", "timed_out"].includes(s.status)).length;
          const bandi = statusData?.bandi || [];

          setSessionsStatus({ done: doneCount, total: totalBatches });
          if (doneCount < totalBatches) {
            setProgressMsg(`Ricerca in corso: ${doneCount}/${totalBatches} sessioni completate`);
          }
          if (bandi.length > 0) setRisultatiLive(bandi);

          if (statusData?.done) {
            stopPolling();
            setLoading(false);
            setRisultatiLive(bandi);
            setProgressMsg("");

            // Persist to DB with keyword
            if (bandi.length > 0) {
              try {
                await upsertBandiToDB(bandi, KEYWORD_FISSA);
                // Auto-create prospects from enti
                const prospectCount = await autoCreateProspects(bandi, profile?.ufficio_id);
                await refetchBandi();
                toast.success(`${bandi.length} bando/i trovati e salvati. ${prospectCount > 0 ? `${prospectCount} nuovi prospect creati.` : ""}`);
              } catch {
                toast.warning("Bandi trovati ma errore nel salvataggio");
              }
            } else {
              const hasErrors = sessions.some((s: any) => s.status === "error" || s.status === "timed_out");
              if (hasErrors) {
                setSearchError("Alcune sessioni hanno avuto errori. Riprova tra poco.");
                toast.error("Ricerca completata con errori");
              } else {
                toast.info("Nessun bando trovato con i criteri specificati");
              }
            }

            await logRicerca(regioniSelezionate, bandi.length, profile?.id);
            queryClient.invalidateQueries({ queryKey: ["ricerche_bandi_recenti"] });
          }
        } catch (err) {
          console.error("Poll exception:", err);
        }
      };

      setTimeout(() => {
        if (pollingRef.current && searchActiveRef.current) {
          void poll();
          pollTimerRef.current = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
        }
      }, 30000);
    } catch (err: any) {
      console.error("Errore avvio ricerca bandi:", err);
      stopPolling();
      setLoading(false);
      setSearchError(err.message || "Errore durante l'avvio della ricerca");
      toast.error(err.message || "Errore durante la ricerca dei bandi");
    }
  };

  const resetFiltri = () => {
    stopPolling();
    setRegioniSelezionate([]);
    setImportoMin("");
    setImportoMax("");
    setStatoBando("");
    setDataDa(undefined);
    setDataA(undefined);
    setRisultatiLive([]);
    setHasSearched(false);
    setSearchError(null);
    setProgressMsg("");
    setElapsedSeconds(0);
  };

  const openCreaTrattativaDialog = (bando: any) => {
    setSelectedBando(bando);
    // Pre-fill fields
    setTrattativaProdotto(bando.keyword || KEYWORD_FISSA);
    setTrattativaPremio(bando.importo ? String(bando.importo) : "");
    setTrattativaScadenza(bando.scadenza || "");
    const noteLines = [
      bando.titolo || bando.oggetto || "",
      bando.cig ? `CIG: ${bando.cig}` : "",
      bando.link ? `Link: ${bando.link}` : "",
    ].filter(Boolean).join("\n");
    setTrattativaNote(noteLines);
    setCreaTrattativaOpen(true);
  };

  const handleConfirmCreaTrattativa = async () => {
    if (!selectedBando) return;
    setCreatingTrattativa(true);

    try {
      // Find or create prospect from ente
      let prospectId: string | null = null;
      const { data: existingProspect } = await supabase
        .from("prospect")
        .select("id")
        .eq("ragione_sociale", selectedBando.ente)
        .limit(1);

      if (existingProspect && existingProspect.length > 0) {
        prospectId = existingProspect[0].id;
      } else {
        const { data: newProspect, error: pErr } = await supabase.from("prospect").insert({
          ragione_sociale: selectedBando.ente,
          tipo_cliente: "ente",
          fonte: "API Mondoappalti",
          stato: "nuovo",
          ufficio_id: profile?.ufficio_id || null,
        }).select("id").single();
        if (pErr) throw pErr;
        prospectId = newProspect.id;
      }

      // Create trattativa
      const { data: trattativa, error: tErr } = await supabase.from("trattative").insert({
        prospect_id: prospectId,
        prodotto: trattativaProdotto || null,
        premio_previsto: trattativaPremio ? Number(trattativaPremio) : null,
        data_scadenza: trattativaScadenza || null,
        note: trattativaNote || null,
        stato: "aperta",
        fonte: "API Mondoappalti",
        ufficio_id: profile?.ufficio_id || null,
        created_by: profile?.id || null,
        data_apertura: new Date().toISOString().split("T")[0],
      }).select("id").single();

      if (tErr) throw tErr;

      // Link bando-trattativa
      await supabase.from("bandi_trattative").insert({
        bando_id: selectedBando.id,
        trattativa_id: trattativa.id,
      });

      toast.success("Trattativa creata e collegata al bando!");
      setCreaTrattativaOpen(false);
      setConfirmOpen(false);
      refetchBandi();
      queryClient.invalidateQueries({ queryKey: ["trattative"] });
    } catch (err: any) {
      console.error("Errore creazione trattativa:", err);
      toast.error("Errore: " + (err.message || "Impossibile creare la trattativa"));
    } finally {
      setCreatingTrattativa(false);
    }
  };

  const regioniLabel = regioniSelezionate.length === 0
    ? "Tutte le regioni"
    : regioniSelezionate.length === regioniItaliane.length
      ? "Tutte le regioni selezionate"
      : `${regioniSelezionate.length} region${regioniSelezionate.length === 1 ? 'e' : 'i'}`;

  const displayBandi = bandiDB.length > 0 ? bandiDB : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Bandi Pubblici</h1>
          <p className="text-muted-foreground">Ricerca bandi e gare d'appalto — {KEYWORD_FISSA}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {apiCallCount > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1">
              <Zap className="h-3.5 w-3.5" />
              {apiCallCount} chiamat{apiCallCount === 1 ? "a" : "e"} API
            </Badge>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowStoria(!showStoria)}>
            <History className="h-4 w-4" />
            Ricerche recenti
          </Button>
        </div>
      </div>

      {showStoria && ricercheRecenti.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ultime ricerche</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ricercheRecenti.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                  <span className="text-muted-foreground">
                    {format(new Date(r.eseguita_il), "dd/MM/yyyy HH:mm", { locale: it })}
                  </span>
                  <span>
                    {r.regioni?.length > 0 ? r.regioni.join(", ") : "Tutte le regioni"}
                  </span>
                  <Badge variant="outline" className="ml-auto">{r.risultati_count} risultati</Badge>
                  {r.profiles && (
                    <span className="text-xs text-muted-foreground">
                      da {r.profiles.nome} {r.profiles.cognome}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">Fonte:</Label>
              <Select value={fonte} onValueChange={setFonte}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mondoappalti">MondoAppalti.it</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">Keyword:</Label>
              <Badge variant="secondary" className="text-sm py-1 px-3">{KEYWORD_FISSA}</Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2" disabled={loading}>
              <Filter className="h-4 w-4" /> Filtri
            </Button>
            <Button onClick={cercaBandi} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Ricerca..." : "Cerca Bandi"}
            </Button>
            {loading && (
              <Button variant="outline" onClick={() => { stopPolling(); setLoading(false); setProgressMsg(""); }} className="gap-2">
                <X className="h-4 w-4" /> Annulla
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Regioni</Label>
                <Popover open={regioniOpen} onOpenChange={setRegioniOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={loading}>
                      {regioniLabel}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <div className="p-3 border-b">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="tutte-regioni" checked={regioniSelezionate.length === regioniItaliane.length} onCheckedChange={toggleTutte} />
                        <label htmlFor="tutte-regioni" className="text-sm font-medium cursor-pointer">Seleziona tutte</label>
                      </div>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-2 space-y-1">
                      {regioniItaliane.map((regione) => (
                        <div key={regione} className="flex items-center space-x-2 py-1 px-1 rounded hover:bg-accent cursor-pointer" onClick={() => toggleRegione(regione)}>
                          <Checkbox id={`regione-${regione}`} checked={regioniSelezionate.includes(regione)} onCheckedChange={() => toggleRegione(regione)} />
                          <label htmlFor={`regione-${regione}`} className="text-sm cursor-pointer flex-1">{regione}</label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                {regioniSelezionate.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {regioniSelezionate.map((regione) => (
                      <Badge key={regione} variant="secondary" className="gap-1 pr-1">
                        {regione}
                        <button onClick={() => removeRegione(regione)} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5" disabled={loading}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Importo minimo (€)</Label>
                  <Input type="number" placeholder="0" value={importoMin} onChange={(e) => setImportoMin(e.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label>Importo massimo (€)</Label>
                  <Input type="number" placeholder="Nessun limite" value={importoMax} onChange={(e) => setImportoMax(e.target.value)} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label>Stato bando</Label>
                  <Select value={statoBando} onValueChange={setStatoBando}>
                    <SelectTrigger><SelectValue placeholder="Tutti gli stati" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tutti">Tutti</SelectItem>
                      <SelectItem value="aperto">Aperto</SelectItem>
                      <SelectItem value="scaduto">Scaduto</SelectItem>
                      <SelectItem value="in_valutazione">In valutazione</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pubblicato dal</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataDa && "text-muted-foreground")} disabled={loading}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataDa ? format(dataDa, "dd/MM/yyyy", { locale: it }) : "Seleziona data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dataDa} onSelect={setDataDa} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Pubblicato fino al</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataA && "text-muted-foreground")} disabled={loading}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataA ? format(dataA, "dd/MM/yyyy", { locale: it }) : "Seleziona data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dataA} onSelect={setDataA} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="ghost" onClick={resetFiltri} disabled={loading}>Resetta filtri</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading / Error states during live search */}
      {loading && (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Bot className="h-8 w-8 text-primary animate-pulse" />
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-medium">Il browser AI sta cercando su MondoAppalti.it...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {progressMsg || "Login, navigazione e analisi dei risultati in corso."}
              </p>
              {sessionsStatus.total > 0 && (
                <div className="mt-2">
                  <div className="w-64 mx-auto bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${Math.max(5, (sessionsStatus.done / sessionsStatus.total) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Sessioni: {sessionsStatus.done}/{sessionsStatus.total} completate</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Tempo trascorso: {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
              </p>
              {risultatiLive.length > 0 && (
                <p className="text-sm text-primary font-medium mt-2">{risultatiLive.length} risultato/i trovati finora...</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && searchError && (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="mx-auto h-16 w-16 text-destructive/30 mb-4" />
            <h3 className="text-lg font-medium text-destructive">Errore nella ricerca</h3>
            <p className="text-sm text-muted-foreground mt-2">{searchError}</p>
          </CardContent>
        </Card>
      )}

      {/* Bandi from DB */}
      {displayBandi.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {displayBandi.length} bando/i salvati in archivio
          </p>
          {displayBandi.map((bando: any) => (
            <Card key={bando.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{bando.titolo || bando.oggetto}</CardTitle>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Building className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium text-foreground">{bando.ente}</span>
                      {bando.ente_tipo && (
                        <Badge variant="outline" className="text-xs">{bando.ente_tipo}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {bando.keyword && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Tag className="h-3 w-3" />
                        {bando.keyword}
                      </Badge>
                    )}
                    {bando.trattative_count > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <Link2 className="h-3 w-3" />
                        {bando.trattative_count} trattativ{bando.trattative_count === 1 ? "a" : "e"}
                      </Badge>
                    )}
                    <Badge variant={statoBadgeVariant(bando.stato)}>
                      {statoLabel(bando.stato)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {bando.importo != null && Number(bando.importo) > 0 && (
                    <div>
                      <span className="text-muted-foreground">Importo: </span>
                      <span className="font-medium">€{Number(bando.importo).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {bando.scadenza && (
                    <div>
                      <span className="text-muted-foreground">Scadenza: </span>
                      <span className="font-medium">{format(new Date(bando.scadenza), "dd/MM/yyyy", { locale: it })}</span>
                    </div>
                  )}
                  {bando.tipologia && (
                    <div>
                      <span className="text-muted-foreground">Tipologia: </span>
                      <span>{bando.tipologia}</span>
                    </div>
                  )}
                  {bando.cig && (
                    <div>
                      <span className="text-muted-foreground">CIG: </span>
                      <span className="font-mono text-xs">{bando.cig}</span>
                    </div>
                  )}
                  {(bando.localita || bando.regione) && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{[bando.localita, bando.regione].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1 h-7 text-xs"
                      onClick={() => openCreaTrattativaDialog(bando)}
                    >
                      <Plus className="h-3 w-3" /> Crea Trattativa
                    </Button>
                    {bando.pdf_path ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={async () => {
                          const { data } = await supabase.storage.from("documenti_generali").createSignedUrl(bando.pdf_path!, 3600);
                          if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                          else toast.error("Errore apertura PDF");
                        }}
                      >
                        <FileText className="h-3 w-3" /> Apri PDF
                      </Button>
                    ) : bando.pdf_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={async () => {
                          toast.info("Download PDF in corso...");
                          const { error } = await supabase.functions.invoke("scarica-bando-pdf", {
                            body: { bando_id: bando.id, pdf_url: bando.pdf_url },
                          });
                          if (error) {
                            toast.error("Errore download PDF: " + error.message);
                          } else {
                            toast.success("PDF scaricato e salvato");
                            refetchBandi();
                          }
                        }}
                      >
                        <FileDown className="h-3 w-3" /> Scarica PDF
                      </Button>
                    ) : null}
                    {bando.link && (
                      <a href={bando.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                        Vedi bando <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && !searchError && displayBandi.length === 0 && !hasSearched && (
        <Card>
          <CardContent className="py-16 text-center">
            <Landmark className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Nessun bando in archivio</h3>
            <p className="text-sm text-muted-foreground/70 mt-2">Clicca "Cerca Bandi" per avviare una ricerca su MondoAppalti.it</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog: Crea Trattativa da Bando */}
      <Dialog open={creaTrattativaOpen} onOpenChange={setCreaTrattativaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Crea Trattativa dal Bando
            </DialogTitle>
          </DialogHeader>
          {selectedBando && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">{selectedBando.titolo || selectedBando.oggetto}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {selectedBando.ente}
                </p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Tag className="h-3 w-3" />
                    {selectedBando.keyword || KEYWORD_FISSA}
                  </Badge>
                  <Badge variant="outline" className="text-xs">Fonte: API Mondoappalti</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Prodotto</Label>
                  <Input
                    value={trattativaProdotto}
                    onChange={(e) => setTrattativaProdotto(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Premio previsto (€)</Label>
                  <Input
                    type="number"
                    value={trattativaPremio}
                    onChange={(e) => setTrattativaPremio(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Scadenza</Label>
                <Input
                  type="date"
                  value={trattativaScadenza}
                  onChange={(e) => setTrattativaScadenza(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea
                  value={trattativaNote}
                  onChange={(e) => setTrattativaNote(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="text-xs text-muted-foreground">
                Il prospect <strong>{selectedBando.ente}</strong> verrà creato automaticamente se non esiste già. La trattativa sarà collegata a questo bando.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreaTrattativaOpen(false)}>Annulla</Button>
            <Button onClick={() => setConfirmOpen(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Crea Trattativa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conferma creazione */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma creazione trattativa</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per creare una nuova trattativa per <strong>{selectedBando?.ente}</strong> con
              prodotto "{trattativaProdotto}" e fonte "API Mondoappalti".
              {trattativaPremio && <> Premio previsto: €{Number(trattativaPremio).toLocaleString("it-IT")}.</>}
              <br />Vuoi procedere?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creatingTrattativa}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCreaTrattativa} disabled={creatingTrattativa}>
              {creatingTrattativa ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
