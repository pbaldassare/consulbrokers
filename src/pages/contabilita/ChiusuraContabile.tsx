import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CheckCircle, Circle, AlertTriangle, Play, RotateCcw, FileText,
  GitCompare, Calculator, CalendarCheck, BarChart3, Lock
} from "lucide-react";

const steps = [
  { key: "step_movimenti", label: "Verifica Movimenti", desc: "Tutti i movimenti del periodo sono registrati", icon: FileText, link: "/contabilita" },
  { key: "step_riconciliazione", label: "Riconciliazione Bancaria", desc: "Tutti gli estratti conto matchati", icon: GitCompare, link: "/banca-import" },
  { key: "step_quadratura_iva", label: "Quadratura IVA", desc: "Registro acquisti vs registro vendite bilanciati", icon: Calculator, link: "/report-iva" },
  { key: "step_scadenziario", label: "Verifica Scadenziario", desc: "Nessuna scadenza dimenticata nel periodo", icon: CalendarCheck, link: "/cont-generale/scadenziario" },
  { key: "step_report", label: "Generazione Report", desc: "Report di periodo generato e verificato", icon: BarChart3, link: "/report" },
] as const;

const ChiusuraContabile = () => {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const uffId = profile?.ufficio_id;

  const [tipo, setTipo] = useState("mensile");
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Fetch chiusura
  const { data: chiusura, isLoading } = useQuery({
    queryKey: ["chiusura_contabile", periodo, tipo, uffId],
    queryFn: async () => {
      const q = supabase
        .from("chiusure_contabili")
        .select("*")
        .eq("periodo", periodo)
        .eq("tipo", tipo);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Avvia chiusura
  const avviaMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("chiusure_contabili").insert({
        periodo,
        tipo,
        ufficio_id: uffId,
        avviato_da: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chiusura avviata");
      qc.invalidateQueries({ queryKey: ["chiusura_contabile"] });
    },
    onError: (e: any) => toast.error("Errore"),
  });

  // Toggle step
  const toggleStep = useMutation({
    mutationFn: async (stepKey: string) => {
      if (!chiusura) return;
      const current = (chiusura as any)[stepKey];
      const { error } = await supabase
        .from("chiusure_contabili")
        .update({ [stepKey]: !current, updated_at: new Date().toISOString() })
        .eq("id", chiusura.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chiusura_contabile"] }),
  });

  // Completa chiusura
  const completaMut = useMutation({
    mutationFn: async () => {
      if (!chiusura) return;
      const { error } = await supabase
        .from("chiusure_contabili")
        .update({
          stato: "completata",
          completato_da: user?.id,
          completato_il: new Date().toISOString(),
        })
        .eq("id", chiusura.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chiusura completata!");
      qc.invalidateQueries({ queryKey: ["chiusura_contabile"] });
    },
  });

  const allStepsDone = chiusura && steps.every((s) => (chiusura as any)[s.key] === true);
  const completedSteps = chiusura ? steps.filter((s) => (chiusura as any)[s.key]).length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Chiusura Contabile</h1>
        <p className="text-sm text-muted-foreground">Workflow guidato per la chiusura di periodo</p>
      </div>

      {/* Selettori */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Periodo</label>
          <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-44" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mensile">Mensile</SelectItem>
              <SelectItem value="trimestrale">Trimestrale</SelectItem>
              <SelectItem value="annuale">Annuale</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Caricamento...</p>
      ) : !chiusura ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Play className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nessuna chiusura avviata per {periodo}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Avvia il processo di chiusura {tipo} per verificare tutti gli step.
            </p>
            <Button onClick={() => avviaMut.mutate()} disabled={avviaMut.isPending}>
              <Play className="w-4 h-4 mr-2" /> Avvia Chiusura
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Progress */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Progresso: {completedSteps}/{steps.length} step completati
                  </CardTitle>
                  <CardDescription>
                    Stato: <Badge variant={chiusura.stato === "completata" ? "default" : "secondary"} className="ml-1">
                      {chiusura.stato === "completata" ? (
                        <><Lock className="w-3 h-3 mr-1" /> Completata</>
                      ) : "In corso"}
                    </Badge>
                  </CardDescription>
                </div>
                {allStepsDone && chiusura.stato !== "completata" && (
                  <Button onClick={() => completaMut.mutate()} disabled={completaMut.isPending}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Completa Chiusura
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={(completedSteps / steps.length) * 100} className="h-2.5" />
            </CardContent>
          </Card>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, i) => {
              const done = (chiusura as any)[step.key];
              const isCompleted = chiusura.stato === "completata";
              return (
                <Card key={step.key} className={`transition-all ${done ? "border-green-500/30 bg-green-50/30 dark:bg-green-950/10" : ""}`}>
                  <CardContent className="py-4 flex items-center gap-4">
                    <button
                      onClick={() => !isCompleted && toggleStep.mutate(step.key)}
                      disabled={isCompleted || toggleStep.isPending}
                      className="shrink-0"
                    >
                      {done ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <Circle className="w-6 h-6 text-muted-foreground" />
                      )}
                    </button>
                    <step.icon className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className={`font-medium text-sm ${done ? "line-through text-muted-foreground" : ""}`}>
                        Step {i + 1}: {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.desc}</p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={step.link}>Vai →</a>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ChiusuraContabile;
