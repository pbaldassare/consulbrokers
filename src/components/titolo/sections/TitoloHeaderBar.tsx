import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { fmtEuro } from "@/lib/formatCurrency";

interface Props {
  t: any;
  onBack: () => void;
}

/**
 * Header sticky del dettaglio titolo. Estratto da TitoloDetail.tsx
 * senza modifiche: stesso markup, stessi badge, stessa logica condizionale.
 */
export function TitoloHeaderBar({ t, onBack }: Props) {
  return (
    <div className="sticky top-14 z-10 -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">Polizza {t.numero_titolo || t.id.slice(0, 8)}</h1>
            {t.sostituisce_polizza ? (
              <Badge variant="secondary" title={`Sostituisce ${t.sostituisce_polizza}`}>
                Quietanza{t.garanzia_da ? ` · dal ${t.garanzia_da}${t.garanzia_a ? ` al ${t.garanzia_a}` : ""}` : ""}
              </Badge>
            ) : (
              <Badge variant="outline">Polizza originale</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">{(t as any).prodotto_nome || t.prodotti?.nome_prodotto || ""} — {(t.compagnia_diretta as any)?.nome || t.prodotti?.compagnie?.nome || "N/D"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Cliente:</span>
              <span className="font-medium text-foreground">
                {t.cliente_anagrafica
                  ? ((t.cliente_anagrafica as any).tipo_cliente === "privato"
                    ? `${(t.cliente_anagrafica as any).cognome || ""} ${(t.cliente_anagrafica as any).nome || ""}`.trim() || "—"
                    : (t.cliente_anagrafica as any).ragione_sociale || "—")
                  : "—"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Sede:</span>
              <span className="font-medium text-foreground">{(t as any).uffici?.nome_ufficio || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Importo Firma:</span>
              <span className="font-semibold text-teal-700 tabular-nums">{fmtEuro((t as any).premio_lordo)}</span>
            </div>
          </div>
        </div>
        {t.stato === "in_attesa_rinnovo" ? (
          <Badge className="text-sm bg-orange-500 hover:bg-orange-600 text-white shrink-0" title="Diventerà attivo quando la polizza precedente sarà messa a cassa">
            In attesa rinnovo
          </Badge>
        ) : (
          <Badge variant={t.stato === "incassato" ? "default" : t.stato === "stornato" ? "destructive" : "secondary"} className="text-sm shrink-0">
            {t.stato}
          </Badge>
        )}
      </div>
    </div>
  );
}
