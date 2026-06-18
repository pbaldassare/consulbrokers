// Helpers per la ricerca polizze nel wizard apertura sinistro.
// Estratti per consentire test di regressione sul comportamento
// "Solo madri" vs "Tutte le polizze" e sull'assenza di deduplica.

export type TitoloRow = {
  id: string;
  numero_titolo: string | null;
  sostituisce_polizza?: string | null;
  [k: string]: any;
};

export type CgaRow = {
  id: string;
  numero_polizza: string | null;
  cliente_id?: string | null;
  prodotti_cga?: { nome_prodotto?: string; compagnia?: string; ramo?: string } | null;
  [k: string]: any;
};

/**
 * Applica il filtro "solo madri" (sostituisce_polizza IS NULL) sulla query
 * di supabase quando richiesto. Restituisce la query (potenzialmente modificata).
 *
 * Pensata per essere testabile con un fake query builder.
 */
export function applySoloMadriFilter<T extends { is: (col: string, val: any) => T }>(
  query: T,
  onlyMothers: boolean,
): T {
  return onlyMothers ? query.is('sostituisce_polizza', null) : query;
}

/**
 * Unisce i risultati titoli + CGA mantenendo TUTTE le occorrenze
 * (nessuna deduplica su numero_titolo: madri e quietanze devono comparire).
 * Filtra solo le righe senza numero_titolo.
 */
export function mergePolizze(titoli: TitoloRow[], cga: CgaRow[]) {
  const fromTitoli = (titoli ?? []).map((t) => ({ ...t, _isCga: false as const }));
  const fromCga = (cga ?? []).map((c) => ({
    id: `cga:${c.id}`,
    numero_titolo: c.numero_polizza,
    stato: 'attivo' as const,
    cliente_anagrafica_id: c.cliente_id ?? null,
    ufficio_id: null,
    prodotti: {
      nome_prodotto: c.prodotti_cga?.nome_prodotto,
      compagnie: { id: null, nome: c.prodotti_cga?.compagnia },
    },
    clienti: null,
    _isCga: true as const,
  }));
  return [...fromTitoli, ...fromCga].filter((p: any) => p.numero_titolo);
}
