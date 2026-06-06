import { useState } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, AlertTriangle, Search, FileText, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import ServerPagination from "@/components/ServerPagination";
const statiSinistro = ["aperto", "in_lavorazione", "in_attesa_documenti", "chiuso", "respinto"];
const tipiSinistro = [
  "incidente_stradale", "furto", "incendio", "danni_acqua", "RC_terzi",
  "infortunio", "grandine", "atti_vandalici", "responsabilita_civile", "altro"
];

const statoBadge: Record<string, string> = {
  aperto: "bg-blue-100 text-blue-800",
  in_lavorazione: "bg-yellow-100 text-yellow-800",
  in_attesa_documenti: "bg-orange-100 text-orange-800",
  chiuso: "bg-green-100 text-green-800",
  respinto: "bg-red-100 text-red-800",
};

const getClienteName = (clienti: any) => {
  if (!clienti) return "—";
  if (clienti.tipo_cliente === "azienda" && clienti.ragione_sociale) return clienti.ragione_sociale;
  return `${clienti.cognome || ""} ${clienti.nome || ""}`.trim() || "—";
};

export default function SinistriList() {
  const navigate = useNavigate();
  const [filtroStato, setFiltroStato] = useState<string>("tutti");
  const [filtroCompagnia, setFiltroCompagnia] = useState<string>("tutti");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { page, setPage, pageSize, range } = useServerPagination(25, [filtroStato, filtroCompagnia, search]);

  // Wizard state
  const [step, setStep] = useState<1 | 2>(1);
  const [polizzaSearch, setPolizzaSearch] = useState({ cliente: "", numero: "", agenzia: "" });
  const [polizzaResults, setPolizzaResults] = useState<any[]>([]);
  const [polizzaLoading, setPolizzaLoading] = useState(false);
  const [selectedPolizza, setSelectedPolizza] = useState<any>(null);
  const [form, setForm] = useState({
    numero_sinistro: "", descrizione: "", tipo_sinistro: "", luogo_sinistro: "", data_evento: ""
  });

  const { data: sinistriResult, refetch } = useQuery({
    queryKey: ["sinistri", filtroStato, filtroCompagnia, search, page],
    queryFn: async () => {
      let q = supabase.from("sinistri").select(
        `*, compagnie(nome), profiles!sinistri_responsabile_id_fkey(nome, cognome),
         clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente),
         titoli(numero_titolo)`,
        { count: "exact" }
      );
      if (filtroStato !== "tutti") q = q.eq("stato", filtroStato);
      if (filtroCompagnia !== "tutti") q = q.eq("compagnia_id", filtroCompagnia);
      if (search) q = q.or(`numero_sinistro.ilike.%${search}%,descrizione.ilike.%${search}%`);
      const { data, error, count } = await q.order("created_at", { ascending: false }).range(range.from, range.to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const sinistri = sinistriResult?.data || [];
  const totalCount = sinistriResult?.count || 0;

  const { data: compagnie } = useQuery({
    queryKey: ["agenzie"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: eventiScaduti } = useQuery({
    queryKey: ["eventi-scaduti"],
    queryFn: async () => {
      const { data } = await supabase.from("sinistro_eventi").select("id").eq("stato", "scaduto");
      return data?.length || 0;
    },
  });

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  const searchPolizze = async () => {
    setPolizzaLoading(true);
    try {
      let q = supabase.from("titoli").select(`
        id, numero_titolo, premio_lordo, stato, created_at, cliente_anagrafica_id,
        prodotti(nome_prodotto, compagnie(id, nome)),
        profiles!titoli_cliente_id_fkey(nome, cognome),
        clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente)
      `).eq("stato", "attivo").limit(50);

      if (polizzaSearch.numero) {
        q = q.ilike("numero_titolo", `%${polizzaSearch.numero}%`);
      }

      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;

      let results = data || [];

      // Client-side filter for cliente name (search across both profiles and clienti)
      if (polizzaSearch.cliente) {
        const term = polizzaSearch.cliente.toLowerCase();
        results = results.filter((t: any) => {
          const p = t.profiles;
          const c = t.clienti;
          const profileMatch = p && `${p.nome || ""} ${p.cognome || ""}`.toLowerCase().includes(term);
          const clientiMatch = c && `${c.cognome || ""} ${c.nome || ""} ${c.ragione_sociale || ""}`.toLowerCase().includes(term);
          return profileMatch || clientiMatch;
        });
      }

      if (polizzaSearch.agenzia) {
        results = results.filter((t: any) => t.prodotti?.compagnie?.id === polizzaSearch.agenzia);
      }

      setPolizzaResults(results);
    } catch (e: any) {
      toast.error("Errore ricerca: " + e.message);
    } finally {
      setPolizzaLoading(false);
    }
  };

  const selectPolizza = (polizza: any) => {
    setSelectedPolizza(polizza);
    setStep(2);
  };

  const handleCrea = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const compagniaId = selectedPolizza?.prodotti?.compagnie?.id || null;
      const clienteAnagraficaId = selectedPolizza?.cliente_anagrafica_id || null;
      const { data, error } = await supabase.functions.invoke("gestione-sinistri", {
        body: {
          azione: "crea",
          numero_sinistro: form.numero_sinistro,
          descrizione: form.descrizione,
          compagnia_id: compagniaId,
          titolo_id: selectedPolizza?.id || null,
          cliente_anagrafica_id: clienteAnagraficaId,
          tipo_sinistro: form.tipo_sinistro || null,
          luogo_sinistro: form.luogo_sinistro || null,
          data_evento: form.data_evento || null,
          user_id: user?.id,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      toast.success("Sinistro creato");
      resetDialog();
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setStep(1);
    setPolizzaSearch({ cliente: "", numero: "", agenzia: "" });
    setPolizzaResults([]);
    setSelectedPolizza(null);
    setForm({ numero_sinistro: "", descrizione: "", tipo_sinistro: "", luogo_sinistro: "", data_evento: "" });
  };

  const getPolizzaClienteName = (t: any) => {
    if (t.clienti) return getClienteName(t.clienti);
    if (t.profiles) return `${t.profiles.nome || ""} ${t.profiles.cognome || ""}`.trim() || "—";
    return "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" /> Sinistri
          </h1>
          <p className="text-muted-foreground">Gestione pratiche sinistri</p>
        </div>
        <div className="flex items-center gap-2">
          {(eventiScaduti ?? 0) > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              ⚠ {eventiScaduti} eventi scaduti
            </Badge>
          )}
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Nuovo Sinistro</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {step === 1 ? "1. Seleziona Polizza" : "2. Dati Sinistro"}
                </DialogTitle>
                <DialogDescription>
                  {step === 1
                    ? "Cerca e seleziona la polizza su cui aprire il sinistro"
                    : "Compila i dati del sinistro per la polizza selezionata"}
                </DialogDescription>
              </DialogHeader>

              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Cliente</Label>
                      <Input
                        placeholder="Nome / Cognome / Ragione Sociale"
                        value={polizzaSearch.cliente}
                        onChange={e => setPolizzaSearch({ ...polizzaSearch, cliente: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">N° Polizza</Label>
                      <Input
                        placeholder="Numero polizza"
                        value={polizzaSearch.numero}
                        onChange={e => setPolizzaSearch({ ...polizzaSearch, numero: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Agenzia</Label>
                      <Select
                        value={polizzaSearch.agenzia || "all"}
                        onValueChange={v => setPolizzaSearch({ ...polizzaSearch, agenzia: v === "all" ? "" : v })}
                      >
                        <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutte</SelectItem>
                          {compagnie?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={searchPolizze} disabled={polizzaLoading} className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    {polizzaLoading ? "Ricerca..." : "Cerca Polizze"}
                  </Button>

                  {polizzaResults.length > 0 ? (
                    <div className="border rounded-lg max-h-[40vh] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>N° Polizza</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Prodotto</TableHead>
                            <TableHead>Agenzia</TableHead>
                            <TableHead>Premio</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {polizzaResults.map((t: any) => (
                            <TableRow
                              key={t.id}
                              className="cursor-pointer hover:bg-accent/50"
                              onClick={() => selectPolizza(t)}
                            >
                              <TableCell className="font-medium">{t.numero_titolo || "—"}</TableCell>
                              <TableCell>{getPolizzaClienteName(t)}</TableCell>
                              <TableCell>{t.prodotti?.nome_prodotto || "—"}</TableCell>
                              <TableCell>{t.prodotti?.compagnie?.nome || "—"}</TableCell>
                              <TableCell>{t.premio_lordo ? `€ ${Number(t.premio_lordo).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline">
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Seleziona
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground text-sm py-6">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      Usa i filtri e clicca "Cerca Polizze" per trovare la polizza
                    </p>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  {selectedPolizza && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                      <p className="text-sm font-semibold">Polizza selezionata</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted-foreground">N° Polizza:</span>
                        <span className="font-medium">{selectedPolizza.numero_titolo || "—"}</span>
                        <span className="text-muted-foreground">Cliente:</span>
                        <span>{getPolizzaClienteName(selectedPolizza)}</span>
                        <span className="text-muted-foreground">Prodotto:</span>
                        <span>{selectedPolizza.prodotti?.nome_prodotto || "—"}</span>
                        <span className="text-muted-foreground">Agenzia:</span>
                        <span>{selectedPolizza.prodotti?.compagnie?.nome || "—"}</span>
                      </div>
                      <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => setStep(1)}>
                        ← Cambia polizza
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Numero Sinistro</Label>
                      <Input value={form.numero_sinistro} onChange={e => setForm({ ...form, numero_sinistro: e.target.value })} placeholder="Es. SIN-2026-001" />
                    </div>
                    <div>
                      <Label>Tipo Sinistro</Label>
                      <Select value={form.tipo_sinistro} onValueChange={v => setForm({ ...form, tipo_sinistro: v })}>
                        <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
                        <SelectContent>
                          {tipiSinistro.map(t => (
                            <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Luogo Sinistro</Label>
                      <Input value={form.luogo_sinistro} onChange={e => setForm({ ...form, luogo_sinistro: e.target.value })} placeholder="Es. Via Roma 1, Milano" />
                    </div>
                    <div>
                      <Label>Data Evento</Label>
                      <Input type="date" value={form.data_evento} onChange={e => setForm({ ...form, data_evento: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Descrizione</Label>
                    <Textarea value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} rows={3} placeholder="Descrivi l'evento..." />
                  </div>
                  <Button onClick={handleCrea} className="w-full">Crea Sinistro</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca per numero, descrizione..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        <Select value={filtroStato} onValueChange={handleFilterChange(setFiltroStato)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {statiSinistro.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCompagnia} onValueChange={handleFilterChange(setFiltroCompagnia)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutte le agenzie</SelectItem>
            {compagnie?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Sinistro</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Polizza</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Agenzia</TableHead>
              <TableHead>Data Apertura</TableHead>
              <TableHead>Descrizione</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sinistri.map((s: any) => (
              <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/sinistri/${s.id}`)}>
                <TableCell className="font-medium">{s.numero_sinistro || "—"}</TableCell>
                <TableCell>{getClienteName(s.clienti)}</TableCell>
                <TableCell>{s.titoli?.numero_titolo || "—"}</TableCell>
                <TableCell className="capitalize">{s.tipo_sinistro?.replace(/_/g, " ") || "—"}</TableCell>
                <TableCell>
                  <Badge className={statoBadge[s.stato]}>{s.stato.replace(/_/g, " ")}</Badge>
                </TableCell>
                <TableCell>{s.compagnie?.nome || "—"}</TableCell>
                <TableCell>{s.data_apertura ? format(new Date(s.data_apertura), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{s.descrizione || "—"}</TableCell>
              </TableRow>
            ))}
            {!sinistri.length && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nessun sinistro trovato</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <div className="p-4">
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
