import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import ServerPagination from "@/components/ServerPagination";

const PAGE_SIZE = 25;
const statiTitolo = ["creato", "incassato", "stornato", "annullato"];

const TitoliList = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  // Form
  const [numeroTitolo, setNumeroTitolo] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [prodottoId, setProdottoId] = useState("");
  const [ufficioId, setUfficioId] = useState("");
  const [produttoreId, setProduttoreId] = useState("");
  const [premioLordo, setPremioLordo] = useState("");
  const [importoIncassato, setImportoIncassato] = useState("");
  const [dataIncasso, setDataIncasso] = useState("");
  const [stato, setStato] = useState("creato");
  const [note, setNote] = useState("");

  // Filtri
  const [filtroProdotto, setFiltroProdotto] = useState("all");
  const [filtroStato, setFiltroStato] = useState("all");
  const [filtroUfficio, setFiltroUfficio] = useState("all");
  const [filtroProduttore, setFiltroProduttore] = useState("all");

  const { data: prodotti = [] } = useQuery({
    queryKey: ["prodotti_attivi"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prodotti").select("id, nome_prodotto, compagnia_id, compagnie(nome)").eq("attivo", true).order("nome_prodotto");
      if (error) throw error;
      return data;
    },
  });

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uffici").select("*").eq("attivo", true).order("nome_ufficio");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome, cognome, ruolo").eq("attivo", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: titoliResult, isLoading } = useQuery({
    queryKey: ["titoli", page, filtroProdotto, filtroStato, filtroUfficio, filtroProduttore],
    queryFn: async () => {
      let q = supabase
        .from("titoli")
        .select("*, prodotti(nome_prodotto, compagnie(nome)), uffici(nome_ufficio), produttore:profiles!titoli_produttore_id_fkey(nome, cognome), cliente:profiles!titoli_cliente_id_fkey(nome, cognome)", { count: "exact" });

      if (filtroProdotto !== "all") q = q.eq("prodotto_id", filtroProdotto);
      if (filtroStato !== "all") q = q.eq("stato", filtroStato);
      if (filtroUfficio !== "all") q = q.eq("ufficio_id", filtroUfficio);
      if (filtroProduttore !== "all") q = q.eq("produttore_id", filtroProduttore);

      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const titoli = titoliResult?.data || [];
  const totalCount = titoliResult?.count || 0;

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        numero_titolo: numeroTitolo || null,
        cliente_id: clienteId || null,
        prodotto_id: prodottoId || null,
        ufficio_id: ufficioId || null,
        produttore_id: produttoreId || null,
        premio_lordo: premioLordo ? parseFloat(premioLordo) : null,
        importo_incassato: importoIncassato ? parseFloat(importoIncassato) : null,
        data_incasso: dataIncasso || null,
        stato,
        note: note || null,
      };
      const { data, error } = await supabase.from("titoli").insert(payload).select().single();
      if (error) throw error;

      if (user) {
        await logAttivita({ azione: "creazione_titolo", entita_tipo: "titolo", entita_id: data.id, dettagli_json: { stato } });
      }

      if (stato === "incassato") {
        await supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: data.id } });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titoli"] });
      setOpen(false);
      resetForm();
      toast({ title: "Titolo creato con successo" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setNumeroTitolo(""); setClienteId(""); setProdottoId(""); setUfficioId("");
    setProduttoreId(""); setPremioLordo(""); setImportoIncassato(""); setDataIncasso("");
    setStato("creato"); setNote("");
  };

  const statoBadgeVariant = (s: string) => {
    switch (s) {
      case "incassato": return "default";
      case "stornato": return "destructive";
      case "annullato": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Titoli</h1>
          <p className="text-muted-foreground">Gestione titoli assicurativi — logica per cassa</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuovo Titolo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuovo Titolo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Numero Titolo</Label><Input value={numeroTitolo} onChange={(e) => setNumeroTitolo(e.target.value)} /></div>
              <div>
                <Label>Prodotto</Label>
                <Select value={prodottoId} onValueChange={setProdottoId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>{prodotti.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome_prodotto}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} {p.cognome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ufficio</Label>
                <Select value={ufficioId} onValueChange={setUfficioId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>{uffici.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produttore</Label>
                <Select value={produttoreId} onValueChange={setProduttoreId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>{profiles.filter((p) => p.ruolo === "produttore").map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} {p.cognome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Premio Lordo €</Label><Input type="number" value={premioLordo} onChange={(e) => setPremioLordo(e.target.value)} /></div>
                <div><Label>Importo Incassato €</Label><Input type="number" value={importoIncassato} onChange={(e) => setImportoIncassato(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data Incasso</Label><Input type="date" value={dataIncasso} onChange={(e) => setDataIncasso(e.target.value)} /></div>
                <div>
                  <Label>Stato</Label>
                  <Select value={stato} onValueChange={setStato}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statiTitolo.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full">Crea Titolo</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-4">
        <Select value={filtroProdotto} onValueChange={handleFilterChange(setFiltroProdotto)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Prodotto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i prodotti</SelectItem>
            {prodotti.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome_prodotto}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStato} onValueChange={handleFilterChange(setFiltroStato)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {statiTitolo.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroUfficio} onValueChange={handleFilterChange(setFiltroUfficio)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Ufficio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli uffici</SelectItem>
            {uffici.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroProduttore} onValueChange={handleFilterChange(setFiltroProduttore)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Produttore" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i produttori</SelectItem>
            {profiles.filter((p) => p.ruolo === "produttore").map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} {p.cognome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Titoli ({totalCount})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Caricamento...</p> : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N. Titolo</TableHead>
                    <TableHead>Prodotto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produttore</TableHead>
                    <TableHead>Premio €</TableHead>
                    <TableHead>Incassato €</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {titoli.map((t: any) => (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/titoli/${t.id}`)}>
                      <TableCell className="font-medium">{t.numero_titolo || "—"}</TableCell>
                      <TableCell>{t.prodotti?.nome_prodotto || "—"}</TableCell>
                      <TableCell>{t.cliente ? `${t.cliente.nome} ${t.cliente.cognome}` : "—"}</TableCell>
                      <TableCell>{t.produttore ? `${t.produttore.nome} ${t.produttore.cognome}` : "—"}</TableCell>
                      <TableCell className="font-mono">{t.premio_lordo?.toFixed(2) ?? "—"}</TableCell>
                      <TableCell className="font-mono">{t.importo_incassato?.toFixed(2) ?? "—"}</TableCell>
                      <TableCell><Badge variant={statoBadgeVariant(t.stato)}>{t.stato}</Badge></TableCell>
                      <TableCell>{t.data_incasso || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {titoli.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nessun titolo</TableCell></TableRow>}
                </TableBody>
              </Table>
              <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TitoliList;
