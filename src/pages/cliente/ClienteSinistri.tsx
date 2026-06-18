import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertTriangle, ShieldCheck, Clock, DollarSign, ChevronDown, ChevronRight, MapPin, User, FileText, Plus, ExternalLink, Filter, Download, X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import NuovaDenunciaSinistroDialog from "@/components/cliente/NuovaDenunciaSinistroDialog";
import SinistroDocumentiCliente from "@/components/cliente/SinistroDocumentiCliente";
import { fmtEuro0 as fmt } from "@/lib/formatCurrency";
import { exportSinistriXlsx } from "@/lib/exportSinistriXlsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLORS_OPEN = ["#3b82f6", "#f97316", "#a855f7", "#ef4444", "#14b8a6", "#eab308"];
const COLORS_CLOSED = ["#93c5fd", "#fdba74", "#d8b4fe", "#fca5a5", "#5eead4", "#fde047"];

const statoBadge: Record<string, string> = {
  in_valutazione: "bg-amber-100 text-amber-800",
  aperto: "bg-blue-100 text-blue-800",
  in_lavorazione: "bg-yellow-100 text-yellow-800",
  in_attesa_documenti: "bg-orange-100 text-orange-800",
  in_liquidazione: "bg-purple-100 text-purple-800",
  chiuso: "bg-green-100 text-green-800",
  respinto: "bg-red-100 text-red-800",
};



export default function ClienteSinistri() {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openNuovo, setOpenNuovo] = useState(false);

