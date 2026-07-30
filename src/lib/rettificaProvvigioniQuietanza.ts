/** Logica pura per rettifica provvigioni quietanza (testabile senza DB). */

export type ProvvigioneSplitRow = {
  percentuale: number;
  importo_provvigione: number;
  tipo_destinatario?: string | null;
  anagrafica_commerciale_id?: string | null;
  user_id?: string | null;
  solo_statistico?: boolean;
};

export function calcDeltaProvvigioni(vecchio: number | null | undefined, nuovo: number): number {
  const v = Number(vecchio) || 0;
  const n = Number(nuovo) || 0;
  return Math.round((n - v) * 100) / 100;
}

export function validateRettificaNote(note: string | null | undefined): string | null {
  const trimmed = (note ?? "").trim();
  if (!trimmed) return "Le note sulla rettifica sono obbligatorie";
  if (trimmed.length < 5) return "Inserire una nota descrittiva (min. 5 caratteri)";
  return null;
}

export function validateNuovoImporto(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return "Importo provvigione obbligatorio";
  if (value < 0) return "L'importo non può essere negativo";
  return null;
}

/**
 * Ripartisce il delta sulle righe template (percentuali o importi originali).
 * Gestisce arrotondamento sull'ultima riga non-solo_statistico.
 */
export function splitDeltaProporzionale(
  delta: number,
  templateRows: ProvvigioneSplitRow[],
): ProvvigioneSplitRow[] {
  if (delta === 0 || templateRows.length === 0) return [];

  const weights = templateRows.map((r) => {
    const perc = Number(r.percentuale);
    if (perc > 0) return perc;
    const imp = Number(r.importo_provvigione);
    if (imp > 0) return imp;
    return 0;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    const share = Math.round((delta / templateRows.length) * 100) / 100;
    return templateRows.map((r) => ({
      ...r,
      importo_provvigione: share,
      percentuale: r.percentuale ?? 100 / templateRows.length,
    }));
  }

  const result: ProvvigioneSplitRow[] = [];
  let assigned = 0;
  let lastIdx = -1;

  templateRows.forEach((r, i) => {
    if (r.solo_statistico) {
      result.push({ ...r, importo_provvigione: 0 });
      return;
    }
    lastIdx = i;
    const portion = Math.round((delta * weights[i] / totalWeight) * 100) / 100;
    assigned += portion;
    result.push({
      ...r,
      importo_provvigione: portion,
      percentuale: r.percentuale ?? (weights[i] / totalWeight) * 100,
    });
  });

  if (lastIdx >= 0) {
    const diff = Math.round((delta - assigned) * 100) / 100;
    if (diff !== 0) {
      result[lastIdx] = {
        ...result[lastIdx],
        importo_provvigione: Math.round(((result[lastIdx].importo_provvigione ?? 0) + diff) * 100) / 100,
      };
    }
  }

  return result.filter((r) => !r.solo_statistico || (r.importo_provvigione ?? 0) !== 0);
}

export type QuietanzaRettificaSearchRow = {
  id: string;
  numero_titolo: string | null;
  cliente_nome_display: string | null;
  compagnia_nome: string | null;
  premio_lordo: number | null;
  provvigioni_quietanza: number | null;
  data_messa_cassa: string | null;
  numero_rata: number | null;
  numero_rate_totali: number | null;
  stato: string | null;
};

export function formatRataLabel(rata: number | null | undefined, totale: number | null | undefined): string {
  if (rata == null) return "—";
  if (totale != null && totale > 0) return `${rata}/${totale}`;
  return String(rata);
}
