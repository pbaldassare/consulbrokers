/** Tipi conto Consulbrokers (soggetti a sedi abilitate N:N). */
export const CONSULBROKERS_CONTI_TIPI = ["incasso_clienti", "provvigioni", "generico"] as const;
export type ConsulbrokersContoTipo = (typeof CONSULBROKERS_CONTI_TIPI)[number];

export const isConsulbrokersContoTipo = (tipo?: string | null): tipo is ConsulbrokersContoTipo =>
  !!tipo && (CONSULBROKERS_CONTI_TIPI as readonly string[]).includes(tipo);

export interface ContoBancarioConSedi {
  id: string;
  tipo: string;
  ufficio_ids?: string[];
  conti_bancari_uffici?: Array<{ ufficio_id: string }>;
}

/** Estrae gli ufficio_id dalla riga conto (join o array pre-mappato). */
export const extractUfficioIds = (conto: ContoBancarioConSedi): string[] => {
  if (conto.ufficio_ids?.length) return conto.ufficio_ids;
  return (conto.conti_bancari_uffici || []).map((r) => r.ufficio_id);
};

export interface ValidateSediResult {
  valid: boolean;
  error?: string;
}

/** Validazione sedi abilitate per conti Consulbrokers (min 1). */
export const validateContoBancarioSedi = (
  tipo: string | null | undefined,
  ufficioIds: string[],
): ValidateSediResult => {
  if (!isConsulbrokersContoTipo(tipo)) {
    return { valid: true };
  }
  if (!ufficioIds.length) {
    return {
      valid: false,
      error: "Seleziona almeno una sede abilitata per i conti Consulbrokers.",
    };
  }
  return { valid: true };
};

export type SedeContiSelection = {
  selectedIds: string[];
  defaultId: string | null;
};

/** Toggle conto sulla sede: tiene un default E/C tra i selezionati. */
export function applySedeContoToggle(
  current: SedeContiSelection,
  contoId: string,
  checked: boolean,
): SedeContiSelection {
  if (checked) {
    const selectedIds = current.selectedIds.includes(contoId)
      ? current.selectedIds
      : [...current.selectedIds, contoId];
    const defaultId =
      current.defaultId && selectedIds.includes(current.defaultId)
        ? current.defaultId
        : selectedIds[0] ?? null;
    return { selectedIds, defaultId };
  }
  const selectedIds = current.selectedIds.filter((id) => id !== contoId);
  const defaultId =
    current.defaultId && selectedIds.includes(current.defaultId)
      ? current.defaultId
      : selectedIds[0] ?? null;
  return { selectedIds, defaultId };
}

/** Imposta il default E/C solo se il conto è tra i selezionati. */
export function applySedeContoDefault(
  current: SedeContiSelection,
  contoId: string,
): SedeContiSelection {
  if (!current.selectedIds.includes(contoId)) return current;
  return { ...current, defaultId: contoId };
}

/** Unisce link N:N e default sede (conto_bancario_id). */
export function seedSedeContiSelection(
  linkedIds: string[],
  defaultId?: string | null,
): SedeContiSelection {
  const selectedIds = Array.from(
    new Set([...linkedIds, defaultId].filter((id): id is string => !!id)),
  );
  return {
    selectedIds,
    defaultId: defaultId && selectedIds.includes(defaultId) ? defaultId : selectedIds[0] ?? null,
  };
}
