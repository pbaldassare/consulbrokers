import { format, parseISO } from "date-fns";

export function formatPolizzaRamo(titolo: {
  ramo?: { descrizione?: string | null; gruppo_ramo?: { descrizione?: string | null } | null } | null;
} | null | undefined): string {
  if (!titolo?.ramo) return "—";
  const gruppo = titolo.ramo.gruppo_ramo?.descrizione?.trim();
  const sottoramo = titolo.ramo.descrizione?.trim();
  if (gruppo && sottoramo && gruppo !== sottoramo) return `${gruppo} · ${sottoramo}`;
  return gruppo || sottoramo || "—";
}

export function formatPolizzaScadenza(titolo: {
  garanzia_a?: string | null;
  data_scadenza?: string | null;
} | null | undefined): string {
  const raw = titolo?.garanzia_a || titolo?.data_scadenza;
  if (!raw) return "—";
  try {
    return format(parseISO(raw.slice(0, 10)), "dd/MM/yyyy");
  } catch {
    return raw.slice(0, 10);
  }
}

export function formatPolizzaDecorrenza(titolo: {
  garanzia_da?: string | null;
  durata_da?: string | null;
  data_decorrenza?: string | null;
  data_competenza?: string | null;
} | null | undefined): string {
  const raw = titolo?.garanzia_da || titolo?.durata_da || titolo?.data_decorrenza || titolo?.data_competenza;
  if (!raw) return "—";
  try {
    return format(parseISO(raw.slice(0, 10)), "dd/MM/yyyy");
  } catch {
    return raw.slice(0, 10);
  }
}

export function formatPolizzaProdotto(titolo: {
  prodotto_nome?: string | null;
  prodotti?: { nome_prodotto?: string | null } | null;
} | null | undefined): string {
  return titolo?.prodotto_nome?.trim() || titolo?.prodotti?.nome_prodotto?.trim() || "—";
}

export function formatPolizzaCompagnia(titolo: {
  compagnia_diretta?: { nome?: string | null } | null;
  prodotti?: { compagnie?: { nome?: string | null } | null } | null;
} | null | undefined): string {
  return (
    titolo?.compagnia_diretta?.nome?.trim() ||
    titolo?.prodotti?.compagnie?.nome?.trim() ||
    "—"
  );
}

/** Sottotitolo SearchableSelect polizze: compagnia · decorrenza → scadenza */
export function formatPolizzaOptionDescription(titolo: {
  compagnia_diretta?: { nome?: string | null } | null;
  prodotti?: {
    nome_prodotto?: string | null;
    compagnie?: { nome?: string | null } | null;
  } | null;
  prodotto_nome?: string | null;
  garanzia_da?: string | null;
  durata_da?: string | null;
  data_decorrenza?: string | null;
  data_competenza?: string | null;
  garanzia_a?: string | null;
  data_scadenza?: string | null;
} | null | undefined): string {
  const compagnia = formatPolizzaCompagnia(titolo);
  const decorrenza = formatPolizzaDecorrenza(titolo);
  const scadenza = formatPolizzaScadenza(titolo);
  return `${compagnia} · ${decorrenza} → ${scadenza}`;
}

/** Opzione SearchableSelect per polizze (wizard sinistro, dettaglio pratica). */
export function buildPolizzaSelectOption(p: {
  id: string;
  numero_titolo?: string | null;
  sostituisce_polizza?: string | null;
  stato?: string | null;
  compagnia_diretta?: { nome?: string | null } | null;
  prodotti?: {
    nome_prodotto?: string | null;
    compagnie?: { nome?: string | null } | null;
  } | null;
  prodotto_nome?: string | null;
  garanzia_da?: string | null;
  durata_da?: string | null;
  data_decorrenza?: string | null;
  data_competenza?: string | null;
  garanzia_a?: string | null;
  data_scadenza?: string | null;
}) {
  return {
    value: p.id,
    label: `${p.numero_titolo ?? ""}${p.sostituisce_polizza ? " (quietanza)" : ""}`,
    description: formatPolizzaOptionDescription(p),
    searchText: [
      p.numero_titolo,
      formatPolizzaCompagnia(p),
      formatPolizzaProdotto(p),
      p.stato || "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
