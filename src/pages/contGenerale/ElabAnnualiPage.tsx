import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { format } from "date-fns";

const TIPI = [
  { value: "cu", label: "Certificazione Unica" },
  { value: "770", label: "Modello 770" },
  { value: "iva_annuale", label: "IVA Annuale" },
];

const ElabAnnualiPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "cu", anno: new Date().getFullYear() });

  const { data: elaborazioni = [], isLoading } = useQuery({
    queryKey: ["elab_annuali"],
    queryFn: async () => {
      const { data, error } = await supabase.from("elab_annuali").select("*").order("anno", { ascending: false }).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("elab_annuali").insert({
        tipo: form.tipo,
        anno: form.anno,
        eseguita_da: user?.id,
        stato: "elaborata",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elab_annuali"] });
      setDialogOpen(false);
      toast.success("Elaborazione annuale creata");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageBreadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Elaborazioni Annuali</h1>
            <p className="text-sm text-muted-foreground">CU, Modello 770, IVA Annuale</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Nuova Elaborazione</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Anno</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data Esecuzione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
              ) : elaborazioni.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nessuna elaborazione annuale</TableCell></TableRow>
              ) : elaborazioni.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{TIPI.find(t => t.value === e.tipo)?.label || e.tipo}</TableCell>
                  <TableCell className="font-mono">{e.anno}</TableCell>
                  <TableCell>
                    <Badge variant={e.stato === "confermata" ? "default" : e.stato === "elaborata" ? "secondary" : "outline"}>{e.stato}</Badge>
                  </TableCell>
                  <TableCell>{format(new Date(e.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuova Elaborazione Annuale</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPI.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Anno</Label>
              <Input type="number" value={form.anno} onChange={e => setForm(f => ({ ...f, anno: parseInt(e.target.value) || 2026 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Esegui</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ElabAnnualiPage;
