/** Score rilevanza ricerca clienti (allineato a RPC search_clienti_ranked). Più basso = migliore. */
export type ClienteSearchFields = {
  nome?: string | null;
  cognome?: string | null;
  ragione_sociale?: string | null;
  citta_residenza?: string | null;
  citta_sede?: string | null;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function tokensAndMatch(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  return tokens.every((tok) => haystack.includes(tok));
}

export function scoreClienteSearch(c: ClienteSearchFields, term: string): number {
  const t = collapseSpaces(norm(term));
  if (!t) return 99;

  const tokens = t.split(/\s+/).filter(Boolean);

  const cittaRes = norm(c.citta_residenza);
  const cittaSede = norm(c.citta_sede);
  if (cittaRes === t || cittaSede === t) return 1;

  const rs = norm(c.ragione_sociale);
  const cognome = norm(c.cognome);
  const nome = norm(c.nome);
  const displayCn = collapseSpaces(`${cognome} ${nome}`);
  const displayNc = collapseSpaces(`${nome} ${cognome}`);
  const anagraficaBlob = collapseSpaces(`${cognome} ${nome} ${rs}`);

  if (rs === t || cognome === t || nome === t || displayCn === t || displayNc === t) return 2;

  if (
    rs.startsWith(t) ||
    cognome.startsWith(t) ||
    nome.startsWith(t) ||
    displayCn.startsWith(t) ||
    displayNc.startsWith(t)
  ) {
    return 3;
  }

  if (
    rs.includes(t) ||
    cognome.includes(t) ||
    nome.includes(t) ||
    displayCn.includes(t) ||
    displayNc.includes(t) ||
    tokensAndMatch(anagraficaBlob, tokens)
  ) {
    return 4;
  }

  return 5;
}
