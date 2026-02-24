import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Grid3X3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MatriceProvvigioni = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [prodottoId, setProdottoId] = useState("");
  const [ruolo, setRuolo] = useState("");
  const [ufficioId, setUfficioId] = useState("");
  const [userId, setUserId] = useState("");
  const [percentuale, setPercentuale] = useState("");
  const [tipoCalcolo, setTipoCalcolo] = useState("percentuale");

  // Filtri
  const [filtroProdotto, setFiltroProdotto] = useState("all");
  const [filtroRuolo, setFiltroRuolo] = useState("all");
  const [filtroUfficio, setFiltroUfficio] = useState("all");
  const [filtroUtente, setFiltroUtente] = useState("all");

  const { data: prodotti = [] } = useQuery({
    queryKey: ["prodotti_attivi"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prodotti").select("id, nome_prodotto").eq("attivo", true).order("nome_prodotto");
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

  const { data: regole = [], isLoading } = useQuery({
    queryKey: ["matrice_provvigioni"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matrice_provvigioni")
        .select("*, prodotti(nome_prodotto), uffici(nome_ufficio), profiles(nome, cognome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = regole.filter((r: any) => {
    if (filtroProdotto !== "all" && r.prodotto_id !== filtroProdotto) return false;
    if (filtroRuolo !== "all" && r.ruolo !== filtroRuolo) return false;
    if (filtroUfficio !== "all" && r.ufficio_id !== filtroUfficio) return false;
    if (filtroUtente !== "all" && r.user_id !== filtroUtente) return false;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("matrice_provvigioni").insert({
        prodotto_id: prodottoId,
        ruolo: ruolo || null,
        ufficio_id: ufficioId || null,
        user_id: userId || null,
        percentuale_provvigione: parseFloat(percentuale),
        tipo_calcolo: tipoCalcolo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matrice_provvigioni"] });
      setOpen(false);
      setProdottoId("");
      setRuolo("");
      setUfficioId("");
      setUserId("");
      setPercentuale("");
      setTipoCalcolo("percentuale");
      toast({ title: "Regola provvigione creata" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  const priorityLabel = (r: any) => {
    if (r.user_id) return { label: "Utente", variant: "default" as const };
    if (r.ufficio_id) return { label: "Ufficio", variant: "secondary" as const };
    return { label: "Ruolo", variant: "outline" as const };
  };

  const ruoli = ["admin", "ufficio", "produttore", "contabilita", "cfo", "cliente"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Matrice Provvigioni</h1>
          <p className="text-muted-foreground">Regole provvigionali per prodotto, ruolo, ufficio e utente</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuova Regola</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nuova Regola Provvigione</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Prodotto *</Label>
                <Select value={prodottoId} onValueChange={setProdottoId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona prodotto" /></SelectTrigger>
                  <SelectContent>{prodotti.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_prodotto}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ruolo (priorità 3)</Label>
                <Select value={ruolo} onValueChange={setRuolo}>
                  <SelectTrigger><SelectValue placeholder="Opzionale" /></SelectTrigger>
                  <SelectContent>{ruoli.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ufficio (priorità 2)</Label>
                <Select value={ufficioId} onValueChange={setUfficioId}>
                  <SelectTrigger><SelectValue placeholder="Opzionale" /></SelectTrigger>
                  <SelectContent>{uffici.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Utente specifico (priorità 1 - massima)</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger><SelectValue placeholder="Opzionale" /></SelectTrigger>
                  <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} {p.cognome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valore *</Label>
                  <Input type="number" value={percentuale} onChange={(e) => setPercentuale(e.target.value)} placeholder="es. 10" />
                </div>
                <div>
                  <Label>Tipo Calcolo</Label>
                  <Select value={tipoCalcolo} onValueChange={setTipoCalcolo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentuale">Percentuale %</SelectItem>
                      <SelectItem value="fisso">Fisso €</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!prodottoId || !percentuale || createMutation.isPending} className="w-full">Crea Regola</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info priorità */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Logica di Priorità</CardTitle>
          <CardDescription>La provvigione viene calcolata cercando la regola più specifica: 1° Utente → 2° Ufficio → 3° Ruolo</CardDescription>
        </CardHeader>
      </Card>

      {/* Filtri */}
      <div className="flex flex-wrap gap-4">
        <Select value={filtroProdotto} onValueChange={setFiltroProdotto}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Prodotto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i prodotti</SelectItem>
            {prodotti.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_prodotto}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroRuolo} onValueChange={setFiltroRuolo}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Ruolo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i ruoli</SelectItem>
            {ruoli.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroUfficio} onValueChange={setFiltroUfficio}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Ufficio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli uffici</SelectItem>
            {uffici.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroUtente} onValueChange={setFiltroUtente}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Utente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli utenti</SelectItem>
            {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} {p.cognome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Grid3X3 className="w-5 h-5" />Regole ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Caricamento...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prodotto</TableHead>
                  <TableHead>Priorità</TableHead>
                  <TableHead>Ruolo</TableHead>
                  <TableHead>Ufficio</TableHead>
                  <TableHead>Utente</TableHead>
                  <TableHead>Valore</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => {
                  const p = priorityLabel(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.prodotti?.nome_prodotto || "—"}</TableCell>
                      <TableCell><Badge variant={p.variant}>{p.label}</Badge></TableCell>
                      <TableCell>{r.ruolo || "—"}</TableCell>
                      <TableCell>{r.uffici?.nome_ufficio || "—"}</TableCell>
                      <TableCell>{r.profiles ? `${r.profiles.nome} ${r.profiles.cognome}` : "—"}</TableCell>
                      <TableCell className="font-mono">{r.percentuale_provvigione}</TableCell>
                      <TableCell>{r.tipo_calcolo === "percentuale" ? "%" : "€"}</TableCell>
                      <TableCell><Badge variant={r.attiva ? "default" : "secondary"}>{r.attiva ? "Attiva" : "Disattiva"}</Badge></TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nessuna regola</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MatriceProvvigioni;
