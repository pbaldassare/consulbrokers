import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Download, Lock, Unlock, Plus, FileText, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

const DistintaGiornaliera = () => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const uffId = profile?.ufficio_id;
  const [dataSelezionata, setDataSelezionata] = useState(new Date().toISOString().split("T")[0]);

  // Fetch distinta for selected date
  const { data: distinta, isLoading } = useQuery({
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
        })
        .select()
        .single();
      if (error) throw error;

      // Insert righe
      const righe = movGiorno.map((m) => ({
        distinta_id: dist.id,
        movimento_id: m.id,
        tipo_pagamento: m.categoria || m.tipo,
        importo: m.importo,
        descrizione: m.descrizione,
        riferimento: m.riferimento_id,
      }));
      if (righe.length > 0) {
        const { error: errR } = await supabase.from("distinte_giornaliere_righe").insert(righe);
        if (errR) throw errR;
      }
      return dist;
    },
    onSuccess: () => {
      toast({ title: "Distinta generata" });
      qc.invalidateQueries({ queryKey: ["distinta_giornaliera"] });
    },
    onError: (e: any) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  // Chiudi distinta
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
      toast({ title: "Distinta chiusa" });
      qc.invalidateQueries({ queryKey: ["distinta_giornaliera"] });
    },
  });

  // Riapri
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
      toast({ title: "Distinta riaperta" });
      qc.invalidateQueries({ queryKey: ["distinta_giornaliera"] });
    },
  });

  const exportCSV = () => {
    if (!distinta) return;
    const righe = (distinta as any).distinte_giornaliere_righe || [];
    const header = "Tipo Pagamento;Importo;Descrizione;Riferimento\n";
    const rows = righe.map((r: any) => `${r.tipo_pagamento};${r.importo};${r.descrizione || ""};${r.riferimento || ""}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `distinta_${dataSelezionata}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const righe = (distinta as any)?.distinte_giornaliere_righe || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Distinta Giornaliera</h1>
          <p className="text-sm text-muted-foreground">Riepilogo incassi e pagamenti per giornata</p>
        </div>
        <Input
          type="date"
          value={dataSelezionata}
          onChange={(e) => setDataSelezionata(e.target.value)}
          className="w-44"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Caricamento...</p>
      ) : !distinta ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nessuna distinta per il {dataSelezionata}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {movGiorno.length} movimenti trovati per questa data.
            </p>
            <Button onClick={() => generaMut.mutate()} disabled={movGiorno.length === 0 || generaMut.isPending}>
              <Plus className="w-4 h-4 mr-2" />
              Genera Distinta ({movGiorno.length} movimenti)
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Totali */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Contanti", value: distinta.totale_contanti },
              { label: "Assegni", value: distinta.totale_assegni },
              { label: "Bonifici", value: distinta.totale_bonifici },
              { label: "POS", value: distinta.totale_pos },
              { label: "Totale", value: distinta.totale_generale },
            ].map((t) => (
              <Card key={t.label}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardDescription className="text-xs">{t.label}</CardDescription>
                  <CardTitle className="text-lg">{fmt(t.value || 0)}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Stato e azioni */}
          <div className="flex items-center gap-3">
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
            <Button size="sm" variant="outline" onClick={exportCSV}>
              <Download className="w-3.5 h-3.5 mr-1" /> CSV
            </Button>
          </div>

          {/* Righe */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dettaglio Movimenti ({righe.length})</CardTitle>
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
                        <Badge variant="outline" className="text-[10px]">{r.tipo_pagamento}</Badge>
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[300px]">{r.descrizione || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(r.importo)}</TableCell>
                    </TableRow>
                  ))}
                  {righe.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Nessuna riga
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default DistintaGiornaliera;
