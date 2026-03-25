import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, FileText, Percent, Clock, ExternalLink, ChevronDown, Calendar, Shield, DollarSign, RefreshCw, LayoutGrid } from "lucide-react";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useState } from "react";

const statiTitolo = ["creato", "incassato", "stornato", "annullato"];

const fmt = (v: any) => v ?? "—";
const fmtDate = (v: string | null) => v ? format(new Date(v), "dd/MM/yyyy", { locale: it }) : "—";
const fmtEuro = (v: number | null) => v != null ? `€ ${v.toFixed(2)}` : "—";
const fmtBool = (v: boolean | null) => v ? "Sì" : "No";

const FieldRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between py-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-mono text-right">{value}</span>
  </div>
);

const SectionCollapsible = ({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 px-4 py-2.5 bg-primary/5 border border-border rounded-t-lg hover:bg-primary/10 transition-colors">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold uppercase text-primary">{title}</span>
          <ChevronDown className={`w-4 h-4 ml-auto text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-t-0 border-border rounded-b-lg p-4">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const TitoloDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: titolo, isLoading } = useQuery({
    queryKey: ["titolo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("*, prodotti(nome_prodotto, compagnie(nome)), uffici(nome_ufficio), produttore:profiles!titoli_produttore_id_fkey(nome, cognome, ruolo), cliente:profiles!titoli_cliente_id_fkey(nome, cognome), cliente_anagrafica:clienti!titoli_cliente_anagrafica_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale), compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome, codice), ramo:rami!titoli_ramo_id_fkey(id, codice, descrizione)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: provvigioni = [] } = useQuery({
    queryKey: ["provvigioni", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provvigioni_generate")
        .select("*, profiles(nome, cognome)")
        .eq("titolo_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: riparto = [] } = useQuery({
    queryKey: ["riparto", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dettaglio_riparto")
        .select("*, compagnie(nome, codice)")
        .eq("titolo_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const changeStatoMutation = useMutation({
    mutationFn: async (nuovoStato: string) => {
      const vecchioStato = titolo?.stato;
      const { error } = await supabase.from("titoli").update({ stato: nuovoStato, updated_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;
      if (user) {
        await logAttivita({ azione: "cambio_stato_titolo", entita_tipo: "titolo", entita_id: id!, dettagli_json: { stato_precedente: vecchioStato, nuovo_stato: nuovoStato } });
      }
      if (nuovoStato === "incassato") {
        await supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: id } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titolo", id] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni", id] });
      toast({ title: "Stato aggiornato" });
    },
    onError: (err: any) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground p-8">Caricamento...</p>;
  if (!titolo) return <p className="text-destructive p-8">Titolo non trovato</p>;

  const t = titolo as any;

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/titoli")}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Polizza {t.numero_titolo || t.id.slice(0, 8)}</h1>
          <p className="text-muted-foreground text-sm">{t.prodotti?.nome_prodotto} — {(t.compagnia_diretta as any)?.nome || t.prodotti?.compagnie?.nome || "N/D"}</p>
        </div>
        <Badge variant={t.stato === "incassato" ? "default" : t.stato === "stornato" ? "destructive" : "secondary"} className="ml-auto text-sm">
          {t.stato}
        </Badge>
      </div>

      {/* Cambio stato */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Cambia Stato</CardTitle></CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          {statiTitolo.filter((s) => s !== t.stato).map((s) => (
            <Button key={s} variant="outline" size="sm" onClick={() => changeStatoMutation.mutate(s)} disabled={changeStatoMutation.isPending}>{s}</Button>
          ))}
        </CardContent>
      </Card>

      {/* CONTRATTO */}
      <SectionCollapsible title="Contratto" icon={FileText}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
          <FieldRow label="Compagnia" value={
            <span>{(t.compagnia_diretta as any)?.codice || ""} - {(t.compagnia_diretta as any)?.nome || t.prodotti?.compagnie?.nome || "—"}</span>
          } />
          <FieldRow label="Ramo" value={`${(t.ramo as any)?.codice || ""} ${(t.ramo as any)?.descrizione || "—"}`} />
          <FieldRow label="Prodotto" value={fmt(t.prodotti?.nome_prodotto)} />
          <FieldRow label="Specialist" value={fmt(t.specialist)} />
          <FieldRow label="Tipo Portafoglio" value={fmt(t.tipo_portafoglio)} />
          <FieldRow label="Numero Polizza" value={fmt(t.numero_titolo)} />
          <FieldRow label="Riga" value={fmt(t.riga)} />
          <FieldRow label="Appendice" value={fmt(t.appendice)} />
          {t.cliente_anagrafica && (
            <div className="col-span-2 flex justify-between py-1">
              <span className="text-xs text-muted-foreground">Cliente</span>
              <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate(`/archivi/clienti/${(t.cliente_anagrafica as any).id}`)}>
                {(t.cliente_anagrafica as any).tipo_cliente === "privato"
                  ? `${(t.cliente_anagrafica as any).cognome || ""} ${(t.cliente_anagrafica as any).nome || ""}`.trim()
                  : (t.cliente_anagrafica as any).ragione_sociale || "—"}
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
          <FieldRow label="Produttore" value={t.produttore ? `${(t.produttore as any).nome} ${(t.produttore as any).cognome}` : "—"} />
          <FieldRow label="Ufficio" value={fmt(t.uffici?.nome_ufficio)} />
          <FieldRow label="CIG/Rif." value={fmt(t.cig_rif)} />
          <FieldRow label="Vincolo" value={fmt(t.vincolo)} />
          <FieldRow label="Targa/Telaio" value={fmt(t.targa_telaio)} />
          {t.descrizione_polizza && <div className="col-span-full"><FieldRow label="Descrizione" value={t.descrizione_polizza} /></div>}
        </div>
      </SectionCollapsible>

      {/* PERIODO */}
      <SectionCollapsible title="Periodo" icon={Calendar}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
          <FieldRow label="Durata Da" value={fmtDate(t.durata_da)} />
          <FieldRow label="Durata A" value={fmtDate(t.durata_a)} />
          <FieldRow label="Anni Durata" value={fmt(t.anni_durata)} />
          <FieldRow label="Rate" value={fmt(t.rate)} />
          <FieldRow label="Garanzia Da" value={fmtDate(t.garanzia_da)} />
          <FieldRow label="Garanzia A" value={fmtDate(t.garanzia_a)} />
          <FieldRow label="Data Competenza" value={fmtDate(t.data_competenza)} />
          <FieldRow label="Data Scadenza" value={fmtDate(t.data_scadenza)} />
          <FieldRow label="Limite Mora" value={fmtDate(t.limite_mora)} />
          <FieldRow label="GG Mora" value={fmt(t.mora_giorni)} />
          <FieldRow label="Tipo Rinnovo" value={fmt(t.tipo_rinnovo)} />
          <FieldRow label="Disdetta (mesi)" value={fmt(t.disdetta_mesi)} />
        </div>
      </SectionCollapsible>

      {/* REGOLAZIONE */}
      <SectionCollapsible title="Regolazione" icon={Shield} defaultOpen={false}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
          <FieldRow label="Regolazione" value={fmtBool(t.regolazione)} />
          <FieldRow label="Periodicità" value={fmt(t.periodicita)} />
          <FieldRow label="Tipo Scadenza" value={fmt(t.tipo_scadenza)} />
          <FieldRow label="GG Presentazione" value={fmt(t.giorni_presentazione)} />
          <FieldRow label="Tipo Lettera" value={fmt(t.tipo_lettera_regolazione)} />
          <FieldRow label="Libro Matricola" value={fmt(t.libro_matricola)} />
        </div>
      </SectionCollapsible>

      {/* IMPORTI */}
      <SectionCollapsible title="Importi" icon={DollarSign}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Firma</h4>
            <div className="space-y-0">
              <FieldRow label="Premio Netto" value={fmtEuro(t.premio_netto)} />
              <FieldRow label="Addizionali" value={fmtEuro(t.addizionali)} />
              <FieldRow label="Tasse" value={fmtEuro(t.tasse)} />
              <FieldRow label="Premio Lordo" value={fmtEuro(t.premio_lordo)} />
              <FieldRow label="Provvigioni" value={fmtEuro(t.provvigioni_firma)} />
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Quietanza</h4>
            <div className="space-y-0">
              <FieldRow label="Premio Netto" value={fmtEuro(t.premio_netto_quietanza)} />
              <FieldRow label="Addizionali" value={fmtEuro(t.addizionali_quietanza)} />
              <FieldRow label="Tasse" value={fmtEuro(t.tasse_quietanza)} />
              <FieldRow label="Totale" value={fmtEuro(t.premio_netto_quietanza != null && t.addizionali_quietanza != null && t.tasse_quietanza != null ? t.premio_netto_quietanza + t.addizionali_quietanza + t.tasse_quietanza : null)} />
              <FieldRow label="Provvigioni" value={fmtEuro(t.provvigioni_quietanza)} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 mt-3 pt-3 border-t">
          <FieldRow label="Valuta" value={fmt(t.valuta)} />
          <FieldRow label="Cambio" value={fmt(t.cambio)} />
          <FieldRow label="Indicizzata" value={fmtBool(t.indicizzata)} />
          <FieldRow label="Rimborso" value={fmtBool(t.rimborso)} />
          <FieldRow label="Pag. Diretto Comp." value={fmtBool(t.pag_diretto_compagnia)} />
          <FieldRow label="Formato Elettronico" value={fmtBool(t.formato_elettronico)} />
          <FieldRow label="Incassato" value={fmtEuro(t.importo_incassato)} />
          <FieldRow label="Data Incasso" value={fmtDate(t.data_incasso)} />
        </div>
      </SectionCollapsible>

      {/* SOSTITUZIONI / STORNI */}
      {(t.sostituisce_polizza || t.storno_polizza) && (
        <SectionCollapsible title="Sostituzioni / Storni" icon={RefreshCw} defaultOpen={false}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
            <FieldRow label="Sostituisce Polizza" value={fmt(t.sostituisce_polizza)} />
            <FieldRow label="Riga" value={fmt(t.sostituisce_riga)} />
            <FieldRow label="Appendice" value={fmt(t.sostituisce_appendice)} />
            <FieldRow label="Storno Polizza" value={fmt(t.storno_polizza)} />
            <FieldRow label="Riga" value={fmt(t.storno_riga)} />
            <FieldRow label="Appendice" value={fmt(t.storno_appendice)} />
          </div>
        </SectionCollapsible>
      )}

      {/* DETTAGLIO RIPARTO */}
      <SectionCollapsible title="Dettaglio Riparto" icon={LayoutGrid} defaultOpen={false}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compagnia</TableHead>
              <TableHead className="text-right">Quota %</TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead className="text-right">Add.</TableHead>
              <TableHead className="text-right">Tasse</TableHead>
              <TableHead className="text-right">Totale</TableHead>
              <TableHead className="text-right">Provv. Netto</TableHead>
              <TableHead>Pag.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(riparto as any[]).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.compagnie?.nome || "—"}</TableCell>
                <TableCell className="text-right font-mono">{r.quota_percentuale}%</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.netto)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.addizionali)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.tasse)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.totale)}</TableCell>
                <TableCell className="text-right font-mono">{fmtEuro(r.provv_netto)}</TableCell>
                <TableCell>{r.tipo_pagamento || "—"}</TableCell>
              </TableRow>
            ))}
            {riparto.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nessun riparto</TableCell></TableRow>}
          </TableBody>
        </Table>
      </SectionCollapsible>

      {t.note && (
        <Card>
          <CardContent className="pt-4">
            <span className="text-xs text-muted-foreground">Note:</span>
            <p className="text-sm mt-1">{t.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="provvigioni">
        <TabsList>
          <TabsTrigger value="provvigioni"><Percent className="w-4 h-4 mr-1" />Provvigioni ({provvigioni.length})</TabsTrigger>
          <TabsTrigger value="documenti"><FileText className="w-4 h-4 mr-1" />Documenti</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="timeline"><Clock className="w-4 h-4 mr-1" />Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="provvigioni">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beneficiario</TableHead>
                    <TableHead>Percentuale</TableHead>
                    <TableHead>Importo €</TableHead>
                    <TableHead>Calcolata il</TableHead>
                    <TableHead>Pagata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {provvigioni.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.profiles ? `${p.profiles.nome} ${p.profiles.cognome}` : "—"}</TableCell>
                      <TableCell className="font-mono">{p.percentuale}%</TableCell>
                      <TableCell className="font-mono">€ {p.importo_provvigione?.toFixed(2)}</TableCell>
                      <TableCell>{p.calcolata_il ? format(new Date(p.calcolata_il), "dd/MM/yyyy HH:mm", { locale: it }) : "—"}</TableCell>
                      <TableCell><Badge variant={p.pagata ? "default" : "secondary"}>{p.pagata ? "Sì" : "No"}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {provvigioni.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nessuna provvigione generata</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="documenti">
          <Card><CardContent className="pt-6"><DocumentiTab entitaTipo="titolo" entitaId={id!} bucketName="documenti_titoli" /></CardContent></Card>
        </TabsContent>
        <TabsContent value="chat">
          <Card><CardContent className="pt-6"><ChatTab entitaTipo="titolo" entitaId={id!} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="timeline">
          <Card><CardContent className="pt-6"><TimelineTab entitaTipo="titolo" entitaId={id!} /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TitoloDetail;
