/**
 * Etichette compagnia / agenzia da titolo (join compagnia_diretta + compagnia_rapporto).
 * Per broker/pluri la Compagnia Assicurativa è sul rapporto (gruppo), non sull'anagrafica agenzia.
 */

type GruppoLike = { descrizione?: string | null; codice?: string | null } | null | undefined;

type TitoloCompagniaLike = {
  compagnia_diretta?: {
    nome?: string | null;
    codice?: string | null;
    gruppo_compagnia?: string | null;
    gruppi_compagnia?: GruppoLike;
  } | null;
  compagnia_rapporto?: {
    gruppi_compagnia?: GruppoLike;
  } | null;
  prodotti?: { compagnie?: { nome?: string | null } | null } | null;
};

function isPlaceholderGruppo(value: string | null | undefined): boolean {
  const v = (value || "").trim();
  return !v || v.toLowerCase() === "da definire";
}

/** Compagnia assicurativa (gruppo): da rapporto se presente, altrimenti da agenzia. */
export function labelCompagniaAssicurativa(t: TitoloCompagniaLike | null | undefined): string {
  if (!t) return "";
  const fromRapporto = (t.compagnia_rapporto?.gruppi_compagnia?.descrizione || "").trim();
  if (!isPlaceholderGruppo(fromRapporto)) return fromRapporto;

  const fromAgenziaFk = (t.compagnia_diretta?.gruppi_compagnia?.descrizione || "").trim();
  if (!isPlaceholderGruppo(fromAgenziaFk)) return fromAgenziaFk;

  const fromAgenziaText = (t.compagnia_diretta?.gruppo_compagnia || "").trim();
  if (!isPlaceholderGruppo(fromAgenziaText)) return fromAgenziaText;

  return "";
}

/** Agenzia / broker di riferimento (anagrafica compagnie). */
export function labelAgenziaRiferimento(t: TitoloCompagniaLike | null | undefined): string {
  if (!t) return "";
  return (t.compagnia_diretta?.nome || t.prodotti?.compagnie?.nome || "").trim();
}

/**
 * Riga header / liste: "Lloyd's · Simplymore" se diversi, altrimenti il solo nome disponibile.
 */
export function labelCompagniaEAgenzia(t: TitoloCompagniaLike | null | undefined): string {
  const comp = labelCompagniaAssicurativa(t);
  const ag = labelAgenziaRiferimento(t);
  if (comp && ag && comp.toLowerCase() !== ag.toLowerCase()) return `${comp} · ${ag}`;
  return comp || ag || "";
}
