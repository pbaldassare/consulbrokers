/** Opzione sentinella della tendina Compagnia in header sinistro. Non è un id catalogo. */
export const COMPAGNIA_NON_IDENTIFICATA_VALUE = "__non_identificato__";

/** Prima voce della tendina: sempre questo testo, in corsivo. */
export const COMPAGNIA_NON_IDENTIFICATA_LABEL = "--Non identificato--";

export const COMPAGNIA_LIBERA_BADGE = "non in anagrafica";

export type CompagniaCatalogoOption = {
  id: string;
  nome: string | null;
  codice?: string | null;
};

export type SinistroCompagniaHeaderOption = {
  value: string;
  label: string;
  searchText?: string;
  labelClassName?: string;
  triggerLabel?: string;
};

export type CompagniaSinistroAggiornaPayload = {
  azione: "aggiorna";
  sinistro_id: string;
  user_id?: string;
  compagnia_id: string | null;
  compagnia_libera: string | null;
};

export function isCompagniaNonIdentificata(value: string | null | undefined): boolean {
  return value === COMPAGNIA_NON_IDENTIFICATA_VALUE;
}

export function normalizeCompagniaLibera(nome: string | null | undefined): string | null {
  const trimmed = (nome || "").trim();
  return trimmed || null;
}

/**
 * Prima voce: --Non identificato-- (italic). Poi eventuale compagnia corrente
 * assente dal catalogo, poi le compagnie attive. Nessun insert in anagrafica.
 */
export function buildSinistroCompagniaHeaderOptions(args: {
  compagnie: CompagniaCatalogoOption[];
  currentId?: string | null;
  compagniaNome?: string | null;
  compagniaLibera?: string | null;
}): SinistroCompagniaHeaderOption[] {
  const list = [...args.compagnie];
  const currentId = (args.currentId || "").trim();
  if (currentId && !list.some((c) => c.id === currentId)) {
    list.unshift({
      id: currentId,
      nome: args.compagniaNome || "Compagnia corrente",
      codice: null,
    });
  }

  const libera = normalizeCompagniaLibera(args.compagniaLibera);
  const nonIdentificata: SinistroCompagniaHeaderOption = {
    value: COMPAGNIA_NON_IDENTIFICATA_VALUE,
    label: COMPAGNIA_NON_IDENTIFICATA_LABEL,
    labelClassName: "italic",
    triggerLabel: libera || undefined,
    searchText: `${COMPAGNIA_NON_IDENTIFICATA_LABEL} non identificato compagnia libera`,
  };

  const catalogo = list.map((c) => ({
    value: c.id,
    label: c.nome || c.id,
    searchText: `${c.nome || ""} ${c.codice || ""}`.trim(),
  }));

  return [nonIdentificata, ...catalogo];
}

export function selectedCompagniaHeaderValue(args: {
  compagniaId?: string | null;
  compagniaLibera?: string | null;
}): string {
  if (normalizeCompagniaLibera(args.compagniaLibera)) return COMPAGNIA_NON_IDENTIFICATA_VALUE;
  return (args.compagniaId || "").trim();
}

export function displayNomeCompagniaSinistro(args: {
  compagniaNome?: string | null;
  compagniaLibera?: string | null;
}): { text: string; libera: boolean } {
  const catalogo = (args.compagniaNome || "").trim();
  if (catalogo) return { text: catalogo, libera: false };
  const libera = normalizeCompagniaLibera(args.compagniaLibera);
  if (libera) return { text: libera, libera: true };
  return { text: "", libera: false };
}

export type SceltaCompagniaHeader = "dialog" | "catalogo" | "noop";

/** Click su --Non identificato-- (o re-click se già libera) → popup. Altrimenti catalogo. */
export function resolveSceltaCompagniaHeader(
  nextValue: string,
  currentIsLibera: boolean,
): SceltaCompagniaHeader {
  if (isCompagniaNonIdentificata(nextValue) || (nextValue === "" && currentIsLibera)) {
    return "dialog";
  }
  if (!nextValue) return "noop";
  return "catalogo";
}

/** Persistenza nome libero: solo riga sinistro, FK catalogo a null. Nessun insert in compagnie. */
export function payloadCompagniaLibera(
  sinistroId: string,
  nome: string,
  userId?: string | null,
): CompagniaSinistroAggiornaPayload | null {
  const compagnia_libera = normalizeCompagniaLibera(nome);
  if (!compagnia_libera) return null;
  return {
    azione: "aggiorna",
    sinistro_id: sinistroId,
    ...(userId ? { user_id: userId } : {}),
    compagnia_id: null,
    compagnia_libera,
  };
}

/** Persistenza compagnia di anagrafica: pulisce il testo libero sul sinistro. */
export function payloadCompagniaCatalogo(
  sinistroId: string,
  compagniaId: string,
  userId?: string | null,
): CompagniaSinistroAggiornaPayload | null {
  const id = (compagniaId || "").trim();
  if (!id || isCompagniaNonIdentificata(id)) return null;
  return {
    azione: "aggiorna",
    sinistro_id: sinistroId,
    ...(userId ? { user_id: userId } : {}),
    compagnia_id: id,
    compagnia_libera: null,
  };
}
