import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarCheck, Plus, Play } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { format } from "date-fns";

const TIPI_ELAB = [
  { value: "liquidazione_iva", label: "Liquidazione IVA" },
  { value: "ritenute", label: "Ritenute d'acconto" },
  { value: "chiusura_periodo", label: "Chiusura Periodo" },
];

const ElabPeriodichePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "liquidazione_iva", periodo_da: "", periodo_a: "" });

  const { data: elaborazioni = [], isLoading } = useQuery({
    queryKey: ["elaborazioni_periodiche"],
    queryFn: async () => {
      const { data, error } = await supabase.from("elaborazioni_periodiche").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("elaborazioni_periodiche").insert({
        tipo: form.tipo,
        periodo_da: form.periodo_da || null,
        periodo_a: form.periodo_a || null,
        eseguita_da: user?.id,
        stato: "elaborata",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elaborazioni_periodiche"] });
      setDialogOpen(false);
      toast.success("Elaborazione eseguita");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageBreadcrumb />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Elaborazioni Periodiche</h1>
            <p className="text-sm text-muted-foreground">Liquidazioni IVA, ritenute e chiusure di periodo</p>
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
                <TableHead>Periodo Da</TableHead>
                <TableHead>Periodo A</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data Esecuzione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
              ) : elaborazioni.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nessuna elaborazione eseguita</TableCell></TableRow>
              ) : elaborazioni.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{TIPI_ELAB.find(t => t.value === e.tipo)?.label || e.tipo}</TableCell>
                  <TableCell>{e.periodo_da ? format(new Date(e.periodo_da), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>{e.periodo_a ? format(new Date(e.periodo_a), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={e.stato === "confermata" ? "default" : e.stato === "elaborata" ? "secondary" : "outline"}>
                      {e.stato}
                    </Badge>
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
          <DialogHeader><DialogTitle>Nuova Elaborazione Periodica</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo Elaborazione</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPI_ELAB.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Periodo Da</Label><Input type="date" value={form.periodo_da} onChange={e => setForm(f => ({ ...f, periodo_da: e.target.value }))} /></div>
              <div><Label>Periodo A</Label><Input type="date" value={form.periodo_a} onChange={e => setForm(f => ({ ...f, periodo_a: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Play className="w-4 h-4 mr-2" />Esegui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ElabPeriodichePage;
