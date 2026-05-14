// Helpers condivisi per frazionamento polizze.
// La verità UI è `titoli.frazionamento` (testo). `titoli.rate` è derivato (intero rate/anno).

export const FRAZIONAMENTI = [
  { value: "Mensile", label: "Mensile" },
  { value: "Trimestrale", label: "Trimestrale" },
  { value: "Quadrimestrale", label: "Quadrimestrale" },
  { value: "Semestrale", label: "Semestrale" },
  { value: "Annuale", label: "Annuale" },
  { value: "Poliennale", label: "Poliennale" },
] as const;

export type Frazionamento = typeof FRAZIONAMENTI[number]["value"];

export function frazionamentoMesi(f: string, anni: number): number {
  switch (f) {
    case "Mensile": return 1;
    case "Trimestrale": return 3;
    case "Quadrimestrale": return 4;
    case "Semestrale": return 6;
    case "Poliennale": return Math.max(1, anni) * 12;
    case "Annuale":
    default: return 12;
  }
}

export function frazionamentoToRate(f: string, anni: number): number {
  if (f === "Poliennale") return 1;
  const m = frazionamentoMesi(f, anni);
  return Math.max(1, Math.round(12 / m));
}

/** Deriva il frazionamento testuale da rate/anni (per polizze legacy). */
export function derivaFrazionamentoDaRate(
  rate: number | null | undefined,
  anniDurata?: number | null,
): Frazionamento {
  if ((anniDurata || 0) > 1 && (rate || 1) === 1) return "Poliennale";
  switch (Number(rate)) {
    case 12: return "Mensile";
    case 4: return "Trimestrale";
    case 3: return "Quadrimestrale";
    case 2: return "Semestrale";
    case 1: return "Annuale";
    default: return "Annuale";
  }
}
