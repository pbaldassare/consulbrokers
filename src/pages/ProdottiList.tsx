import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ProdottiList = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nomeProdotto, setNomeProdotto] = useState("");
  const [codiceProdotto, setCodiceProdotto] = useState("");
  const [compagniaId, setCompagniaId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [multititolo, setMultititolo] = useState(false);
  const [filtroCompagnia, setFiltroCompagnia] = useState("all");
  const [filtroCategoria, setFiltroCategoria] = useState("all");

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compagnie").select("*").eq("attiva", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: categorie = [] } = useQuery({
    queryKey: ["categorie_prodotto"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorie_prodotto").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: prodotti = [], isLoading } = useQuery({
    queryKey: ["prodotti"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prodotti").select("*, compagnie(nome), categorie_prodotto(nome)").order("nome_prodotto");
      if (error) throw error;
      return data;
    },
  });

  const filtered = prodotti.filter((p) => {
    if (filtroCompagnia !== "all" && p.compagnia_id !== filtroCompagnia) return false;
    if (filtroCategoria !== "all" && p.categoria_id !== filtroCategoria) return false;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("prodotti").insert({
        nome_prodotto: nomeProdotto,
        codice_prodotto: codiceProdotto || null,
        compagnia_id: compagniaId || null,
        categoria_id: categoriaId || null,
        multititolo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prodotti"] });
      setOpen(false);
      setNomeProdotto("");
      setCodiceProdotto("");
      setCompagniaId("");
      setCategoriaId("");
      setMultititolo(false);
      toast({ title: "Prodotto creato con successo" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prodotti</h1>
          <p className="text-muted-foreground">Catalogo prodotti assicurativi</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuovo Prodotto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo Prodotto</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome Prodotto *</Label><Input value={nomeProdotto} onChange={(e) => setNomeProdotto(e.target.value)} /></div>
              <div><Label>Codice Prodotto</Label><Input value={codiceProdotto} onChange={(e) => setCodiceProdotto(e.target.value)} /></div>
              <div>
                <Label>Compagnia</Label>
                <Select value={compagniaId} onValueChange={setCompagniaId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona compagnia" /></SelectTrigger>
                  <SelectContent>{compagnie.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                  <SelectContent>{categorie.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={multititolo} onCheckedChange={setMultititolo} />
                <Label>Multititolo</Label>
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!nomeProdotto || createMutation.isPending} className="w-full">Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtri */}
      <div className="flex gap-4">
        <Select value={filtroCompagnia} onValueChange={setFiltroCompagnia}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Compagnia" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le compagnie</SelectItem>
            {compagnie.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {categorie.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" />Prodotti ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Caricamento...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prodotto</TableHead>
                  <TableHead>Codice</TableHead>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Multititolo</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome_prodotto}</TableCell>
                    <TableCell>{p.codice_prodotto || "—"}</TableCell>
                    <TableCell>{p.compagnie?.nome || "—"}</TableCell>
                    <TableCell>{p.categorie_prodotto?.nome || "—"}</TableCell>
                    <TableCell>{p.multititolo ? <Badge>Sì</Badge> : "No"}</TableCell>
                    <TableCell><Badge variant={p.attivo ? "default" : "secondary"}>{p.attivo ? "Attivo" : "Disattivo"}</Badge></TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nessun prodotto</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProdottiList;
