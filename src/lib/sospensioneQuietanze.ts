import type { SupabaseClient } from "@supabase/supabase-js";

/** Aggiunge giorni a una data ISO (YYYY-MM-DD), calcolo UTC per evitare drift timezone. */
export function addDaysISO(iso: string, days: number): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Giorni interi tra due date ISO (to − from). */
export function diffDaysISO(from: string, to: string): number {
  if (!from || !to) return 0;
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export interface QuietanzaSnapshotEntry {
  id: string;
  riga: number | null;
  garanzia_da: string | null;
  garanzia_a: string | null;
  premio_lordo: number | null;
  stato: string;
}

export interface QuietanzeSospensioneSnapshot {
  data_sospensione: string;
  quietanze: QuietanzaSnapshotEntry[];
  frozen_at: string;
}

export type QuietanzaRowForSnapshot = {
  id: string;
  riga?: number | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  premio_lordo?: number | null;
  stato?: string | null;
};

/** Costruisce lo snapshot JSON da salvare sulla polizza madre in sospensione. */
export function buildQuietanzeSnapshot(
  dataSospensione: string,
  quietanze: QuietanzaRowForSnapshot[],
): QuietanzeSospensioneSnapshot {
  return {
    data_sospensione: dataSospensione,
    quietanze: quietanze.map((q) => ({
      id: q.id,
      riga: q.riga ?? null,
      garanzia_da: q.garanzia_da ?? null,
      garanzia_a: q.garanzia_a ?? null,
      premio_lordo: q.premio_lordo != null ? Number(q.premio_lordo) : null,
      stato: q.stato ?? "attivo",
    })),
    frozen_at: new Date().toISOString(),
  };
}

/** Quietanza in corso al momento della sospensione (garanzia_da < data_sosp <= garanzia_a). */
export function wasInCorsoAtSuspension(
  garanziaDa: string | null | undefined,
  garanziaA: string | null | undefined,
  dataSospensione: string,
): boolean {
  if (!garanziaDa || !garanziaA || !dataSospensione) return false;
  return garanziaDa < dataSospensione && dataSospensione <= garanziaA;
}

/** Calcola le nuove date garanzia dopo riattivazione. */
export function computeShiftedDates(
  garanziaDaOrig: string | null | undefined,
  garanziaAOrig: string | null | undefined,
  dataSospensione: string,
  dataRiattivazione: string,
  shiftDays: number,
): { garanzia_da: string | null; garanzia_a: string | null } {
  if (!garanziaDaOrig || !garanziaAOrig) {
    return { garanzia_da: garanziaDaOrig ?? null, garanzia_a: garanziaAOrig ?? null };
  }
  if (wasInCorsoAtSuspension(garanziaDaOrig, garanziaAOrig, dataSospensione)) {
    return {
      garanzia_da: dataRiattivazione,
      garanzia_a: addDaysISO(garanziaAOrig, shiftDays),
    };
  }
  return {
    garanzia_da: addDaysISO(garanziaDaOrig, shiftDays),
    garanzia_a: addDaysISO(garanziaAOrig, shiftDays),
  };
}

/** Se titoloId è una quietanza (sostituisce_polizza valorizzato), risolve l'id della polizza madre. */
export async function resolveTitoloMadreId(
  supabase: SupabaseClient,
  titoloId: string,
): Promise<string> {
  const { data: row, error } = await supabase
    .from("titoli")
    .select("id, numero_titolo, sostituisce_polizza")
    .eq("id", titoloId)
    .single();
  if (error || !row) return titoloId;
  if (!row.sostituisce_polizza) return titoloId;
  if (!row.numero_titolo) return titoloId;

  const { data: madre } = await supabase
    .from("titoli")
    .select("id")
    .eq("numero_titolo", row.numero_titolo)
    .is("sostituisce_polizza", null)
    .order("riga", { ascending: true })
    .limit(1)
    .maybeSingle();

  return madre?.id ?? titoloId;
}

/** Seleziona quietanze da congelare in sospensione (future + in corso). */
export function selectQuietanzeToFreeze<T extends QuietanzaRowForSnapshot & { riga?: number | null; stato?: string | null; data_messa_cassa?: string | null }>(
  allRows: T[],
  madreRiga: number,
  dataSospensione: string,
): T[] {
  const byId = new Map<string, T>();

  for (const row of allRows) {
    const riga = Number(row.riga ?? 0);
    const isFuture =
      riga > madreRiga &&
      row.stato !== "incassato" &&
      !row.data_messa_cassa;
    const isInCorso =
      row.garanzia_da != null &&
      row.garanzia_a != null &&
      row.garanzia_da <= dataSospensione &&
      dataSospensione <= row.garanzia_a;

    if (isFuture || isInCorso) {
      byId.set(row.id, row);
    }
  }

  return Array.from(byId.values());
}

/** Estende le date di scadenza della polizza madre dopo slittamento quietanze. */
export function extendMadreScadenze(
  madre: {
    garanzia_a?: string | null;
    data_scadenza?: string | null;
    durata_a?: string | null;
  },
  shiftDays: number,
): Partial<{ garanzia_a: string; data_scadenza: string; durata_a: string }> {
  if (shiftDays <= 0) return {};
  const patch: Partial<{ garanzia_a: string; data_scadenza: string; durata_a: string }> = {};
  if (madre.garanzia_a) patch.garanzia_a = addDaysISO(madre.garanzia_a, shiftDays);
  if (madre.data_scadenza) patch.data_scadenza = addDaysISO(madre.data_scadenza, shiftDays);
  if (madre.durata_a) patch.durata_a = addDaysISO(madre.durata_a, shiftDays);
  return patch;
}
