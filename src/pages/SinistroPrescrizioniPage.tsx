import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useServerPagination } from "@/hooks/useServerPagination";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ServerPagination from "@/components/ServerPagination";
import { toast } from "sonner";
import { format, differenceInDays, addYears, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Clock, FileSpreadsheet, AlertTriangle, ArrowLeft, Search, RefreshCw, X } from "lucide-react";

const statiSinistro = ["aperto", "in_lavorazione", "in_attesa_documenti", "chiuso", "respinto"];

export default function SinistroPrescrizioniPage() {
  const navigate = useNavigate();
  
  // Stati dei filtri
  const [filtroUfficio, setFiltroUfficio] = useState<string>("tutti");
  const [filtroResponsabile, setFiltroResponsabile] = useState<string>("tutti");
  const [filtroCompagnia, setFiltroCompagnia] = useState<string>("tutti");
  const [filtroStato, setFiltroStato] = useState<string>("tutti");
  const [dataPrescrizioneDal, setDataPrescrizioneDal] = useState<string>("");
  const [dataPrescrizioneAl, setDataPrescrizioneAl] = useState<string>("");
  const [search, setSearch] = useState("");

  const { page, setPage, pageSize, range } = useServerPagination(25, [
    filtroUfficio,
    filtroResponsabile,
    filtroCompagnia,
    filtroStato,
    dataPrescrizioneDal,
    dataPrescrizioneAl,
    search
  ]);

  // Query lookups
  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-prescrizioni"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    }
  });

  const { data: responsabili = [] } = useQuery({
    queryKey: ["responsabili-prescrizioni"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      return data || [];
    }
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie-prescrizioni"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    }
  });

  // Query principale: Sinistri
  const { data: result, isLoading, refetch } = useQuery({
    queryKey: ["sinistri-prescrizioni", page, filtroUfficio, filtroResponsabile, filtroCompagnia, filtroStato, dataPrescrizioneDal, dataPrescrizioneAl, search],
    queryFn: async () => {
      let q = supabase.from("sinistri").select(`
        id, 
        numero_sinistro, 
        stato, 
        data_evento, 
        data_apertura, 
        responsabile_id, 
        compagnia_id, 
        ufficio_id,
        compagnie(nome), 
        profiles!sinistri_responsabile_id_fkey(nome, cognome),
        clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente),
        titoli(numero_titolo, rami(descrizione))
      `, { count: "exact" });

      // Filtri database
      if (filtroUfficio !== "tutti") q = q.eq("ufficio_id", filtroUfficio);
      if (filtroResponsabile !== "tutti") q = q.eq("responsabile_id", filtroResponsabile);
      if (filtroCompagnia !== "tutti") q = q.eq("compagnia_id", filtroCompagnia);
      if (filtroStato !== "tutti") q = q.eq("stato", filtroStato);
      
      if (search) {
        q = q.or(`numero_sinistro.ilike.%${search}%,descrizione.ilike.%${search}%`);
      }

      // Poiché la data di prescrizione è calcolata (data_evento + 2 anni),
      // il filtro per range di date prescrizione si traduce a database come:
      // data_evento compreso tra (dataPrescrizioneDal - 2 anni) e (dataPrescrizioneAl - 2 anni)
      if (dataPrescrizioneDal) {
        const dateDal = parseISO(dataPrescrizioneDal);
        const eventDal = format(addYears(dateDal, -2), "yyyy-MM-dd");
        q = q.gte("data_evento", eventDal);
      }
      if (dataPrescrizioneAl) {
        const dateAl = parseISO(dataPrescrizioneAl);
        const eventAl = format(addYears(dateAl, -2), "yyyy-MM-dd");
        q = q.lte("data_evento", eventAl);
      }

      const { data, count, error } = await q
        .order("data_evento", { ascending: true, nullsFirst: false })
        .range(range.from, range.to);

      if (error) throw error;
      return { data: data || [], count: count || 0 };
    }
  });

  const sinistri = result?.data || [];
  const totalCount = result?.count || 0;

  const getClienteNome = (c: any) => {
    if (!c) return "—";
    if (c.tipo_cliente === "azienda" && c.ragione_sociale) return c.ragione_sociale;
    return `${c.cognome || ""} ${c.nome || ""}`.trim() || "—";
  };

  // Calcolo della prescrizione e dei giorni residui
  const getPrescrizioneInfo = (dataEventoStr: string | null, dataAperturaStr: string) => {
    const baseDate = dataEventoStr ? parseISO(dataEventoStr) : parseISO(dataAperturaStr);
    const dataPrescrizione = addYears(baseDate, 2);
    const oggi = new Date();
    // Calcoliamo la differenza in giorni rimuovendo i decimali
    const giorniMancanti = differenceInDays(dataPrescrizione, oggi);
    
    let colorClass = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300";
    if (giorniMancanti < 0) {
      colorClass = "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400"; // grigio
    } else if (giorniMancanti < 30) {
      colorClass = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300"; // rosso
    } else if (giorniMancanti <= 90) {
      colorClass = "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300"; // arancione
    }

    return {
      dataPrescrizione,
      giorniMancanti,
      colorClass
    };
  };

  // Reset dei filtri
  const resetFiltri = () => {
    setFiltroUfficio("tutti");
    setFiltroResponsabile("tutti");
    setFiltroCompagnia("tutti");
    setFiltroStato("tutti");
    setDataPrescrizioneDal("");
    setDataPrescrizioneAl("");
    setSearch("");
    setPage(0);
  };

  // Esportazione XLSX di tutti i dati filtrati (senza limite di pagina)
  const handleExportXLSX = async () => {
    try {
      toast.loading("Generazione file Excel in corso...");
      // Eseguiamo una query analoga ma senza range per prendere tutti i record filtrati
      let q = supabase.from("sinistri").select(`
        numero_sinistro, 
        stato, 
        data_evento, 
        data_apertura, 
        compagnie(nome), 
        profiles!sinistri_responsabile_id_fkey(nome, cognome),
        clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente),
        titoli(numero_titolo, rami(descrizione))
      `);

      if (filtroUfficio !== "tutti") q = q.eq("ufficio_id", filtroUfficio);
      if (filtroResponsabile !== "tutti") q = q.eq("responsabile_id", filtroResponsabile);
      if (filtroCompagnia !== "tutti") q = q.eq("compagnia_id", filtroCompagnia);
      if (filtroStato !== "tutti") q = q.eq("stato", filtroStato);
      if (search) q = q.or(`numero_sinistro.ilike.%${search}%,descrizione.ilike.%${search}%`);
      if (dataPrescrizioneDal) {
        const eventDal = format(addYears(parseISO(dataPrescrizioneDal), -2), "yyyy-MM-dd");
        q = q.gte("data_evento", eventDal);
      }
      if (dataPrescrizioneAl) {
        const eventAl = format(addYears(parseISO(dataPrescrizioneAl), -2), "yyyy-MM-dd");
        q = q.lte("data_evento", eventAl);
      }

      const { data, error } = await q.order("data_evento", { ascending: true });
      if (error) throw error;

      const rows = (data || []).map((s: any) => {
        const info = getPrescrizioneInfo(s.data_evento, s.data_apertura);
        return {
          "Numero Sinistro": s.numero_sinistro || "",
          "Cliente": getClienteNome(s.clienti),
          "Compagnia": s.compagnie?.nome || "",
          "Garanzia": s.titoli?.rami?.descrizione || "—",
          "Data Accadimento": s.data_evento ? format(new Date(s.data_evento), "dd/MM/yyyy") : "",
          "Data Prescrizione": format(info.dataPrescrizione, "dd/MM/yyyy"),
          "Giorni alla Prescrizione": info.giorniMancanti >= 0 ? info.giorniMancanti : "Prescritto",
          "Stato Sinistro": s.stato?.replace(/_/g, " ") || "",
          "Responsabile": s.profiles ? `${s.profiles.nome} ${s.profiles.cognome}` : ""
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Prescrizioni Sinistri");
      
      const fileName = `prescrizioni_sinistri_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.dismiss();
      toast.success("File Excel esportato con successo");
    } catch (err: any) {
      toast.dismiss();
      toast.error("Errore durante l'esportazione: " + err.message);
    }
  };

  const hasFiltriAttivi = filtroUfficio !== "tutti" || filtroResponsabile !== "tutti" || filtroCompagnia !== "tutti" || filtroStato !== "tutti" || dataPrescrizioneDal !== "" || dataPrescrizioneAl !== "" || search !== "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sinistri")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary animate-pulse" /> Termini di prescrizione
            </h1>
            <p className="text-muted-foreground">Monitoraggio dei termini legali di prescrizione dei sinistri (art. 2952 c.c. e termini perentori)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} title="Ricarica dati">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportXLSX} disabled={sinistri.length === 0} className="gap-2">
            <FileSpreadsheet className="h-4 w-4 text-green-700" /> Esporta XLSX
          </Button>
        </div>
      </div>

      {/* Pannello Filtri */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Filtro Ufficio */}
            <div className="space-y-1">
              <Label className="text-xs">Ufficio</Label>
              <SearchableSelect
                value={filtroUfficio}
                onValueChange={(val) => { setFiltroUfficio(val); setPage(0); }}
                placeholder="Tutti gli uffici"
                clearable={true}
                clearLabel="Tutti gli uffici"
                options={[{ value: "tutti", label: "Tutti gli uffici" }, ...uffici.map((u: any) => ({ value: u.id, label: u.nome_ufficio }))]}
              />
            </div>

            {/* Filtro Responsabile */}
            <div className="space-y-1">
              <Label className="text-xs">Responsabile</Label>
              <SearchableSelect
                value={filtroResponsabile}
                onValueChange={(val) => { setFiltroResponsabile(val); setPage(0); }}
                placeholder="Tutti i responsabili"
                clearable={true}
                clearLabel="Tutti i responsabili"
                options={[{ value: "tutti", label: "Tutti i responsabili" }, ...responsabili.map((r: any) => ({ value: r.id, label: `${r.cognome || ""} ${r.nome || ""}`.trim() }))]}
              />
            </div>

            {/* Filtro Compagnia */}
            <div className="space-y-1">
              <Label className="text-xs">Compagnia</Label>
              <SearchableSelect
                value={filtroCompagnia}
                onValueChange={(val) => { setFiltroCompagnia(val); setPage(0); }}
                placeholder="Tutte le compagnie"
                clearable={true}
                clearLabel="Tutte le compagnie"
                options={[{ value: "tutti", label: "Tutte le compagnie" }, ...compagnie.map((c: any) => ({ value: c.id, label: c.nome }))]}
              />
            </div>

            {/* Filtro Date Prescrizione Dal */}
            <div className="space-y-1">
              <Label className="text-xs">Prescrizione Dal</Label>
              <Input type="date" value={dataPrescrizioneDal} onChange={(e) => { setDataPrescrizioneDal(e.target.value); setPage(0); }} className="h-9" />
            </div>

            {/* Filtro Date Prescrizione Al */}
            <div className="space-y-1">
              <Label className="text-xs">Prescrizione Al</Label>
              <Input type="date" value={dataPrescrizioneAl} onChange={(e) => { setDataPrescrizioneAl(e.target.value); setPage(0); }} className="h-9" />
            </div>
          </div>

          <div className="flex gap-3 items-center flex-wrap pt-2 border-t">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cerca per N° sinistro..." 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(0); }} 
                className="pl-9 h-9" 
              />
            </div>
            
            <div className="space-y-1 w-48">
              <Select value={filtroStato} onValueChange={(val) => { setFiltroStato(val); setPage(0); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Tutti gli stati" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutti">Tutti gli stati</SelectItem>
                  {statiSinistro.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasFiltriAttivi && (
              <Button variant="ghost" size="sm" onClick={resetFiltri} className="text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5 mr-1" /> Reset filtri
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabella Risultati */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base flex items-center gap-2">
            Elenco Pratiche ({totalCount})
          </CardTitle>
          <CardDescription>Visualizzazione dei sinistri e del rispettivo stato di scadenza delle prescrizioni legalmente stabilite.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="table-header-colored">
                <TableRow>
                  <TableHead className="w-32">N° Sinistro</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Garanzia</TableHead>
                  <TableHead className="w-32">Accadimento</TableHead>
                  <TableHead className="w-32">Prescrizione</TableHead>
                  <TableHead className="w-36 text-center">Giorni Residui</TableHead>
                  <TableHead className="w-28">Stato</TableHead>
                  <TableHead>Responsabile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Caricamento in corso...</TableCell>
                  </TableRow>
                ) : sinistri.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nessun sinistro trovato con i filtri selezionati</TableCell>
                  </TableRow>
                ) : (
                  sinistri.map((s: any) => {
                    const info = getPrescrizioneInfo(s.data_evento, s.data_apertura);
                    return (
                      <TableRow 
                        key={s.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/sinistri/${s.id}`)}
                      >
                        <TableCell className="font-semibold">{s.numero_sinistro || "—"}</TableCell>
                        <TableCell>{getClienteNome(s.clienti)}</TableCell>
                        <TableCell>{s.compagnie?.nome || "—"}</TableCell>
                        <TableCell>{s.titoli?.rami?.descrizione || "—"}</TableCell>
                        <TableCell>{s.data_evento ? format(new Date(s.data_evento), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                        <TableCell className="font-medium text-primary">
                          {format(info.dataPrescrizione, "dd/MM/yyyy", { locale: it })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`${info.colorClass} font-semibold py-0.5 px-2`}>
                            {info.giorniMancanti < 0 
                              ? "Scaduto (Prescritto)" 
                              : `${info.giorniMancanti} giorni`
                            }
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          <Badge variant="secondary" className="text-[10px]">
                            {s.stato?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {s.profiles ? `${s.profiles.nome || ""} ${s.profiles.cognome || ""}`.trim() : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 border-t">
            <ServerPagination 
              page={page} 
              pageSize={pageSize} 
              totalCount={totalCount} 
              onPageChange={setPage} 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
