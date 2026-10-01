import type { ReactNode } from "react";
import { Building2, User } from "lucide-react";
import { fmtEuro } from "@/lib/formatCurrency";
import type { RipartoRiga } from "@/lib/schedaCommerciale";
import { CompactCard } from "@/components/titolo/SchedaCompact";

type Props = {
  totProvv: number;
  righe: RipartoRiga[];
  hasProduttore: boolean;
  loading?: boolean;
  /** Etichetta del totale (annue sul contratto, di rata sulla quietanza). */
  totaleLabel?: string;
  extraFields?: { label: string; value: ReactNode }[];
};

export function SchedaCommercialeCard({
  totProvv,
  righe,
  hasProduttore,
  loading,
  totaleLabel = "Provvigioni",
  extraFields,
}: Props) {
  const produttori = righe.filter((r) => r.ruolo === "produttore");
  const ae = righe.filter((r) => r.ruolo === "ae");
  const agenzia = righe.find((r) => r.ruolo === "agenzia" && (r.perc > 0 || r.importo > 0));

  return (
    <CompactCard title="Produttore & provvigioni" accent="border-l-teal-600">
      {loading ? (
        <p className="text-sm text-muted-foreground py-2">Caricamento commerciale…</p>
      ) : (
        <div className="space-y-2">
          {!hasProduttore && (
            <p className="text-xs text-muted-foreground pb-1">
              Nessun produttore assegnato — l&apos;intera quota resta in agenzia.
            </p>
          )}
          {produttori.map((r, i) => (
            <RipartoRow key={`p-${i}`} r={r} icon="produttore" />
          ))}
          {ae.map((r, i) => (
            <RipartoRow key={`ae-${i}`} r={r} icon="ae" />
          ))}
          {agenzia && <RipartoRow r={agenzia} icon="agenzia" />}
          <div className="flex justify-between gap-4 pt-1.5 border-t border-border/60 text-sm">
            <span className="text-muted-foreground">{totaleLabel}</span>
            <span className="font-bold tabular-nums">{fmtEuro(totProvv)}</span>
          </div>
          {extraFields?.map((f) => (
            <div key={f.label} className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="font-medium tabular-nums">{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </CompactCard>
  );
}

function RipartoRow({ r, icon }: { r: RipartoRiga; icon: "produttore" | "ae" | "agenzia" }) {
  const Icon = icon === "agenzia" ? Building2 : User;
  const tone =
    icon === "agenzia"
      ? "bg-amber-500"
      : icon === "ae"
        ? "bg-sky-600"
        : "bg-teal-600";
  return (
    <div className="flex items-center gap-2.5 py-1">
      <div className={`w-7 h-7 rounded-full ${tone} text-white flex items-center justify-center shrink-0`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {r.ruolo === "produttore" ? "Produttore" : r.ruolo === "ae" ? "Account executive" : "Agenzia"}
          <span className="ml-1.5 font-mono text-foreground">{r.perc}%</span>
        </div>
        <div className="text-sm font-semibold truncate">{r.nome}</div>
      </div>
      <div className="text-sm font-mono tabular-nums font-semibold shrink-0">{fmtEuro(r.importo)}</div>
    </div>
  );
}
