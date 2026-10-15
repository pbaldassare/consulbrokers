/** Dettaglio polizza = vista TitoloDetail (`/titoli/:id`). */
export function hrefPolizzaContratto(opts: {
  titoloId?: string | null;
  polizzaId?: string | null;
}): string | null {
  if (opts.titoloId) return `/titoli/${opts.titoloId}`;
  if (opts.polizzaId) return `/polizze/${opts.polizzaId}`;
  return null;
}
