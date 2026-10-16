const ROUTES: Record<string, (id: string) => string> = {
  titolo: (id) => `/titoli/${id}`,
  polizza: (id) => `/polizze/${id}`,
  quietanza: (id) => `/quietanze/${id}`,
  sinistro: (id) => `/sinistri/${id}`,
  cliente: (id) => `/clienti/${id}`,
  prospect: (id) => `/prospect/${id}`,
  trattativa: (id) => `/trattative/${id}`,
  compagnia: (id) => `/compagnie/${id}`,
  nota_restituzione: (id) => `/note-restituzione/${id}`,
};

const LABELS: Record<string, string> = {
  titolo: "Titolo",
  polizza: "Polizza",
  quietanza: "Quietanza",
  sinistro: "Sinistro",
  cliente: "Cliente",
  prospect: "Prospect",
  trattativa: "Trattativa",
  compagnia: "Agenzia",
  nota_restituzione: "Nota restituzione",
};

export function registroEntitaLabel(tipo: string | null): string {
  if (!tipo) return "—";
  return LABELS[tipo] ?? tipo.replace(/_/g, " ");
}

export function registroEntitaPath(tipo: string | null, id: string | null): string | null {
  if (!tipo || !id) return null;
  const fn = ROUTES[tipo];
  return fn ? fn(id) : null;
}
