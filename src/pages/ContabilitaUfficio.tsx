import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ExternalLink, FileText, Coins, Receipt, Hash, Search, Eye, Printer, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { buildIncassiCoperturePdf, type IncassiCoperturaGruppo } from "@/lib/incassi-coperture-pdf";
import PdfPreview from "@/components/PdfPreview";

type TitoloCassa = {
  id: string;
  numero_titolo: string | null;
  premio_lordo: number | null;
  provvigioni_firma: number | null;
  provvigioni_quietanza: number | null;
  compagnia_id: string | null;
  conferimento_gestito: boolean | null;
  fondi_ricevuti: boolean | null;
  tipo_pagamento: string | null;
  compagnie: { nome: string } | null;
  clienti: { cognome: string | null; nome: string | null; ragione_sociale: string | null } | null;
};

type GruppoCompagnia = {
  nome: string;
  count: number;
  premio_lordo: number;
  provvigioni: number;
  da_rimettere: number;
  compagnia_id: string;
  titoli: TitoloCassa[];
};

const ContabilitaUfficio = () => {
  const navigate = useNavigate();

  const [meseCorrente, setMeseCorrente] = useState(new Date());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");

  const meseDa = format(startOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseA = format(endOfMonth(meseCorrente), "yyyy-MM-dd");
  const meseLabel = format(meseCorrente, "MMMM yyyy", { locale: it });

  const { data: titoliCassa = [] } = useQuery({
    queryKey: ["titoli-cassa-mese", meseDa, meseA],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, provvigioni_firma, provvigioni_quietanza, compagnia_id, conferimento_gestito, fondi_ricevuti, tipo_pagamento, compagnie:compagnie!titoli_compagnia_id_fkey(nome), clienti:clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale)")
        .eq("stato", "incassato")
        .gte("data_messa_cassa", meseDa)
        .lte("data_messa_cassa", meseA);
      if (error) throw error;

      const map: Record<string, GruppoCompagnia> = {};
      for (const t of (data || []) as any[]) {
        const cId = t.compagnia_id || "sconosciuta";
        const cNome = t.compagnie?.nome || "Senza agenzia";
        if (!map[cId]) map[cId] = { nome: cNome, count: 0, premio_lordo: 0, provvigioni: 0, da_rimettere: 0, compagnia_id: cId, titoli: [] };
        const lordo = t.premio_lordo || 0;
        const provv = (t.provvigioni_firma || 0) + (t.provvigioni_quietanza || 0);
        map[cId].count++;
        map[cId].premio_lordo += lordo;
        map[cId].provvigioni += provv;
        map[cId].da_rimettere += lordo - provv;
        map[cId].titoli.push(t);
      }
      return Object.values(map).sort((a, b) => b.da_rimettere - a.da_rimettere);
    },
  });

  const filtered = searchTerm
    ? titoliCassa.filter((g) => g.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    : titoliCassa;

  const totaliCassa = filtered.reduce(
    (acc, g) => ({
      count: acc.count + g.count,
      premio_lordo: acc.premio_lordo + g.premio_lordo,
      provvigioni: acc.provvigioni + g.provvigioni,
      da_rimettere: acc.da_rimettere + g.da_rimettere,
    }),
    { count: 0, premio_lordo: 0, provvigioni: 0, da_rimettere: 0 }
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const clienteDisplay = (t: TitoloCassa) => {
    const c = t.clienti;
    if (!c) return "—";
    return c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim() || "—";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Incassi e Coperture</h1>
        <p className="text-muted-foreground">Riepilogo consultivo delle polizze messe a cassa</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Hash className="w-3.5 h-3.5" /> Titoli a Cassa
            </CardDescription>
            <CardTitle className="text-xl">{totaliCassa.count}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <FileText className="w-3.5 h-3.5" /> Premio Lordo
            </CardDescription>
            <CardTitle className="text-xl text-blue-600">{fmt(totaliCassa.premio_lordo)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Coins className="w-3.5 h-3.5" /> Provvigioni
            </CardDescription>
            <CardTitle className="text-xl text-green-600">{fmt(totaliCassa.provvigioni)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Receipt className="w-3.5 h-3.5" /> Da Rimettere
            </CardDescription>
            <CardTitle className="text-xl text-orange-600">{fmt(totaliCassa.da_rimettere)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Riepilogo Messa a Cassa */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMeseCorrente((prev) => subMonths(prev, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold capitalize min-w-[140px] text-center">{meseLabel}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMeseCorrente((prev) => addMonths(prev, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca agenzia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Package className="w-5 h-5" />Riepilogo Messa a Cassa — {meseLabel}</CardTitle></CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun titolo messo a cassa nel mese selezionato</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Agenzia</TableHead>
                    <TableHead className="text-right">Titoli</TableHead>
                    <TableHead className="text-right">Premio Lordo</TableHead>
                    <TableHead className="text-right">Provvigioni</TableHead>
                    <TableHead className="text-right">Da Rimettere</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g) => (
                    <>
                      <TableRow key={g.compagnia_id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(g.compagnia_id)}>
                        <TableCell className="px-2">
                          {expanded[g.compagnia_id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </TableCell>
                        <TableCell className="font-medium">{g.nome}</TableCell>
                        <TableCell className="text-right">{g.count}</TableCell>
                        <TableCell className="text-right font-mono">€ {g.premio_lordo.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">€ {g.provvigioni.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">€ {g.da_rimettere.toFixed(2)}</TableCell>
                      </TableRow>
                      {expanded[g.compagnia_id] && (
                        <TableRow key={`${g.compagnia_id}-detail`}>
                          <TableCell colSpan={7} className="bg-muted/30 p-0">
                            <div className="p-3">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>N° Titolo</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead className="text-right">Premio Lordo</TableHead>
                                    <TableHead className="text-right">Provvigioni</TableHead>
                                     <TableHead className="text-right">Netto</TableHead>
                                     <TableHead>Tipo Pagamento</TableHead>
                                     <TableHead>Tipo Incasso</TableHead>
                                    <TableHead className="w-8"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {g.titoli.map((t) => {
                                    const lordo = t.premio_lordo || 0;
                                    const provv = (t.provvigioni_firma || 0) + (t.provvigioni_quietanza || 0);
                                    return (
                                      <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/titoli/${t.id}`)}>
                                        <TableCell className="font-mono text-sm">{t.numero_titolo || "—"}</TableCell>
                                        <TableCell className="text-sm">{clienteDisplay(t)}</TableCell>
                                        <TableCell className="text-right font-mono text-sm">€ {lordo.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono text-sm">€ {provv.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono text-sm font-semibold">€ {(lordo - provv).toFixed(2)}</TableCell>
                                        <TableCell>
                                          {(() => {
                                            const tp = t.tipo_pagamento;
                                            const label = tp === "contanti" ? "Contanti" : tp === "pos" ? "POS" : tp === "bonifico" ? "Bonifico" : tp === "carta_credito" ? "POS" : "—";
                                            const variant = tp === "contanti" ? "secondary" : tp === "pos" || tp === "carta_credito" ? "default" : tp === "bonifico" ? "outline" : "secondary";
                                            return <Badge variant={variant as any} className="text-xs">{label}</Badge>;
                                          })()}
                                        </TableCell>
                                        <TableCell>
                                          {t.conferimento_gestito ? (
                                            <Badge variant={t.fondi_ricevuti ? "default" : "secondary"} className="text-xs">
                                              {t.fondi_ricevuti ? "Cop. Garantita ✓" : "In Attesa Fondi"}
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs">Incasso diretto</Badge>
                                          )}
                                        </TableCell>
                                        <TableCell><ExternalLink className="w-3 h-3 text-muted-foreground" /></TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell />
                    <TableCell className="font-bold">Totale</TableCell>
                    <TableCell className="text-right font-bold">{totaliCassa.count}</TableCell>
                    <TableCell className="text-right font-mono font-bold">€ {totaliCassa.premio_lordo.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">€ {totaliCassa.provvigioni.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">€ {totaliCassa.da_rimettere.toFixed(2)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContabilitaUfficio;
