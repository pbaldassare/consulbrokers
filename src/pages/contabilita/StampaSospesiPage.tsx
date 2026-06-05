import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FileText, Download, Search, RefreshCw, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { DatePicker } from "@/components/contabilita/DatePicker";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

type TitoloSospeso = {
  id: string;
  numero_titolo: string | null;
  premio_lordo: number | null;
  data_sospensione: string | null;
  ae_nome: string | null;
  clienti: {
    id: string;
    nome: string | null;
    cognome: string | null;
    ragione_sociale: string | null;
    tipo_cliente: string;
  } | null;
  compagnia: {
    id: string;
    nome: string;
  } | null;
  ramo: {
    id: string;
    codice: string;
    descrizione: string;
  } | null;
  ae_anagrafica: {
    id: string;
    nome: string | null;
    cognome: string | null;
    ragione_sociale: string | null;
  } | null;
};

export default function StampaSospesiPage() {
  const navigate = useNavigate();

  // Stati dei filtri
  const [ufficioId, setUfficioId] = useState<string | null>(null);
  const [compagniaId, setCompagniaId] = useState<string | null>(null);
  const [ramoId, setRamoId] = useState<string | null>(null);
  const [dataSospensioneDa, setDataSospensioneDa] = useState<Date | null>(null);
  const [dataSospensioneAl, setDataSospensioneAl] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  // Debounce per la ricerca libera a 350ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchDebounced(search);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Paginazione server-side (25 righe)
  const { page, setPage, pageSize, range, resetPage } = useServerPagination(25, [
    ufficioId,
    compagniaId,
    ramoId,
    dataSospensioneDa,
    dataSospensioneAl,
    searchDebounced,
  ]);

  // Lookups per i filtri
  const { data: uffici = [], isLoading: loadingUffici } = useQuery({
    queryKey: ["lookup-uffici-sospesi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uffici")
        .select("id, nome_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      if (error) throw error;
      return data.map((u) => ({ value: u.id, label: u.nome_ufficio }));
    },
  });

  const { data: compagnie = [], isLoading: loadingCompagnie } = useQuery({
    queryKey: ["lookup-compagnie-sospesi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnie")
        .select("id, nome")
        .eq("attiva", true)
        .order("nome");
      if (error) throw error;
      return data.map((c) => ({ value: c.id, label: c.nome }));
    },
  });

  const { data: rami = [], isLoading: loadingRami } = useQuery({
    queryKey: ["lookup-rami-sospesi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rami")
        .select("id, codice, descrizione")
        .order("codice");
      if (error) throw error;
      return data.map((r) => ({ value: r.id, label: `${r.codice} - ${r.descrizione}` }));
    },
  });

  // Query principale con i filtri e paginazione
  const buildQuery = (isExport = false) => {
    let q = supabase
      .from("titoli")
      .select(
        `
        id,
        numero_titolo,
        premio_lordo,
        data_sospensione,
        ae_nome,
        clienti:clienti!titoli_cliente_anagrafica_id_fkey(id, nome, cognome, ragione_sociale, tipo_cliente),
        compagnia:compagnie!titoli_compagnia_id_fkey(id, nome),
        ramo:rami!titoli_ramo_id_fkey(id, codice, descrizione),
        ae_anagrafica:anagrafiche_professionali!titoli_ae_anagrafica_id_fkey(id, nome, cognome, ragione_sociale)
      `,
        { count: "exact" }
      )
      .eq("stato", "sospeso");

    // Applicazione dei filtri
    if (ufficioId) q = q.eq("ufficio_id", ufficioId);
    if (compagniaId) q = q.eq("compagnia_id", compagniaId);
    if (ramoId) q = q.eq("ramo_id", ramoId);
    if (dataSospensioneDa) {
      q = q.gte("data_sospensione", format(dataSospensioneDa, "yyyy-MM-dd"));
    }
    if (dataSospensioneAl) {
      q = q.lte("data_sospensione", format(dataSospensioneAl, "yyyy-MM-dd"));
    }
    if (searchDebounced) {
      // Cerca per numero polizza (numero_titolo) o nome cliente (tramite clienti)
      q = q.or(`numero_titolo.ilike.%${searchDebounced}%`);
    }

    q = q.order("data_sospensione", { ascending: true });

    if (!isExport) {
      q = q.range(range.from, range.to);
    }

    return q;
  };

  const { data: result, isLoading: isLoadingTitoli, refetch } = useQuery({
    queryKey: [
      "titoli-sospesi",
      page,
      ufficioId,
      compagniaId,
      ramoId,
      dataSospensioneDa,
      dataSospensioneAl,
      searchDebounced,
    ],
    queryFn: async () => {
      const q = buildQuery(false);
      const { data, count, error } = await q;
      if (error) throw error;
      return { data: (data || []) as unknown as TitoloSospeso[], count: count || 0 };
    },
  });

  const titoli = result?.data || [];
  const totalCount = result?.count || 0;

  // Funzioni di utilità per formattare
  const getClienteNome = (c: TitoloSospeso["clienti"]) => {
    if (!c) return "—";
    if (c.tipo_cliente === "azienda" || c.tipo_cliente === "ente") {
      return c.ragione_sociale || "—";
    }
    return `${c.cognome || ""} ${c.nome || ""}`.trim() || "—";
  };

  const getResponsabileNome = (t: TitoloSospeso) => {
    if (t.ae_nome) return t.ae_nome;
    const ae = t.ae_anagrafica;
    if (!ae) return "—";
    return `${ae.cognome || ""} ${ae.nome || ""}`.trim() || ae.ragione_sociale || "—";
  };

  const getGiorniSospeso = (dataSospensione: string | null) => {
    if (!dataSospensione) return 0;
    return Math.abs(differenceInDays(new Date(), parseISO(dataSospensione)));
  };

  const renderBadgeGiorni = (giorni: number) => {
    if (giorni < 30) {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400" variant="outline">
          {giorni} gg
        </Badge>
      );
    } else if (giorni <= 90) {
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400" variant="outline">
          {giorni} gg
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/30 dark:text-rose-400" variant="outline">
          {giorni} gg
        </Badge>
      );
    }
  };

  // Reset dei filtri
  const handleResetFiltri = () => {
    setUfficioId(null);
    setCompagniaId(null);
    setRamoId(null);
    setDataSospensioneDa(null);
    setDataSospensioneAl(null);
    setSearch("");
    resetPage();
  };

  // Export PDF via Edge Function
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const handleExportPDF = async () => {
    try {
      setGenerandoPdf(true);
      toast.loading("Generazione del report PDF in corso...");

      // Carichiamo TUTTE le righe per l'export
      const q = buildQuery(true);
      const { data: allData, error } = await q;
      if (error) throw error;

      const itemsForPdf = (allData || []).map((t: any) => {
        const gg = getGiorniSospeso(t.data_sospensione);
        return {
          numero_polizza: t.numero_titolo || "—",
          cliente: getClienteNome(t.clienti),
          compagnia: t.compagnia?.nome || "—",
          ramo: t.ramo?.descrizione || "—",
          premio_lordo: t.premio_lordo || 0,
          data_sospensione: t.data_sospensione ? format(new Date(t.data_sospensione), "dd/MM/yyyy") : "—",
          giorni_sospeso: `${gg} gg`,
          responsabile: getResponsabileNome(t),
        };
      });

      // Recuperiamo i nomi dei filtri per passarli all'header
      const ufficioNome = ufficioId ? uffici.find((u) => u.value === ufficioId)?.label : "Tutti";
      const compagniaNome = compagniaId ? compagnie.find((c) => c.value === compagniaId)?.label : "Tutte";
      const ramoNome = ramoId ? rami.find((r) => r.value === ramoId)?.label : "Tutti";

      // Chiamata all'edge function
      const { data, error: fnErr } = await supabase.functions.invoke("genera-pdf-template", {
        body: {
          tipo: "sospesi",
          dati: itemsForPdf,
          filtri: {
            Ufficio: ufficioNome,
            Compagnia: compagniaNome,
            Ramo: ramoNome,
            "Data Da": dataSospensioneDa ? format(dataSospensioneDa, "dd/MM/yyyy") : "Tutte",
            "Data Al": dataSospensioneAl ? format(dataSospensioneAl, "dd/MM/yyyy") : "Tutte",
            Ricerca: searchDebounced || "Nessuna",
          },
        },
      });

      if (fnErr || data?.error) throw new Error(fnErr?.message || data?.error || "Errore sconosciuto");

      // Download PDF
      const base64Data = data.content;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `polizze_sospese_${format(new Date(), "yyyyMMdd")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("PDF esportato con successo");
    } catch (err: any) {
      console.error(err);
      toast.dismiss();
      toast.error("Errore durante l'esportazione PDF: " + err.message);
    } finally {
      setGenerandoPdf(false);
    }
  };

  // Export XLSX client-side
  const handleExportXLSX = async () => {
    try {
      toast.loading("Generazione del file Excel...");
      const q = buildQuery(true);
      const { data: allData, error } = await q;
      if (error) throw error;

      const rows = (allData || []).map((t: any) => {
        const gg = getGiorniSospeso(t.data_sospensione);
        return {
          "Numero Polizza": t.numero_titolo || "",
          "Cliente": getClienteNome(t.clienti),
          "Compagnia": t.compagnia?.nome || "",
          "Ramo": t.ramo?.descrizione || "",
          "Premio Lordo (€)": t.premio_lordo || 0,
          "Data Sospensione": t.data_sospensione ? format(new Date(t.data_sospensione), "dd/MM/yyyy") : "",
          "Giorni Sospeso": gg,
          "Responsabile": getResponsabileNome(t),
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Polizze Sospese");

      const fileName = `polizze_sospese_${format(new Date(), "yyyyMMdd")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.dismiss();
      toast.success("File Excel scaricato con successo");
    } catch (err: any) {
      toast.dismiss();
      toast.error("Errore durante l'esportazione Excel: " + err.message);
    }
  };

  const hasFiltriAttivi = ufficioId !== null || compagniaId !== null || ramoId !== null || dataSospensioneDa !== null || dataSospensioneAl !== null || search !== "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/contabilita")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Polizze Sospese</h1>
            <p className="text-sm text-muted-foreground">Visualizza ed esporta i titoli attualmente in stato sospeso</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={generandoPdf || titoli.length === 0}>
            <FileText className="w-4 h-4 mr-2" />
            Esporta PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportXLSX} disabled={titoli.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Esporta XLSX
          </Button>
        </div>
      </div>

      {/* Box Filtri */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtri di ricerca</span>
          {hasFiltriAttivi && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-500 hover:text-rose-700" onClick={handleResetFiltri}>
              <RefreshCw className="w-3 h-3 mr-1" />
              Reset Filtri
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Ufficio</Label>
            <FilterSearchableSelect
              value={ufficioId}
              onValueChange={(v) => { setUfficioId(v); resetPage(); }}
              options={uffici}
              placeholder="Ufficio"
              allLabel="Tutti gli uffici"
              className="w-full h-9"
              loading={loadingUffici}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Compagnia</Label>
            <FilterSearchableSelect
              value={compagniaId}
              onValueChange={(v) => { setCompagniaId(v); resetPage(); }}
              options={compagnie}
              placeholder="Compagnia"
              allLabel="Tutte le compagnie"
              className="w-full h-9"
              loading={loadingCompagnie}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Ramo</Label>
            <FilterSearchableSelect
              value={ramoId}
              onValueChange={(v) => { setRamoId(v); resetPage(); }}
              options={rami}
              placeholder="Ramo"
              allLabel="Tutti i rami"
              className="w-full h-9"
              loading={loadingRami}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2 lg:col-span-2 grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sospeso Da</Label>
              <DatePicker
                value={dataSospensioneDa}
                onChange={(d) => { setDataSospensioneDa(d); resetPage(); }}
                placeholder="Seleziona data"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sospeso Al</Label>
              <DatePicker
                value={dataSospensioneAl}
                onChange={(d) => { setDataSospensioneAl(d); resetPage(); }}
                placeholder="Seleziona data"
              />
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per numero polizza..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* KPI Sospesi */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Polizze Sospese</p>
            <p className="text-2xl font-bold mt-1">{totalCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabella */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero Polizza</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Compagnia</TableHead>
                <TableHead>Ramo</TableHead>
                <TableHead className="text-right">Premio Lordo</TableHead>
                <TableHead>Data Sospensione</TableHead>
                <TableHead>Giorni Sospeso</TableHead>
                <TableHead>Responsabile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingTitoli ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Caricamento polizze sospese...
                  </TableCell>
                </TableRow>
              ) : titoli.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Nessuna polizza sospesa corrispondente ai criteri di ricerca.
                  </TableCell>
                </TableRow>
              ) : (
                titoli.map((t) => {
                  const giorni = getGiorniSospeso(t.data_sospensione);
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/titoli/${t.id}`)}
                    >
                      <TableCell className="font-semibold text-primary">{t.numero_titolo || "—"}</TableCell>
                      <TableCell>{getClienteNome(t.clienti)}</TableCell>
                      <TableCell>{t.compagnia?.nome || "—"}</TableCell>
                      <TableCell>{t.ramo?.descrizione || "—"}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {t.premio_lordo ? `€ ${t.premio_lordo.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell>
                        {t.data_sospensione ? format(new Date(t.data_sospensione), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell>{renderBadgeGiorni(giorni)}</TableCell>
                      <TableCell>{getResponsabileNome(t)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {totalCount > pageSize && (
            <div className="p-4 border-t">
              <ServerPagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
