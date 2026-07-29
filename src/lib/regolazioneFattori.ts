/**
 * Griglia fattori di regolazione × anno (date presunte).
 * Chiave importi: `${fattoreId}|${anno}`.
 */

export type FattoreRegolazioneRef = {
  id: string;
  codice: string;
  descrizione: string;
};

export type RegolazioneFattoreExisting = {
  fattore_id: string;
  anno: number;
  importo_esposto: number;
  data_presunta?: string | null;
  note?: string | null;
};

export type RegolazioneFattoreRow = {
  anno: number;
  data_presunta: string | null;
  fattore_id: string;
  fattore_codice: string;
  fattore_descrizione: string;
  importo_esposto: number;
};

export function regolazioneFattoreKey(fattoreId: string, anno: number): string {
  return `${fattoreId}|${anno}`;
}

export function yearFromIsoDate(
  iso: string | null | undefined,
  fallback?: number,
): number | null {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return Number(iso.slice(0, 4));
  }
  if (fallback != null && Number.isFinite(fallback)) return Math.floor(fallback);
  return null;
}

/**
 * Costruisce le righe Anno×Fattore da date presunte e fattori collegati al sottoramo.
 * Se non ci sono date, usa almeno un anno (fallbackAnno o anno corrente).
 */
export function buildRegolazioneFattoriRows(opts: {
  datePresunte: string[];
  fattori: FattoreRegolazioneRef[];
  existing?: RegolazioneFattoreExisting[];
  importiMap?: Record<string, number>;
  fallbackAnno?: number;
}): RegolazioneFattoreRow[] {
  const fattori = opts.fattori ?? [];
  if (!fattori.length) return [];

  const dates = (opts.datePresunte ?? []).filter((d) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  const yearSlots: { anno: number; data_presunta: string | null }[] = [];

  if (dates.length) {
    for (const d of dates) {
      const anno = yearFromIsoDate(d)!;
      yearSlots.push({ anno, data_presunta: d });
    }
  } else {
    const anno =
      opts.fallbackAnno ??
      new Date().getFullYear() + 1;
    yearSlots.push({ anno, data_presunta: null });
  }

  const existingByKey = new Map<string, RegolazioneFattoreExisting>();
  for (const e of opts.existing ?? []) {
    existingByKey.set(regolazioneFattoreKey(e.fattore_id, e.anno), e);
  }

  const rows: RegolazioneFattoreRow[] = [];
  for (const slot of yearSlots) {
    for (const f of fattori) {
      const key = regolazioneFattoreKey(f.id, slot.anno);
      const fromMap = opts.importiMap?.[key];
      const fromExisting = existingByKey.get(key);
      const importo =
        fromMap != null && Number.isFinite(fromMap)
          ? fromMap
          : Number(fromExisting?.importo_esposto) || 0;
      rows.push({
        anno: slot.anno,
        data_presunta: slot.data_presunta,
        fattore_id: f.id,
        fattore_codice: f.codice,
        fattore_descrizione: f.descrizione,
        importo_esposto: importo,
      });
    }
  }
  return rows;
}

/** Payload insert per titoli_regolazione_fattori. */
export function rowsToInsertPayload(
  titoloId: string,
  ramoId: string,
  rows: RegolazioneFattoreRow[],
): Array<{
  titolo_id: string;
  ramo_id: string;
  fattore_id: string;
  importo_esposto: number;
  anno: number;
  data_presunta: string | null;
}> {
  return rows.map((r) => ({
    titolo_id: titoloId,
    ramo_id: ramoId,
    fattore_id: r.fattore_id,
    importo_esposto: Number(r.importo_esposto) || 0,
    anno: r.anno,
    data_presunta: r.data_presunta,
  }));
}
