import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const statiRimessa = ["bozza", "pronta", "inviata", "errore"];

const RimessaList = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [compagniaId, setCompagniaId] = useState("");
  const [ufficioId, setUfficioId] = useState("");
  const [filtroStato, setFiltroStato] = useState("all");
  const [filtroCompagnia, setFiltroCompagnia] = useState("all");

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie_attive"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compagnie").select("*").eq("attiva", true).order("nome");
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

  const { data: rimesse = [], isLoading } = useQuery({
    queryKey: ["rimessa_premi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rimessa_premi")
        .select("*, compagnie(nome), uffici(nome_ufficio), profiles(nome, cognome)")
        .order("data_creazione", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = rimesse.filter((r: any) => {
    if (filtroStato !== "all" && r.stato !== filtroStato) return false;
    if (filtroCompagnia !== "all" && r.compagnia_id !== filtroCompagnia) return false;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gestione-rimessa", {
        body: {
          action: "crea",
          compagnia_id: compagniaId,
          ufficio_id: ufficioId || null,
          created_by: user?.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rimessa_premi"] });
      setOpen(false);
      setCompagniaId("");
      setUfficioId("");
      toast({ title: `Rimessa creata con ${data.titoli_count} titoli` });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  const statoBadge = (s: string) => {
    switch (s) {
      case "pronta": return "default";
      case "inviata": return "secondary";
      case "errore": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rimessa Premi</h1>
          <p className="text-muted-foreground">Aggregazione titoli incassati per invio alle compagnie</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuova Rimessa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuova Rimessa Premi</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Compagnia *</Label>
                <Select value={compagniaId} onValueChange={setCompagniaId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona compagnia" /></SelectTrigger>
                  <SelectContent>{compagnie.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ufficio</Label>
                <Select value={ufficioId} onValueChange={setUfficioId}>
                  <SelectTrigger><SelectValue placeholder="Opzionale" /></SelectTrigger>
                  <SelectContent>{uffici.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Verranno inclusi automaticamente tutti i titoli incassati della compagnia selezionata non ancora in una rimessa.</p>
              <Button onClick={() => createMutation.mutate()} disabled={!compagniaId || createMutation.isPending} className="w-full">Crea Rimessa</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <Select value={filtroStato} onValueChange={setFiltroStato}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {statiRimessa.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCompagnia} onValueChange={setFiltroCompagnia}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Compagnia" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le compagnie</SelectItem>
            {compagnie.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Send className="w-5 h-5" />Rimesse ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Caricamento...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Ufficio</TableHead>
                  <TableHead>Totale €</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Creata da</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/rimessa-premi/${r.id}`)}>
                    <TableCell className="font-medium">{r.compagnie?.nome || "—"}</TableCell>
                    <TableCell>{r.uffici?.nome_ufficio || "—"}</TableCell>
                    <TableCell className="font-mono">€ {r.totale_importi?.toFixed(2) ?? "0.00"}</TableCell>
                    <TableCell><Badge variant={statoBadge(r.stato)}>{r.stato}</Badge></TableCell>
                    <TableCell>{r.profiles ? `${r.profiles.nome} ${r.profiles.cognome}` : "—"}</TableCell>
                    <TableCell>{r.data_creazione ? format(new Date(r.data_creazione), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nessuna rimessa</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RimessaList;
