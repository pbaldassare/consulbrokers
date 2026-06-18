import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Loader2, Pencil } from "lucide-react";
import { fmtEuro } from "@/lib/formatCurrency";
import { format } from "date-fns";

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

  const { data: q, isLoading } = useQuery({
    queryKey: ["quietanza", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quietanze")
        .select(`
          *,
          polizze:polizza_id (
            id, numero_polizza, stato, cliente_anagrafica_id, compagnia_id, ramo_id,
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
  const st = STATO_QUIETANZA[q.stato as string] || { label: q.stato as string, cls: "" };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button onClick={() => navigate(-1)} className="hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Indietro
            </button>
            <span>·</span>
            <span>Quietanza</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Rata {q.numero_rata}{q.numero_rate_totali ? ` / ${q.numero_rate_totali}` : ""}
            <Badge variant="outline" className={st.cls + " ml-2"}>{st.label}</Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            Polizza{" "}
            {polizza ? (
              <Link to={`/polizze/${polizza.id}`} className="text-primary hover:underline font-medium">
                {polizza.numero_polizza}
              </Link>
            ) : "—"}{" "}
            · {clienteNome} · {polizza?.compagnie?.nome || "—"}
          </p>
        </div>
        <div className="flex gap-2">
          {(q as any).titolo_id && (
            <Button variant="outline" asChild>
              <Link to={`/titoli/${(q as any).titolo_id}`}>
                <Pencil className="h-4 w-4 mr-2" /> Apri editing completo
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Periodo & scadenze</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="Decorrenza" value={fmtDate(q.garanzia_da)} />
            <Field label="Scadenza garanzia" value={fmtDate(q.garanzia_a)} />
            <Field label="Competenza" value={fmtDate(q.data_competenza)} />
            <Field label="Scadenza pagamento" value={fmtDate(q.data_scadenza)} />
            <Field label="Limite mora" value={fmtDate(q.limite_mora)} />
            <Field label="Giorni mora" value={q.mora_giorni?.toString()} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Importi</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="Premio netto" value={fmtEuro(q.premio_netto)} />
            <Field label="Tasse" value={fmtEuro(q.tasse)} />
            <Field label="Addizionali" value={fmtEuro(q.addizionali)} />
            <Field label="SSN" value={fmtEuro(q.ssn)} />
            <Field label="Premio lordo" value={fmtEuro(q.premio_lordo)} highlight />
            <Field label="Provv. firma" value={fmtEuro(q.provvigioni_firma)} />
            <Field label="Provv. quietanza" value={fmtEuro(q.provvigioni_quietanza)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Messa a cassa & incasso</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="Data messa a cassa" value={fmtDate(q.data_messa_cassa)} />
            <Field label="Data pagamento" value={fmtDate(q.data_pagamento)} />
            <Field label="Data incasso" value={fmtDate(q.data_incasso)} />
            <Field label="Importo incassato" value={q.importo_incassato != null ? fmtEuro(q.importo_incassato) : "—"} highlight />
            <Field label="Tipo incasso" value={q.tipo_incasso} />
            <Field label="Conto incasso" value={q.conto_incasso} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Riferimenti</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="N° polizza (snapshot)" value={q.numero_polizza_snapshot} />
            <Field label="Appendice" value={q.appendice} />
            {(q as any).titolo_id && (
              <div className="pt-2 border-t mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Titolo legacy</span>
                <Link to={`/titoli/${(q as any).titolo_id}`} className="text-primary hover:underline text-xs inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Apri
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={"text-right " + (highlight ? "font-bold text-foreground" : "font-medium")}>
        {value || value === 0 ? value : "—"}
      </span>
    </div>
  );
}
