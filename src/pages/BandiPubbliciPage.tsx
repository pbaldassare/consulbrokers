import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Landmark, ExternalLink, CalendarIcon, Filter, Bot, Loader2, X, ChevronDown, MapPin } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BandoResult {
  id: string;
  titolo: string;
  ente: string;
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
}

const regioniItaliane = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
  "Friuli Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
  "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia",
  "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

const KEYWORD_FISSA = "Brokeraggio assicurativo";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_TIME_MS = 10 * 60 * 1000; // 10 minutes

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

export default function BandiPubbliciPage() {
  const [regioniSelezionate, setRegioniSelezionate] = useState<string[]>([]);
  const [importoMin, setImportoMin] = useState("");
  const [importoMax, setImportoMax] = useState("");
  const [statoBando, setStatoBando] = useState<string>("");
  const [dataDa, setDataDa] = useState<Date>();
  const [dataA, setDataA] = useState<Date>();
  const [risultati, setRisultati] = useState<BandoResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [fonte, setFonte] = useState("mondoappalti");
  const [regioniOpen, setRegioniOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [sessionsStatus, setSessionsStatus] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const pollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleRegione = (regione: string) => {
    setRegioniSelezionate(prev =>
      prev.includes(regione)
        ? prev.filter(r => r !== regione)
        : [...prev, regione]
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
    setRegioniSelezionate(prev => prev.filter(r => r !== regione));
  };

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const cercaBandi = async () => {
    setLoading(true);
    setHasSearched(true);
    setRisultati([]);
    setElapsedSeconds(0);
    setSearchError(null);
    setProgressMsg("Avvio ricerca...");
    setSessionsStatus({ done: 0, total: 0 });
    stopPolling();

    // Elapsed time counter
    const elapsedTimer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    try {
      // Step 1: Start sessions
      const { data: startData, error: startError } = await supabase.functions.invoke('cerca-bandi', {
        body: {
          action: 'start',
          regioni: regioniSelezionate.length > 0 ? regioniSelezionate : undefined,
          importoMin: importoMin || undefined,
          importoMax: importoMax || undefined,
          dataDa: dataDa ? format(dataDa, "yyyy-MM-dd") : undefined,
          dataA: dataA ? format(dataA, "yyyy-MM-dd") : undefined,
        },
      });

      if (startError) throw startError;

      const sessionIds: string[] = startData?.sessionIds || [];
      const totalBatches = startData?.totalBatches || sessionIds.length;

      if (sessionIds.length === 0) {
        throw new Error("Nessuna sessione avviata");
      }

      setSessionsStatus({ done: 0, total: totalBatches });
      setProgressMsg(`Ricerca avviata: ${totalBatches} sessione/i`);

      // Step 2: Poll for results
      pollingRef.current = true;
      const pollStart = Date.now();

      const poll = async () => {
        if (!pollingRef.current) return;

        // Check timeout
        if (Date.now() - pollStart > MAX_POLL_TIME_MS) {
          stopPolling();
          clearInterval(elapsedTimer);
          setLoading(false);
          setSearchError("La ricerca ha superato il tempo massimo. Riprova con meno regioni.");
          return;
        }

        try {
          const { data: statusData, error: statusError } = await supabase.functions.invoke('cerca-bandi', {
            body: {
              action: 'status',
              sessionIds,
            },
          });

          if (statusError) {
            console.error('Poll error:', statusError);
            return; // Keep polling, might be transient
          }

          const sessions = statusData?.sessions || [];
          const doneCount = sessions.filter((s: any) =>
            ['idle', 'stopped', 'error', 'timed_out'].includes(s.status)
          ).length;

          setSessionsStatus({ done: doneCount, total: totalBatches });

          const runningCount = totalBatches - doneCount;
          if (runningCount > 0) {
            setProgressMsg(`Ricerca in corso: ${doneCount}/${totalBatches} sessioni completate`);
          }

          // Show partial results as they come
          const bandi = statusData?.bandi || [];
          if (bandi.length > 0) {
            setRisultati(bandi);
          }

          if (statusData?.done) {
            // All done
            stopPolling();
            clearInterval(elapsedTimer);
            setLoading(false);
            setRisultati(bandi);

            if (bandi.length === 0) {
              const hasErrors = sessions.some((s: any) => s.status === 'error' || s.status === 'timed_out');
              if (hasErrors) {
                setSearchError("Alcune sessioni hanno avuto errori. Riprova o riduci il numero di regioni.");
                toast.error("Ricerca completata con errori");
              } else {
                toast.info("Nessun bando trovato con i criteri specificati");
              }
            } else {
              toast.success(`${bandi.length} bando/i trovati`);
            }
            setProgressMsg("");
          }
        } catch (err: any) {
          console.error('Poll exception:', err);
          // Don't stop polling on transient errors
        }
      };

      // First poll after 8 seconds (give BrowserUse time to start)
      setTimeout(() => {
        if (pollingRef.current) {
          poll();
          timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
        }
      }, 8000);

    } catch (err: any) {
      console.error('Errore avvio ricerca bandi:', err);
      clearInterval(elapsedTimer);
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
    setRisultati([]);
    setHasSearched(false);
    setSearchError(null);
    setProgressMsg("");
  };

  const regioniLabel = regioniSelezionate.length === 0
    ? "Tutte le regioni"
    : regioniSelezionate.length === regioniItaliane.length
      ? "Tutte le regioni selezionate"
      : `${regioniSelezionate.length} region${regioniSelezionate.length === 1 ? 'e' : 'i'}`;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Bandi Pubblici</h1>
          <p className="text-muted-foreground">Ricerca bandi e gare d'appalto — {KEYWORD_FISSA}</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Fonte e keyword fissa */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">Fonte:</Label>
              <Select value={fonte} onValueChange={setFonte}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mondoappalti">MondoAppalti.it</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">Keyword:</Label>
              <Badge variant="secondary" className="text-sm py-1 px-3">
                {KEYWORD_FISSA}
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
              disabled={loading}
            >
              <Filter className="h-4 w-4" />
              Filtri
            </Button>
            <Button onClick={cercaBandi} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Ricerca..." : "Cerca Bandi"}
            </Button>
            {loading && (
              <Button variant="outline" onClick={() => { stopPolling(); setLoading(false); setProgressMsg(""); }} className="gap-2">
                <X className="h-4 w-4" />
                Annulla
              </Button>
            )}
          </div>

          {/* Filtri avanzati */}
          {showFilters && (
            <div className="space-y-4 pt-4 border-t">
              {/* Multi-select regioni */}
              <div className="space-y-2">
                <Label>Regioni</Label>
                <Popover open={regioniOpen} onOpenChange={setRegioniOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                      disabled={loading}
                    >
                      {regioniLabel}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <div className="p-3 border-b">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="tutte-regioni"
                          checked={regioniSelezionate.length === regioniItaliane.length}
                          onCheckedChange={toggleTutte}
                        />
                        <label htmlFor="tutte-regioni" className="text-sm font-medium cursor-pointer">
                          Seleziona tutte
                        </label>
                      </div>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-2 space-y-1">
                      {regioniItaliane.map((regione) => (
                        <div key={regione} className="flex items-center space-x-2 py-1 px-1 rounded hover:bg-accent cursor-pointer" onClick={() => toggleRegione(regione)}>
                          <Checkbox
                            id={`regione-${regione}`}
                            checked={regioniSelezionate.includes(regione)}
                            onCheckedChange={() => toggleRegione(regione)}
                          />
                          <label htmlFor={`regione-${regione}`} className="text-sm cursor-pointer flex-1">
                            {regione}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Badge regioni selezionate */}
                {regioniSelezionate.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {regioniSelezionate.map((regione) => (
                      <Badge key={regione} variant="secondary" className="gap-1 pr-1">
                        {regione}
                        <button
                          onClick={() => removeRegione(regione)}
                          className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                          disabled={loading}
                        >
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
                  <Input
                    type="number"
                    placeholder="0"
                    value={importoMin}
                    onChange={(e) => setImportoMin(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Importo massimo (€)</Label>
                  <Input
                    type="number"
                    placeholder="Nessun limite"
                    value={importoMax}
                    onChange={(e) => setImportoMax(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Stato bando</Label>
                  <Select value={statoBando} onValueChange={setStatoBando}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tutti gli stati" />
                    </SelectTrigger>
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
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dataDa && "text-muted-foreground"
                        )}
                        disabled={loading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataDa ? format(dataDa, "dd/MM/yyyy", { locale: it }) : "Seleziona data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataDa}
                        onSelect={setDataDa}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Pubblicato fino al</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dataA && "text-muted-foreground"
                        )}
                        disabled={loading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataA ? format(dataA, "dd/MM/yyyy", { locale: it }) : "Seleziona data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataA}
                        onSelect={setDataA}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="ghost" onClick={resetFiltri} disabled={loading}>
                  Resetta filtri
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Area risultati */}
      {!hasSearched ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Landmark className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Seleziona le regioni e clicca "Cerca Bandi"
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-2">
              Il browser AI navigherà MondoAppalti.it per trovare bandi di brokeraggio assicurativo
            </p>
          </CardContent>
        </Card>
      ) : loading ? (
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
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, (sessionsStatus.done / sessionsStatus.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sessioni: {sessionsStatus.done}/{sessionsStatus.total} completate
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Tempo trascorso: {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
              </p>
              {risultati.length > 0 && (
                <p className="text-sm text-primary font-medium mt-2">
                  {risultati.length} risultato/i trovati finora...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : searchError ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="mx-auto h-16 w-16 text-destructive/30 mb-4" />
            <h3 className="text-lg font-medium text-destructive">
              Errore nella ricerca
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {searchError}
            </p>
            {risultati.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Sono stati comunque trovati {risultati.length} risultato/i parziali.
              </p>
            )}
          </CardContent>
        </Card>
      ) : risultati.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Nessun bando trovato
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-2">
              Prova a modificare i criteri di ricerca o selezionare altre regioni
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Results list (shown even during loading for partial results) */}
      {risultati.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {risultati.length} risultat{risultati.length === 1 ? "o" : "i"} trovati su MondoAppalti.it
          </p>
          {risultati.map((bando) => (
            <Card key={bando.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{bando.titolo}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{bando.ente}</p>
                  </div>
                  <Badge variant={statoBadgeVariant(bando.stato)}>
                    {statoLabel(bando.stato)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {bando.importo != null && (
                    <div>
                      <span className="text-muted-foreground">Importo: </span>
                      <span className="font-medium">
                        €{bando.importo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {bando.scadenza && (
                    <div>
                      <span className="text-muted-foreground">Scadenza: </span>
                      <span className="font-medium">{bando.scadenza}</span>
                    </div>
                  )}
                  {bando.categoria && (
                    <div>
                      <span className="text-muted-foreground">Tipologia: </span>
                      <span>{bando.categoria}</span>
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
                      <span className="text-muted-foreground">
                        {[bando.localita, bando.regione].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {bando.link && (
                    <a
                      href={bando.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline ml-auto"
                    >
                      Vedi bando <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
