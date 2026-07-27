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
