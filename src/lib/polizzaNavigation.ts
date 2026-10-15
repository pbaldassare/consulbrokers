/** Unica vista staff per polizza, quietanza, appendice, regolazione, proroga. */
export function hrefTitoloDettaglio(titoloId?: string | null): string | null {
  if (!titoloId) return null;
  return `/titoli/${titoloId}`;
}

/** Polizza-contratto (tabella `polizze`) → titolo madre o alias redirect. */
export function hrefPolizzaContratto(opts: {
  titoloId?: string | null;
  polizzaId?: string | null;
}): string | null {
  const titolo = hrefTitoloDettaglio(opts.titoloId);
  if (titolo) return titolo;
  if (opts.polizzaId) return `/polizze/${opts.polizzaId}`;
  return null;
}

/** Riga `quietanze` legacy → titolo collegato o alias redirect. */
export function hrefQuietanzaDettaglio(opts: {
  titoloId?: string | null;
  quietanzaId?: string | null;
}): string | null {
  const titolo = hrefTitoloDettaglio(opts.titoloId);
  if (titolo) return titolo;
  if (opts.quietanzaId) return `/quietanze/${opts.quietanzaId}`;
  return null;
}
