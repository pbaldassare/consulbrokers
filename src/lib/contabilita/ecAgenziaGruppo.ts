import { resolveCompagniaCollegataNome } from "@/lib/ecAgenziaDisplay";

/** Chiave riga E/C: un rapporto mandato = un estratto; senza rapporto resta per agenzia. */
export function ecAgenziaGroupKey(compagniaId: string, rapportoId?: string | null): string {
  if (rapportoId) return `rapporto:${rapportoId}`;
  return `compagnia:${compagniaId}`;
}

/** Progressivo mensile: per mandato usa l'id rapporto, altrimenti l'agenzia. */
export function ecAgenziaProgressivoEntitaId(compagniaId: string, rapportoId?: string | null): string {
  return rapportoId || compagniaId;
}

export function ecAgenziaCodiceProgressivo(opts: {
  codiceRapporto?: string | null;
  codiceGruppo?: string | null;
  codiceCompagnia?: string | null;
}): string {
  const c =
    (opts.codiceRapporto || "").trim() ||
    (opts.codiceGruppo || "").trim() ||
    (opts.codiceCompagnia || "").trim();
  return c || "REF";
}

type RapportoMandataria = {
  gruppi_compagnia?: { descrizione?: string | null; codice?: string | null } | null;
} | null | undefined;

/** Mandataria (Unipol, AXA, …) dal rapporto; fallback gruppo sull'anagrafica agenzia. */
export function resolveEcAgenziaMandataria(
  rapporto: RapportoMandataria,
  comp: Parameters<typeof resolveCompagniaCollegataNome>[0],
): string {
  const fromR = (rapporto?.gruppi_compagnia?.descrizione || "").trim();
  if (fromR) return fromR;
  return resolveCompagniaCollegataNome(comp);
}
