/** Quote produttore / AE in estrazione premi-provvigioni (esclude residuo agenzia/admin). */
export function isProvvPassiveDestinatario(tipo: string | null | undefined): boolean {
  return tipo === "commerciale" || tipo === "ae";
}

export type RigaProvvGenerate = {
  importo_provvigione?: number | null;
  tipo_destinatario?: string | null;
  solo_statistico?: boolean | null;
};

export function sumImportoProvvPassive(rows: RigaProvvGenerate[]): number {
  return rows.reduce((acc, p) => {
    if (p.solo_statistico) return acc;
    if (!isProvvPassiveDestinatario(p.tipo_destinatario)) return acc;
    return acc + (Number(p.importo_provvigione) || 0);
  }, 0);
}
