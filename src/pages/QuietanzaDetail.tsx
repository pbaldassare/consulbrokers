import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
import { fmtEuro } from "@/lib/formatCurrency";
import { format } from "date-fns";
import { AzioniPolizzaToolbar, type ToolbarQuietanza } from "@/components/titolo/AzioniPolizzaToolbar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useTitoloCommerciale } from "@/hooks/useTitoloCommerciale";
import { SchedaCommercialeCard } from "@/components/titolo/SchedaCommercialeCard";
import { CompactCard, Field } from "@/components/titolo/SchedaCompact";
import { totProvvigioniRata } from "@/lib/schedaCommerciale";

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");

const STATO_QUIETANZA: Record<string, { label: string; cls: string }> = {
  da_incassare: { label: "Da incassare", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  incassato: { label: "Incassata", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  sospesa: { label: "Sospesa", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  annullata: { label: "Annullata", cls: "bg-red-100 text-red-800 border-red-300" },
  stornata: { label: "Stornata", cls: "bg-orange-100 text-orange-800 border-orange-300" },
};

export default function QuietanzaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: q, isLoading } = useQuery({
    queryKey: ["quietanza", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quietanze")
        .select(`*,
          polizze:polizza_id (
            id, numero_polizza, stato, cliente_anagrafica_id, compagnia_id, ramo_id, ufficio_id,
            titolo_madre_id, regolazione,
            clienti:cliente_anagrafica_id (id, nome, cognome, ragione_sociale),
            compagnie:compagnia_id (id, nome),
            rami:ramo_id (id, codice, descrizione)
          )
        `)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const polizzaId: string | undefined = (q as any)?.polizze?.id;
  const titoloId: string | null = (q as any)?.titolo_id || (q as any)?.polizze?.titolo_madre_id || null;
  const { data: commerciale, isLoading: loadingComm } = useTitoloCommerciale(titoloId);

  const { data: quietanzeSorelle = [] } = useQuery({
    queryKey: ["polizza-quietanze", polizzaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quietanze")
        .select("id, numero_rata, numero_rate_totali, garanzia_da, garanzia_a, data_scadenza, premio_lordo, stato, data_messa_cassa, titolo_id")
        .eq("polizza_id", polizzaId!)
        .order("numero_rata", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!polizzaId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["quietanza", id] });
    if (polizzaId) qc.invalidateQueries({ queryKey: ["polizza-quietanze", polizzaId] });
    if (titoloId) qc.invalidateQueries({ queryKey: ["titolo-commerciale", titoloId] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Caricamento quietanza…
      </div>
    );
  }
  if (!q) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Quietanza non trovata.</p>
        <Button onClick={() => navigate("/portafoglio/attive")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Torna al portafoglio
        </Button>
      </div>
    );
  }

  const polizza: any = (q as any).polizze;
  const cliente: any = polizza?.clienti;
  const clienteNome = cliente?.ragione_sociale || [cliente?.cognome, cliente?.nome].filter(Boolean).join(" ") || "—";
  const stato = q.stato as string;
  const st = STATO_QUIETANZA[stato] || { label: stato, cls: "" };
  const numPol = polizza?.numero_polizza || (q as any).numero_polizza_snapshot || "";
  const totProvvRata = totProvvigioniRata({
    provvigioni_firma: q.provvigioni_firma,
    provvigioni_quietanza: q.provvigioni_quietanza,
  });
  const produttoreLabel = commerciale?.hasProduttore
    ? commerciale.righe.filter((r) => r.ruolo === "produttore").map((r) => r.nome).join(", ")
    : "Nessun produttore";

  const current: ToolbarQuietanza | null = {
    id: q.id,
    numero_rata: q.numero_rata,
    numero_rate_totali: q.numero_rate_totali,
    garanzia_da: q.garanzia_da,
    garanzia_a: q.garanzia_a,
    data_scadenza: q.data_scadenza,
    premio_lordo: q.premio_lordo,
    stato: q.stato,
    data_messa_cassa: q.data_messa_cassa,
    titolo_id: (q as any).titolo_id,
  };

  const clienteId = polizza?.cliente_anagrafica_id;
  const clienteHref = clienteId ? `/archivi/clienti/${clienteId}?tab=polizze` : null;
  const totLabel = q.numero_rate_totali ? `${q.numero_rata}/${q.numero_rate_totali}` : `${q.numero_rata}`;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/archivi/clienti">Clienti</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {clienteHref && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={clienteHref}>{clienteNome}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          {polizza && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={`/polizze/${polizza.id}`}>Polizza {polizza.numero_polizza}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Rata {totLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 -ml-2"
              onClick={() => (polizza ? navigate(`/polizze/${polizza.id}`) : clienteHref ? navigate(clienteHref) : navigate(-1))}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> {polizza ? "Torna alla polizza" : "Indietro"}
            </Button>
            <span>·</span>
            <span>Quietanza di rata</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Rata {totLabel}
            <Badge variant="outline" className={st.cls}>{st.label}</Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            Polizza{" "}
            {polizza ? (
              <Link to={`/polizze/${polizza.id}`} className="text-primary hover:underline font-medium">
                {numPol}
              </Link>
            ) : "—"}{" "}
            · {clienteNome}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Produttore:</span>{" "}
            <span className="font-semibold">{produttoreLabel}</span>
            {" · "}
            <span className="text-muted-foreground">Provv. rata</span>{" "}
            <span className="font-mono font-semibold">{fmtEuro(totProvvRata)}</span>
          </p>
        </div>
        {(q as any).titolo_id && (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/titoli/${(q as any).titolo_id}`}>
              <Pencil className="h-4 w-4 mr-2" /> Apri editing completo
            </Link>
          </Button>
        )}
      </div>

      {polizza && (
        <AzioniPolizzaToolbar
          polizzaId={polizza.id}
          numeroPolizza={numPol}
          statoPolizza={polizza.stato}
          titoloMadreId={polizza.titolo_madre_id ?? null}
          clienteId={polizza.cliente_anagrafica_id ?? null}
          uffizioId={polizza.ufficio_id ?? null}
          regolazione={!!polizza.regolazione}
          quietanze={quietanzeSorelle as ToolbarQuietanza[]}
          currentQuietanza={current}
          onRefresh={refresh}
        />
      )}

      <div className="grid md:grid-cols-3 gap-3">
        <CompactCard title="Periodo rata">
          <Field label="Decorrenza" value={fmtDate(q.garanzia_da)} />
          <Field label="Scadenza garanzia" value={fmtDate(q.garanzia_a)} />
          <Field label="Competenza" value={fmtDate(q.data_competenza)} hideEmpty />
          <Field label="Scadenza pagamento" value={fmtDate(q.data_scadenza)} hideEmpty />
        </CompactCard>

        <CompactCard title="Importi rata">
          <Field label="Premio lordo" value={fmtEuro(q.premio_lordo)} highlight />
          <Field label="Premio netto" value={fmtEuro(q.premio_netto)} />
          <Field label="Tasse" value={fmtEuro(q.tasse)} hideEmpty />
          <Field label="Addizionali" value={fmtEuro(q.addizionali)} hideEmpty />
          <Field label="SSN" value={fmtEuro(q.ssn)} hideEmpty />
          <Field label="Provv. firma" value={fmtEuro(q.provvigioni_firma)} />
          <Field label="Provv. quietanza" value={fmtEuro(q.provvigioni_quietanza)} />
        </CompactCard>

        <SchedaCommercialeCard
          totProvv={commerciale?.totProvv ?? totProvvRata}
          righe={commerciale?.righe ?? []}
          hasProduttore={!!commerciale?.hasProduttore}
          loading={loadingComm}
        />
      </div>

      <CompactCard title="Messa a cassa">
        <div className="grid sm:grid-cols-3 gap-x-6">
          <Field label="Data messa a cassa" value={fmtDate(q.data_messa_cassa)} />
          <Field label="Data pagamento" value={fmtDate(q.data_pagamento)} hideEmpty />
          <Field label="Importo incassato" value={q.importo_incassato != null ? fmtEuro(q.importo_incassato) : "—"} />
        </div>
      </CompactCard>
    </div>
  );
}
