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
import { Plus, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CompagnieList = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [codice, setCodice] = useState("");

  const { data: compagnie = [], isLoading } = useQuery({
    queryKey: ["compagnie"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compagnie").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("compagnie").insert({ nome, codice: codice || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compagnie"] });
      setOpen(false);
      setNome("");
      setCodice("");
      toast({ title: "Compagnia creata con successo" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attiva }: { id: string; attiva: boolean }) => {
      const { error } = await supabase.from("compagnie").update({ attiva }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compagnie"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compagnie</h1>
          <p className="text-muted-foreground">Gestione compagnie assicurative</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuova Compagnia</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuova Compagnia</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
              <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} /></div>
              <Button onClick={() => createMutation.mutate()} disabled={!nome || createMutation.isPending} className="w-full">Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />Lista Compagnie ({compagnie.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Caricamento...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Codice</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Attiva</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compagnie.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.codice || "—"}</TableCell>
                    <TableCell><Badge variant={c.attiva ? "default" : "secondary"}>{c.attiva ? "Attiva" : "Disattiva"}</Badge></TableCell>
                    <TableCell><Switch checked={c.attiva ?? true} onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, attiva: v })} /></TableCell>
                  </TableRow>
                ))}
                {compagnie.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nessuna compagnia</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CompagnieList;
