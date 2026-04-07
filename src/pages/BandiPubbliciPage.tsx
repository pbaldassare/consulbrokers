import { useState } from "react";
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
import { Search, Landmark, ExternalLink, CalendarIcon, Filter, Bot, Loader2, X, ChevronDown } from "lucide-react";
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
}

const regioniItaliane = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
  "Friuli Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
  "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia",
  "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

const KEYWORD_FISSA = "Brokeraggio assicurativo";

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

  const cercaBandi = async () => {
    setLoading(true);
    setHasSearched(true);
    setRisultati([]);
    setElapsedSeconds(0);

    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    try {
      const { data, error } = await supabase.functions.invoke('cerca-bandi', {
        body: {
          keyword: KEYWORD_FISSA,
          regioni: regioniSelezionate.length > 0 ? regioniSelezionate : undefined,
          importoMin: importoMin || undefined,
          importoMax: importoMax || undefined,
          statoBando: statoBando || undefined,
          dataDa: dataDa ? format(dataDa, "yyyy-MM-dd") : undefined,
          dataA: dataA ? format(dataA, "yyyy-MM-dd") : undefined,
          fonte,
        },
      });

      if (error) throw error;

      const bandi = data?.bandi || [];
      setRisultati(bandi);

      if (bandi.length === 0) {
        toast.info("Nessun bando trovato con i criteri specificati");
      } else {
        toast.success(`${bandi.length} bando/i trovati`);
      }
    } catch (err: any) {
      console.error('Errore ricerca bandi:', err);
      toast.error(err.message || "Errore durante la ricerca dei bandi");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  const resetFiltri = () => {
    setRegioniSelezionate([]);
    setImportoMin("");
    setImportoMax("");
    setStatoBando("");
    setDataDa(undefined);
    setDataA(undefined);
    setRisultati([]);
    setHasSearched(false);
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
                Login, navigazione e analisi dei risultati in corso. Può richiedere 30-90 secondi.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Tempo trascorso: {elapsedSeconds}s
              </p>
            </div>
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
      ) : (
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
                <div className="flex flex-wrap gap-6 text-sm">
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
                      <span className="text-muted-foreground">Categoria: </span>
                      <span>{bando.categoria}</span>
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
