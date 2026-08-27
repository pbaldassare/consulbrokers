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

/** Sottotitolo SearchableSelect polizze: prodotto · decorrenza → scadenza */
export function formatPolizzaOptionDescription(titolo: {
  prodotto_nome?: string | null;
  prodotti?: { nome_prodotto?: string | null } | null;
  garanzia_da?: string | null;
  durata_da?: string | null;
  data_decorrenza?: string | null;
  data_competenza?: string | null;
  garanzia_a?: string | null;
  data_scadenza?: string | null;
} | null | undefined): string {
  const prodotto = formatPolizzaProdotto(titolo);
  const decorrenza = formatPolizzaDecorrenza(titolo);
  const scadenza = formatPolizzaScadenza(titolo);
  if (decorrenza === "—" && scadenza === "—") return prodotto;
  return `${prodotto} · ${decorrenza} → ${scadenza}`;
}
