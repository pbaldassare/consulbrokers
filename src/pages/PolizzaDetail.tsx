import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, Loader2, Pencil } from "lucide-react";
import { fmtEuro } from "@/lib/formatCurrency";
import { format } from "date-fns";
import { useTabParam } from "@/hooks/useTabParam";
import { AzioniPolizzaToolbar, type ToolbarQuietanza } from "@/components/titolo/AzioniPolizzaToolbar";
import { useTitoloCommerciale } from "@/hooks/useTitoloCommerciale";
import { SchedaCommercialeCard } from "@/components/titolo/SchedaCommercialeCard";
import { CompactCard, Field } from "@/components/titolo/SchedaCompact";
import { extraFirmaQuietanza } from "@/lib/schedaCommerciale";

const POLIZZA_TABS = ["contratto", "quietanze"] as const;
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");

const STATO_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  attiva: "default", sospesa: "outline", annullata: "destructive", estinta: "destructive", scaduta: "secondary", sostituita: "secondary",
};

const STATO_QUIETANZA: Record<string, { label: string; cls: string }> = {
  da_incassare: { label: "Da incassare", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  incassato: { label: "Incassata", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  sospesa: { label: "Sospesa", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  annullata: { label: "Annullata", cls: "bg-red-100 text-red-800 border-red-300" },
  stornata: { label: "Stornata", cls: "bg-orange-100 text-orange-800 border-orange-300" },
};

export default function PolizzaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useTabParam(POLIZZA_TABS, "contratto");

  const { data: polizza, isLoading: loadingP } = useQuery({
    queryKey: ["polizza", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("polizze")
        .select(`*,
          clienti:cliente_anagrafica_id (id, nome, cognome, ragione_sociale, codice_fiscale, partita_iva, codice_cliente),
          compagnie:compagnia_id (id, nome, codice),
          rami:ramo_id (id, codice, descrizione)
        `)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: quietanze = [], isLoading: loadingQ } = useQuery({
    queryKey: ["polizza-quietanze", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quietanze")
        .select("id, numero_rata, numero_rate_totali, garanzia_da, garanzia_a, data_scadenza, premio_lordo, stato, data_messa_cassa, data_incasso, importo_incassato, titolo_id, provvigioni_firma, provvigioni_quietanza")
        .eq("polizza_id", id!)
        .order("numero_rata", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const titoloMadreId: string | null = (polizza as any)?.titolo_madre_id ?? null;
  const { data: commerciale, isLoading: loadingComm } = useTitoloCommerciale(titoloMadreId);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["polizza", id] });
    qc.invalidateQueries({ queryKey: ["polizza-quietanze", id] });
    if (titoloMadreId) qc.invalidateQueries({ queryKey: ["titolo-commerciale", titoloMadreId] });
  };

  if (loadingP) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Caricamento polizza…
      </div>
    );
  }
  if (!polizza) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Polizza non trovata.</p>
        <Button onClick={() => navigate("/portafoglio/attive")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Torna al portafoglio
        </Button>
      </div>
    );
  }

  const cliente: any = (polizza as any).clienti;
  const compagnia: any = (polizza as any).compagnie;
  const ramo: any = (polizza as any).rami;
  const clienteNome = cliente?.ragione_sociale || [cliente?.cognome, cliente?.nome].filter(Boolean).join(" ") || "—";
  const stato = polizza.stato as string;
  const numPol = polizza.numero_polizza || "";
  const produttoreLabel = commerciale?.hasProduttore
    ? commerciale.righe.filter((r) => r.ruolo === "produttore").map((r) => r.nome).join(", ")
    : "Nessun produttore";

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button onClick={() => navigate(-1)} className="hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Indietro
            </button>
            <span>·</span>
            <span>Polizza contratto</span>
          </div>
          <h1 className="text-2xl font-bold">
            {numPol || "—"}{" "}
            <Badge variant={STATO_VARIANT[stato] || "secondary"} className="ml-2 align-middle">{stato}</Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            {clienteNome} · {compagnia?.nome || "—"} · {ramo?.descrizione || ramo?.codice || "—"}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Produttore:</span>{" "}
            <span className="font-semibold">{produttoreLabel}</span>
            {commerciale && (
              <>
                {" · "}
                <span className="text-muted-foreground">Provv. annue</span>{" "}
                <span className="font-mono font-semibold">{fmtEuro(commerciale.totProvv)}</span>
              </>
            )}
          </p>
        </div>
        {titoloMadreId && (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/titoli/${titoloMadreId}`}>
              <Pencil className="h-4 w-4 mr-2" /> Apri editing completo
            </Link>
          </Button>
        )}
      </div>

      <AzioniPolizzaToolbar
        polizzaId={polizza.id}
        numeroPolizza={numPol}
        statoPolizza={stato}
        titoloMadreId={titoloMadreId}
        clienteId={cliente?.id || null}
        uffizioId={(polizza as any).ufficio_id ?? null}
        regolazione={!!polizza.regolazione}
        quietanze={quietanze as ToolbarQuietanza[]}
        onRefresh={refreshAll}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="contratto">Contratto</TabsTrigger>
          <TabsTrigger value="quietanze">Quietanze ({quietanze.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="contratto" className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <CompactCard title="Contratto">
              <Field label="Decorrenza" value={fmtDate(polizza.durata_da)} />
              <Field label="Scadenza" value={fmtDate(polizza.durata_a)} />
              <Field label="Frazionamento" value={polizza.frazionamento} />
              <Field label="Anni durata" value={polizza.anni_durata?.toString()} hideEmpty />
              <Field label="Tacito rinnovo" value={polizza.tacito_rinnovo ? "Sì" : "No"} />
              <Field label="Prodotto" value={polizza.prodotto_nome} hideEmpty />
              <Field label="Targa / Telaio" value={polizza.targa_telaio} hideEmpty />
              <Field label="CIG" value={polizza.cig_rif} hideEmpty />
              <Field label="C.F. / P.IVA" value={cliente?.codice_fiscale || cliente?.partita_iva} hideEmpty />
            </CompactCard>

            <CompactCard title="Premio annuo">
              <Field label="Premio lordo" value={fmtEuro(polizza.premio_annuo_lordo)} highlight />
              <Field label="Premio netto" value={fmtEuro(polizza.premio_annuo_netto)} />
              <Field label="Tasse" value={fmtEuro(polizza.tasse_annue)} hideZero />
              <Field label="Addizionali" value={fmtEuro(polizza.addizionali_annue)} hideZero />
              <Field label="SSN" value={fmtEuro(polizza.ssn_annuo)} hideZero />
            </CompactCard>

            <SchedaCommercialeCard
              totProvv={commerciale?.totProvv ?? (Number(polizza.provvigioni_annue_quietanza || polizza.provvigioni_annue_firma) || 0)}
              righe={commerciale?.righe ?? []}
              hasProduttore={!!commerciale?.hasProduttore}
              loading={loadingComm}
              totaleLabel="Provvigioni annue"
              extraFields={extraFirmaQuietanza(
                polizza.provvigioni_annue_firma ?? commerciale?.provvigioniFirma,
                polizza.provvigioni_annue_quietanza ?? commerciale?.provvigioniQuietanza,
                fmtEuro,
              )}
            />
          </div>

          {(stato !== "attiva" || polizza.data_sospensione || polizza.data_annullamento || polizza.note) && (
            <CompactCard title="Stato contratto">
              <Field label="Stato" value={stato} />
              <Field label="Data sospensione" value={fmtDate(polizza.data_sospensione)} hideEmpty />
              <Field label="Data riattivazione" value={fmtDate(polizza.data_riattivazione)} hideEmpty />
              <Field label="Data annullamento" value={fmtDate(polizza.data_annullamento)} hideEmpty />
              <Field label="Motivo" value={polizza.motivo_annullamento} hideEmpty />
              {polizza.note && (
                <div className="pt-2 mt-1 border-t border-border/40 text-sm whitespace-pre-wrap">{polizza.note}</div>
              )}
            </CompactCard>
          )}
        </TabsContent>

        <TabsContent value="quietanze" className="space-y-3">
          <Card>
            <CardContent className="p-0">
              {loadingQ ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Caricamento quietanze…</div>
              ) : quietanze.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Nessuna quietanza generata</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="h-9">
                      <TableHead className="h-9 py-1">Rata</TableHead>
                      <TableHead className="h-9 py-1">Decorrenza</TableHead>
                      <TableHead className="h-9 py-1">Scadenza</TableHead>
                      <TableHead className="h-9 py-1 text-right">Premio lordo</TableHead>
                      <TableHead className="h-9 py-1 text-right">Provv.</TableHead>
                      <TableHead className="h-9 py-1">Stato</TableHead>
                      <TableHead className="h-9 py-1">Messa a cassa</TableHead>
                      <TableHead className="h-9 py-1 w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quietanze.map((q: any) => {
                      const st = STATO_QUIETANZA[q.stato] || { label: q.stato, cls: "" };
                      const provv = Number(q.provvigioni_quietanza) || Number(q.provvigioni_firma) || 0;
                      return (
                        <TableRow key={q.id} className="cursor-pointer hover:bg-muted/40 h-10" onClick={() => navigate(`/quietanze/${q.id}`)}>
                          <TableCell className="py-1.5 font-medium font-mono">
                            {q.numero_rata}{q.numero_rate_totali ? `/${q.numero_rate_totali}` : ""}
                          </TableCell>
                          <TableCell className="py-1.5">{fmtDate(q.garanzia_da)}</TableCell>
                          <TableCell className="py-1.5">{fmtDate(q.garanzia_a || q.data_scadenza)}</TableCell>
                          <TableCell className="py-1.5 text-right tabular-nums">{fmtEuro(q.premio_lordo)}</TableCell>
                          <TableCell className="py-1.5 text-right tabular-nums">{fmtEuro(provv)}</TableCell>
                          <TableCell className="py-1.5">
                            <Badge variant="outline" className={st.cls + " text-xs px-1.5 py-0"}>{st.label}</Badge>
                          </TableCell>
                          <TableCell className="py-1.5 text-muted-foreground">{fmtDate(q.data_messa_cassa)}</TableCell>
                          <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                            {q.titolo_id && (
                              <Button size="sm" variant="ghost" asChild className="h-7 w-7 p-0">
                                <Link to={`/titoli/${q.titolo_id}`}>
                                  <FileText className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
