/** Normalizza testo per il cerca agenzie (accenti, spazi). */
export function normAgenziaSearch(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matchAgenziaRagioneSociale(
  row: { nome?: string | null; nome_sede?: string | null; comune?: string | null },
  query: string,
): boolean {
  const q = normAgenziaSearch(query);
  if (!q) return true;
  return [row.nome, row.nome_sede, row.comune].some((v) => normAgenziaSearch(v).includes(q));
}
