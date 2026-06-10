import { Badge } from "@/components/ui/badge";
import { Scale } from "lucide-react";
import type { CompensazioneSummary } from "@/hooks/useCompensazioniByTitoli";

interface Props {
  summary?: CompensazioneSummary;
}

/**
 * Indicatore visivo per titoli con compensazioni contabili applicate.
 * Mostra il numero di righe + impatto netto sul dovuto cliente.
 */
export function CompensazioneBadge({ summary }: Props) {
  if (!summary || summary.count === 0) return null;
  const segno = summary.totale >= 0 ? "−" : "+"; // riduce o aumenta il dovuto cliente
  const abs = Math.abs(summary.totale).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <Badge
      variant="outline"
      className="border-teal-500 text-teal-700 bg-teal-50 gap-1 text-[10px] h-5"
      title={`${summary.count} compensazion${summary.count === 1 ? "e" : "i"} contabil${summary.count === 1 ? "e" : "i"} · impatto netto ${segno} € ${abs}`}
    >
      <Scale className="h-3 w-3" />
      Comp. {segno}€{abs}
    </Badge>
  );
}