export default function ClienteSinistri() {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openNuovo, setOpenNuovo] = useState(false);

  // Filtri
  const [fSearch, setFSearch] = useState("");
  const [fStato, setFStato] = useState<string>("all");
  const [fRamo, setFRamo] = useState<string>("all");
  const [fCompagnia, setFCompagnia] = useState<string>("all");
  const [fPolizza, setFPolizza] = useState<string>("all");
  const [fProvincia, setFProvincia] = useState<string>("all");
  const [fCitta, setFCitta] = useState<string>("all");
  const [fDataDa, setFDataDa] = useState<Date | undefined>();
  const [fDataA, setFDataA] = useState<Date | undefined>();

  // Selezione
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const { data: sinistri = [], refetch } = useQuery({
    queryKey: ["cliente-sinistri", user?.id],
    queryFn: async () => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) return [];
      const { data, error } = await supabase
        .from("sinistri")
        .select("*, compagnie(nome), titoli(id, numero_titolo), anagrafiche_professionali!sinistri_perito_id_fkey(nome, cognome, ragione_sociale)")
        .in("cliente_anagrafica_id", clienteIds.map((c: any) => c))
        .order("data_apertura", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Opzioni filtri (uniche dal dataset)
  const distinct = (key: (s: any) => string | undefined | null) =>
    Array.from(new Set(sinistri.map(key).filter(Boolean))) as string[];
  const optStati = distinct((s) => s.stato);
  const optRami = distinct((s) => s.ramo_sinistro);
  const optCompagnie = distinct((s) => s.compagnie?.nome);
  const optPolizze = distinct((s) => s.titoli?.numero_titolo);
  const optProvince = distinct((s) => s.provincia_sinistro);
  const optCitta = distinct((s) => s.citta_sinistro);

  const filteredSinistri = useMemo(() => {
    const q = fSearch.trim().toLowerCase();
    return sinistri.filter((s: any) => {
      if (fStato !== "all" && s.stato !== fStato) return false;
      if (fRamo !== "all" && s.ramo_sinistro !== fRamo) return false;
      if (fCompagnia !== "all" && s.compagnie?.nome !== fCompagnia) return false;
      if (fPolizza !== "all" && s.titoli?.numero_titolo !== fPolizza) return false;
      if (fProvincia !== "all" && s.provincia_sinistro !== fProvincia) return false;
      if (fCitta !== "all" && s.citta_sinistro !== fCitta) return false;
      if (fDataDa && (!s.data_evento || new Date(s.data_evento) < fDataDa)) return false;
      if (fDataA && (!s.data_evento || new Date(s.data_evento) > fDataA)) return false;
      if (q) {
        const hay = [s.numero_sinistro, s.numero_sinistro_compagnia, s.controparte, s.targa_veicolo, s.citta_sinistro, s.dinamica]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sinistri, fSearch, fStato, fRamo, fCompagnia, fPolizza, fProvincia, fCitta, fDataDa, fDataA]);

  const resetFilters = () => {
    setFSearch(""); setFStato("all"); setFRamo("all"); setFCompagnia("all");
    setFPolizza("all"); setFProvincia("all"); setFCitta("all");
    setFDataDa(undefined); setFDataA(undefined);
  };

  const aperti = filteredSinistri.filter((s: any) => !["chiuso", "respinto"].includes(s.stato)).length;
  const chiusi = filteredSinistri.length - aperti;
  const riserve = filteredSinistri.reduce((s: number, x: any) => s + (x.importo_riserva || 0), 0);
  const liquidato = filteredSinistri.reduce((s: number, x: any) => s + (x.importo_liquidato || 0), 0);

  // Pie - Sinistri per Ramo (aperti vs chiusi)
  const sinPerRamo = filteredSinistri.reduce((acc: any[], s: any) => {
    const ramo = s.ramo_sinistro || "Altro";
    const isOpen = !["chiuso", "respinto"].includes(s.stato);
    const key = `${ramo} (${isOpen ? "Aperti" : "Chiusi"})`;
    const existing = acc.find(a => a.name === key);
    if (existing) existing.value++;
    else acc.push({ name: key, value: 1, ramo, isOpen });
    return acc;
  }, []);

  // Bar data riserve vs liquidato
  const barData = filteredSinistri.map((s: any) => ({
    name: s.numero_sinistro?.replace("SIN-VA-", "") || "—",
    riserva: s.importo_riserva || 0,
    liquidato: s.importo_liquidato || 0,
  }));

  const kpis = [
    { label: "Totale", value: filteredSinistri.length, icon: AlertTriangle, color: "text-blue-600", bg: "bg-blue-100", border: "#2563eb" },
    { label: "Aperti", value: aperti, icon: Clock, color: "text-orange-600", bg: "bg-orange-100", border: "#ea580c" },
    { label: "Chiusi", value: chiusi, icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-100", border: "#059669" },
    { label: "Riserve Totali", value: fmt(riserve), icon: DollarSign, color: "text-red-600", bg: "bg-red-100", border: "#dc2626" },
    { label: "Liquidato", value: fmt(liquidato), icon: DollarSign, color: "text-teal-600", bg: "bg-teal-100", border: "#0d9488" },
  ];

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allFilteredSelected = filteredSinistri.length > 0 && filteredSinistri.every((s: any) => selectedIds.has(s.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredSinistri.forEach((s: any) => next.delete(s.id));
        return next;
      }
      const next = new Set(prev);
      filteredSinistri.forEach((s: any) => next.add(s.id));
      return next;
    });
  };

  const handleExport = async (mode: "selected" | "filtered") => {
    const list = mode === "selected"
      ? filteredSinistri.filter((s: any) => selectedIds.has(s.id))
      : filteredSinistri;
    if (!list.length) { toast.error("Nessun sinistro da esportare"); return; }
    setExporting(true);
    try {
      await exportSinistriXlsx(list);
      toast.success(`Esportati ${list.length} sinistri`);
    } catch (e: any) {
      toast.error("Errore export: " + (e?.message || e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div data-tour="cl-sin-page" className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">I Miei Sinistri</h1>
            <p className="text-sm text-muted-foreground">{sinistri.length} sinistri registrati</p>
          </div>
        </div>
        <Button onClick={() => setOpenNuovo(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Apri nuovo sinistro
        </Button>
      </div>

      <NuovaDenunciaSinistroDialog open={openNuovo} onOpenChange={setOpenNuovo} onCreated={() => refetch()} />

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="border-l-4" style={{ borderLeftColor: k.border }}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full ${k.bg} flex items-center justify-center`}>
                  <k.icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      {sinistri.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Sinistri per Ramo (Aperti vs Chiusi)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={sinPerRamo} cx="50%" cy="50%" innerRadius={50} outerRadius={95} paddingAngle={3} dataKey="value" label={({ name, value }) => `${value}`} labelLine={false}>
                    {sinPerRamo.map((entry, i) => (
                      <Cell key={i} fill={entry.isOpen ? COLORS_OPEN[i % COLORS_OPEN.length] : COLORS_CLOSED[i % COLORS_CLOSED.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Riserve vs Liquidato</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="riserva" name="Riserva" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="liquidato" name="Liquidato" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Elenco Sinistri</CardTitle></CardHeader>
        <CardContent>
          {sinistri.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessun sinistro presente</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>N. Sinistro</TableHead>
                    <TableHead>Garanzia</TableHead>
                    <TableHead>Polizza</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Luogo</TableHead>
                    <TableHead className="text-right">Riserva</TableHead>
                    <TableHead className="text-right">Liquidato</TableHead>
                    <TableHead>Data Evento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sinistri.map((s: any) => (
                    <>
                      <TableRow
                        key={s.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => toggleExpand(s.id)}
                      >
                        <TableCell className="w-8 px-2">
                          {expandedId === s.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-medium">{s.numero_sinistro || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-normal">{s.ramo_sinistro || "—"}</Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {s.titoli?.id ? (
                            <Link to={`/cliente/polizze/${s.titoli.id}`} className="text-teal-700 hover:underline inline-flex items-center gap-1">
                              {s.titoli.numero_titolo}<ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : "—"}
                        </TableCell>
                        <TableCell><Badge className={statoBadge[s.stato] || ""}>{s.stato?.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">{s.citta_sinistro || s.luogo_sinistro || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{s.importo_riserva ? fmt(s.importo_riserva) : "—"}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">{s.importo_liquidato ? fmt(s.importo_liquidato) : "—"}</TableCell>
                        <TableCell>{s.data_evento ? format(new Date(s.data_evento), "dd/MM/yyyy") : "—"}</TableCell>
                      </TableRow>

                      {/* Expanded Detail Panel */}
                      {expandedId === s.id && (
                        <TableRow key={`${s.id}-detail`}>
                          <TableCell colSpan={9} className="bg-muted/20 p-0">
                            <div className="p-4 space-y-4">
                              {/* Dinamica */}
                              {s.dinamica && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Dinamica del sinistro</p>
                                  <p className="text-sm">{s.dinamica}</p>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Indirizzo */}
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><MapPin className="h-3 w-3" /> Luogo sinistro</p>
                                  <div className="text-sm space-y-0.5">
                                    {s.indirizzo_sinistro && <p>{s.indirizzo_sinistro}</p>}
                                    <p>{[s.cap_sinistro, s.citta_sinistro, s.provincia_sinistro ? `(${s.provincia_sinistro})` : null].filter(Boolean).join(" ") || s.luogo_sinistro || "—"}</p>
                                  </div>
                                </div>

                                {/* Persone coinvolte */}
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><User className="h-3 w-3" /> Soggetti coinvolti</p>
                                  <div className="text-sm space-y-1">
                                    {s.controparte && <p><span className="text-muted-foreground">Controparte:</span> {s.controparte}</p>}
                                    {s.medico_legale && <p><span className="text-muted-foreground">Medico legale:</span> {s.medico_legale}</p>}
                                    {s.anagrafiche_professionali && (
                                      <p><span className="text-muted-foreground">Perito:</span> {s.anagrafiche_professionali.cognome} {s.anagrafiche_professionali.nome}</p>
                                    )}
                                    {s.targa_veicolo && <p><span className="text-muted-foreground">Targa:</span> {s.targa_veicolo}</p>}
                                  </div>
                                </div>

                                {/* Importi e dati */}
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><FileText className="h-3 w-3" /> Dettaglio economico</p>
                                  <div className="text-sm space-y-1">
                                    {s.numero_sinistro_compagnia && <p><span className="text-muted-foreground">N° Compagnia:</span> {s.numero_sinistro_compagnia}</p>}
                                    {s.data_denuncia && <p><span className="text-muted-foreground">Data denuncia:</span> {format(new Date(s.data_denuncia), "dd/MM/yyyy")}</p>}
                                    {s.franchigia != null && s.franchigia > 0 && <p><span className="text-muted-foreground">Franchigia:</span> {fmt(s.franchigia)}</p>}
                                    {s.costo_preventivato != null && <p><span className="text-muted-foreground">Costo preventivato:</span> {fmt(s.costo_preventivato)}</p>}
                                    {s.costo_effettivo != null && <p><span className="text-muted-foreground">Costo effettivo:</span> {fmt(s.costo_effettivo)}</p>}
                                  </div>
                                </div>
                              </div>

                              {/* Note perito */}
                              {s.note_perito && (
                                <div className="border-t pt-3">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Note del perito</p>
                                  <p className="text-sm italic">{s.note_perito}</p>
                                </div>
                              )}

                              {/* Documenti del sinistro */}
                              <SinistroDocumentiCliente sinistroId={s.id} />

                              <div className="flex justify-end pt-2 border-t">
                                <Link to={`/cliente/sinistri/${s.id}`}>
                                  <Button size="sm" variant="outline" className="gap-1.5">
                                    Apri dettaglio completo <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
