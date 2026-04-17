import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  AlertCircle, Banknote, CalendarIcon, CreditCard, Download, FileDown, FileText,
  HandCoins, Landmark, Lock, Plus, RefreshCw, Unlock
} from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

// Normalizza i tipi di pagamento (singolare/plurale → forma canonica plurale)
const normalizeTipo = (t: string | null | undefined): string => {
  const s = (t || "altro").toLowerCase().trim();
  if (s === "assegno") return "assegni";
  if (s === "bonifico") return "bonifici";
  return s;
};

const TIPO_ICONS: Record<string, any> = {
  contanti: Banknote,
  assegni: HandCoins,
  bonifici: Landmark,
  pos: CreditCard,
};

const DistintaGiornaliera = () => {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const uffId = profile?.ufficio_id;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dataSelezionata = format(selectedDate, "yyyy-MM-dd");
  const [note, setNote] = useState("");

  // Fetch distinta for selected date
  const { data: distinta, isLoading, refetch } = useQuery({
    queryKey: ["distinta_giornaliera", dataSelezionata, uffId],
    queryFn: async () => {
      const q = supabase
        .from("distinte_giornaliere")
        .select("*, distinte_giornaliere_righe(*)")
        .eq("data_distinta", dataSelezionata);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch movimenti for the date (to auto-generate)
  const { data: movGiorno = [] } = useQuery({
    queryKey: ["mov_giorno_distinta", dataSelezionata, uffId],
    queryFn: async () => {
      const q = supabase.from("movimenti_contabili").select("*").eq("data_movimento", dataSelezionata);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  // Storico distinte
  const { data: storico = [] } = useQuery({
    queryKey: ["distinte_storico", uffId],
    queryFn: async () => {
      const q = supabase
        .from("distinte_giornaliere")
        .select("id, data_distinta, stato, totale_generale, totale_contanti, totale_assegni, totale_bonifici, totale_pos")
        .order("data_distinta", { ascending: false })
        .limit(30);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Grouped view
  const righe: any[] = (distinta as any)?.distinte_giornaliere_righe || [];
  const raggruppamento = useMemo(() => {
    const groups: Record<string, { righe: any[]; totale: number }> = {};
    righe.forEach((r: any) => {
      const tipo = (r.tipo_pagamento || "altro").toLowerCase();
      if (!groups[tipo]) groups[tipo] = { righe: [], totale: 0 };
      groups[tipo].righe.push(r);
      groups[tipo].totale += r.importo || 0;
    });
    return groups;
  }, [righe]);

  // Generate distinta
  const generaMut = useMutation({
    mutationFn: async () => {
      const righeByTipo: Record<string, number> = {};
      movGiorno.forEach((m) => {
        const tipo = m.categoria || (m.tipo === "entrata" ? "bonifico" : "altro");
        righeByTipo[tipo] = (righeByTipo[tipo] || 0) + m.importo;
      });

      const totContanti = righeByTipo["contanti"] || 0;
      const totAssegni = righeByTipo["assegni"] || righeByTipo["assegno"] || 0;
      const totBonifici = righeByTipo["bonifico"] || righeByTipo["bonifici"] || 0;
      const totPos = righeByTipo["pos"] || 0;
      const totGenerale = movGiorno.reduce((s, m) => s + m.importo, 0);

      const { data: dist, error } = await supabase
        .from("distinte_giornaliere")
        .insert({
          data_distinta: dataSelezionata,
          ufficio_id: uffId,
          creato_da: user?.id,
          totale_contanti: totContanti,
          totale_assegni: totAssegni,
          totale_bonifici: totBonifici,
          totale_pos: totPos,
          totale_generale: totGenerale,
          note: note || null,
        })
        .select()
        .single();
      if (error) throw error;

      const righeInsert = movGiorno.map((m) => ({
        distinta_id: dist.id,
        movimento_id: m.id,
        tipo_pagamento: m.categoria || m.tipo,
        importo: m.importo,
        descrizione: m.descrizione,
        riferimento: m.riferimento_id,
      }));
      if (righeInsert.length > 0) {
        const { error: errR } = await supabase.from("distinte_giornaliere_righe").insert(righeInsert);
        if (errR) throw errR;
      }
      return dist;
    },
    onSuccess: () => {
      toast.success("Distinta generata con successo");
      qc.invalidateQueries({ queryKey: ["distinta_giornaliera"] });
      qc.invalidateQueries({ queryKey: ["distinte_storico"] });
    },
    onError: (e: any) => {
      toast.error("Errore");
    },
  });

  // Chiudi/Riapri distinta
  const chiudiMut = useMutation({
    mutationFn: async () => {
      if (!distinta) return;
      const { error } = await supabase
        .from("distinte_giornaliere")
        .update({ stato: "chiusa", chiuso_da: user?.id, chiuso_il: new Date().toISOString() })
        .eq("id", distinta.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Distinta chiusa");
      qc.invalidateQueries({ queryKey: ["distinta_giornaliera"] });
      qc.invalidateQueries({ queryKey: ["distinte_storico"] });
    },
  });

  const riapriMut = useMutation({
    mutationFn: async () => {
      if (!distinta) return;
      const { error } = await supabase
        .from("distinte_giornaliere")
        .update({ stato: "riaperta", chiuso_da: null, chiuso_il: null })
        .eq("id", distinta.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Distinta riaperta");
      qc.invalidateQueries({ queryKey: ["distinta_giornaliera"] });
      qc.invalidateQueries({ queryKey: ["distinte_storico"] });
    },
  });

  // Export CSV
  const exportCSV = () => {
    if (!distinta) return;
    const BOM = "\uFEFF";
    const header = "Tipo Pagamento;Importo;Descrizione;Riferimento\n";
    const rows = righe
      .map((r: any) => `${r.tipo_pagamento};${r.importo};${(r.descrizione || "").replace(/;/g, ",")};${r.riferimento || ""}`)
      .join("\n");

    // Add summary
    const summary = `\n\nRIEPILOGO\nContanti;${distinta.totale_contanti || 0}\nAssegni;${distinta.totale_assegni || 0}\nBonifici;${distinta.totale_bonifici || 0}\nPOS;${distinta.totale_pos || 0}\nTOTALE;${distinta.totale_generale || 0}`;

    const blob = new Blob([BOM + header + rows + summary], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `distinta_${dataSelezionata}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF (opens printable HTML in new tab)
  const exportPDF = async () => {
    if (!distinta) return;
    try {
      const { data, error } = await supabase.functions.invoke("genera-distinta-pdf", {
        body: {
          data_distinta: format(selectedDate, "d MMMM yyyy", { locale: it }),
          ufficio_nome: profile?.ufficio_id ? "Ufficio" : "—",
          totale_contanti: distinta.totale_contanti,
          totale_assegni: distinta.totale_assegni,
          totale_bonifici: distinta.totale_bonifici,
          totale_pos: distinta.totale_pos,
          totale_generale: distinta.totale_generale,
          saldo_cassa_atteso: distinta.saldo_cassa_atteso || distinta.totale_generale,
          differenza_cassa: distinta.differenza_cassa || 0,
          righe: righe.map((r: any) => ({
            tipo_pagamento: r.tipo_pagamento,
            descrizione: r.descrizione,
            importo: r.importo,
          })),
          note: distinta.note,
        },
      });

      if (error) throw error;

      // data is the HTML string - open in new window for printing
      const html = typeof data === "string" ? data : await (data as any)?.text?.() || JSON.stringify(data);
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 500);
      }
    } catch (e: any) {
      toast.error("Errore generazione PDF");
    }
  };

  const kpiCards = [
    { label: "Contanti", value: distinta?.totale_contanti, icon: Banknote, color: "border-l-green-500" },
    { label: "Assegni", value: distinta?.totale_assegni, icon: HandCoins, color: "border-l-amber-500" },
    { label: "Bonifici", value: distinta?.totale_bonifici, icon: Landmark, color: "border-l-blue-500" },
    { label: "POS", value: distinta?.totale_pos, icon: CreditCard, color: "border-l-purple-500" },
    { label: "Totale", value: distinta?.totale_generale, icon: FileText, color: "border-l-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Distinta Giornaliera</h1>
          <p className="text-sm text-muted-foreground">
            Riepilogo incassi e pagamenti — {format(selectedDate, "EEEE d MMMM yyyy", { locale: it })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(selectedDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>Oggi</Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Caricamento...</p>
      ) : !distinta ? (
        /* No distinta yet */
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nessuna distinta per il {format(selectedDate, "d MMMM yyyy", { locale: it })}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {movGiorno.length} movimenti trovati per questa data.
            </p>
            {movGiorno.length > 0 && (
              <div className="max-w-md mx-auto space-y-3 mb-4">
                <Textarea
                  placeholder="Note aggiuntive (opzionale)..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>
            )}
            <Button onClick={() => generaMut.mutate()} disabled={movGiorno.length === 0 || generaMut.isPending}>
              <Plus className="w-4 h-4 mr-2" />
              Genera Distinta ({movGiorno.length} movimenti)
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards per tipo pagamento */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {kpiCards.map((k) => {
              const Icon = k.icon;
              return (
                <Card key={k.label} className={`border-l-4 ${k.color}`}>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1 text-xs">
                      <Icon className="w-3.5 h-3.5" /> {k.label}
                    </CardDescription>
                    <CardTitle className={`text-xl ${k.label === "Totale" ? "text-primary" : ""}`}>
                      {fmt(k.value || 0)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {raggruppamento[k.label.toLowerCase()]?.righe.length || 0} mov.
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Stato e azioni */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={distinta.stato === "chiusa" ? "default" : "secondary"} className="text-xs">
              {distinta.stato === "chiusa" ? (
                <><Lock className="w-3 h-3 mr-1" /> Chiusa</>
              ) : (
                <><Unlock className="w-3 h-3 mr-1" /> {distinta.stato === "riaperta" ? "Riaperta" : "Aperta"}</>
              )}
            </Badge>
            {distinta.stato !== "chiusa" && (
              <Button size="sm" onClick={() => chiudiMut.mutate()} disabled={chiudiMut.isPending}>
                <Lock className="w-3.5 h-3.5 mr-1" /> Chiudi Distinta
              </Button>
            )}
            {distinta.stato === "chiusa" && (
              <Button size="sm" variant="outline" onClick={() => riapriMut.mutate()} disabled={riapriMut.isPending}>
                <Unlock className="w-3.5 h-3.5 mr-1" /> Riapri
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="outline" onClick={exportCSV}>
                <Download className="w-3.5 h-3.5 mr-1" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={exportPDF}>
                <FileDown className="w-3.5 h-3.5 mr-1" /> PDF
              </Button>
            </div>
          </div>

          {/* Tabs: Raggruppato / Dettaglio */}
          <Tabs defaultValue="raggruppato">
            <TabsList>
              <TabsTrigger value="raggruppato">Per Tipo Pagamento</TabsTrigger>
              <TabsTrigger value="dettaglio">Dettaglio Completo</TabsTrigger>
            </TabsList>

            <TabsContent value="raggruppato" className="space-y-4 mt-4">
              {Object.keys(raggruppamento).length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nessun movimento nella distinta
                  </CardContent>
                </Card>
              ) : (
                Object.entries(raggruppamento).map(([tipo, group]) => {
                  const Icon = TIPO_ICONS[tipo] || FileText;
                  return (
                    <Card key={tipo}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2 capitalize">
                            <Icon className="w-4 h-4" />
                            {tipo} ({group.righe.length})
                          </CardTitle>
                          <span className="font-mono font-bold text-sm">{fmt(group.totale)}</span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Descrizione</TableHead>
                              <TableHead className="text-right">Importo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.righe.map((r: any) => (
                              <TableRow key={r.id}>
                                <TableCell className="text-sm truncate max-w-[350px]">{r.descrizione || "—"}</TableCell>
                                <TableCell className="text-right font-mono text-sm">{fmt(r.importo)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="dettaglio" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tutti i Movimenti ({righe.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo Pagamento</TableHead>
                        <TableHead>Descrizione</TableHead>
                        <TableHead className="text-right">Importo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {righe.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] capitalize">{r.tipo_pagamento}</Badge>
                          </TableCell>
                          <TableCell className="text-sm truncate max-w-[300px]">{r.descrizione || "—"}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(r.importo)}</TableCell>
                        </TableRow>
                      ))}
                      {righe.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">Nessuna riga</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Note */}
          {distinta.note && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{distinta.note}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Storico */}
      {storico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Storico Distinte</CardTitle>
            <CardDescription>Ultime 30 distinte generate</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Contanti</TableHead>
                  <TableHead className="text-right">Assegni</TableHead>
                  <TableHead className="text-right">Bonifici</TableHead>
                  <TableHead className="text-right">POS</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storico.map((s: any) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedDate(new Date(s.data_distinta + "T12:00:00"))}
                  >
                    <TableCell className="font-mono text-xs">{s.data_distinta}</TableCell>
                    <TableCell>
                      <Badge variant={s.stato === "chiusa" ? "default" : "secondary"} className="text-[10px]">
                        {s.stato}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt(s.totale_contanti || 0)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt(s.totale_assegni || 0)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt(s.totale_bonifici || 0)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt(s.totale_pos || 0)}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold">{fmt(s.totale_generale || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DistintaGiornaliera;
