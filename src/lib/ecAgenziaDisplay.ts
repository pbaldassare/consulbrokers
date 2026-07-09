/** Cliente da join titoli → clienti_anagrafica / clienti. */
export function formatClienteEc(
  cli: { ragione_sociale?: string | null; cognome?: string | null; nome?: string | null } | null | undefined,
): string {
  if (!cli) return "—";
  return cli.ragione_sociale || `${cli.cognome || ""} ${cli.nome || ""}`.trim() || "—";
}

type TitoloImportoEc = {
  stato?: string | null;
  premio_lordo?: number | null;
  importo_incassato?: number | null;
};

/**
 * Vista E/C agenzia: se il premio è saldato (incassato), mostra il premio lordo.
 * L'abbuono è quadratura interna; all'agenzia interessa il premio versato.
 */
export function resolveImportoVersatoAgenzia(t: TitoloImportoEc): number {
  if (t.stato === "incassato") return Number(t.premio_lordo) || 0;
  return Number(t.importo_incassato) || 0;
}

/** Etichetta tipo pagamento verso agenzia: mai abbuono/compensazione interna. */
export function resolveTipoPagamentoLabelEcAgenzia(tipoPagamento: string | null | undefined): string {
  const tp = (tipoPagamento || "").toLowerCase();
  if (!tp || tp === "abbuono") return "Premio saldato";
  if (tp === "compensato" || tp === "misto_compensato") return "Premio saldato";
  if (tp === "contanti") return "Contanti";
  if (tp === "pos" || tp === "carta_credito") return "POS";
  if (tp === "bonifico") return "Bonifico";
  if (tp === "garantito") return "Garantito";
  if (tp === "pagamento_diretto_compagnia") return "Pag. diretto";
  if (tp === "anticipo" || tp === "anticipo_misto") return "Acconto";
  return tipoPagamento || "—";
}

/** Codice MI export E/C agenzia: mai esporre abbuono/compensazione. */
export function resolveTipoPagamentoMiEcAgenzia(tipoPagamento: string | null | undefined): string {
  const tp = (tipoPagamento || "").toLowerCase();
  if (tp === "contanti") return "C";
  if (tp === "bonifico" || tp === "abbuono" || tp === "compensato" || tp === "misto_compensato") return "B";
  if (tp === "garantito") return "G";
  return "";
}

export function resolveTipoPagamentoBadgeVariant(
  tipoPagamento: string | null | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  const tp = (tipoPagamento || "").toLowerCase();
  if (tp === "contanti") return "secondary";
  if (tp === "pos" || tp === "carta_credito" || tp === "garantito") return "default";
  if (tp === "bonifico" || tp === "compensato" || tp === "misto_compensato") return "outline";
  if (tp === "pagamento_diretto_compagnia") return "outline";
  return "secondary";
}
