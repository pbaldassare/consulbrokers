/**
 * Logica coassicurazione: riparto premio/provvigioni tra più compagnie.
 */

export interface RipartoCoassicurazioneRow {
  /** Chiave locale React (non persistita) */
  localId: string;
  gruppoCompagniaId: string;
  compagniaId: string;
  rapportoId: string;
  quotaPercentuale: string;
}

export interface RipartoImportiTotals {
  netto: number;
  addizionali: number;
  tasse: number;
  lordo: number;
}

export interface RipartoProvvInfo {
  totale: number;
  provvNetto: number;
  provvAddizionali: number;
  percProvvNetto: number;
  percProvvAddizionali: number;
}

export interface RipartoImportiCalcolati {
  netto: number;
  addizionali: number;
  tasse: number;
  totale: number;
  provv_netto: number;
  provv_addizionali: number;
}

let ripartoIdCounter = 0;

export function newRipartoLocalId(): string {
  ripartoIdCounter += 1;
  return `riparto-${Date.now()}-${ripartoIdCounter}`;
}

export function emptyRipartoRow(overrides?: Partial<RipartoCoassicurazioneRow>): RipartoCoassicurazioneRow {
  return {
    localId: newRipartoLocalId(),
    gruppoCompagniaId: "",
    compagniaId: "",
    rapportoId: "",
    quotaPercentuale: "",
    ...overrides,
  };
}

export function parseQuotaPercentuale(raw: string): number {
  const n = parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function validateRipartoSum(rows: RipartoCoassicurazioneRow[]): {
  valid: boolean;
  sum: number;
  message?: string;
} {
  const sum = rows.reduce((s, r) => s + parseQuotaPercentuale(r.quotaPercentuale), 0);
  const rounded = Math.round(sum * 100) / 100;
  if (rows.length === 0) {
    return { valid: false, sum: 0, message: "Aggiungi almeno una riga di coassicurazione" };
  }
  if (Math.abs(rounded - 100) > 0.01) {
    return {
      valid: false,
      sum: rounded,
      message: `La somma delle quote deve essere 100% (attuale: ${rounded.toFixed(2)}%)`,
    };
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.gruppoCompagniaId) {
      return { valid: false, sum: rounded, message: `Riga ${i + 1}: seleziona la Compagnia Assicurativa` };
    }
    if (!row.compagniaId) {
      return { valid: false, sum: rounded, message: `Riga ${i + 1}: seleziona l'Agenzia` };
    }
    const q = parseQuotaPercentuale(row.quotaPercentuale);
    if (q <= 0) {
      return { valid: false, sum: rounded, message: `Riga ${i + 1}: quota % obbligatoria` };
    }
  }
  return { valid: true, sum: rounded };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Ripartisce importi totali in base alle quote % (ultima riga assorbe arrotondamenti). */
export function calcRipartoImporti(
  totals: RipartoImportiTotals,
  rows: Pick<RipartoCoassicurazioneRow, "quotaPercentuale">[],
  provv?: RipartoProvvInfo,
): RipartoImportiCalcolati[] {
  const n = rows.length;
  if (n === 0) return [];

  const acc = { netto: 0, addizionali: 0, tasse: 0, totale: 0, provv_netto: 0, provv_addizionali: 0 };
  const out: RipartoImportiCalcolati[] = [];

  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const q = parseQuotaPercentuale(rows[i].quotaPercentuale) / 100;

    const netto = isLast ? round2(totals.netto - acc.netto) : round2(totals.netto * q);
    const addizionali = isLast ? round2(totals.addizionali - acc.addizionali) : round2(totals.addizionali * q);
    const tasse = isLast ? round2(totals.tasse - acc.tasse) : round2(totals.tasse * q);
    const totale = isLast ? round2(totals.lordo - acc.totale) : round2(totals.lordo * q);
    const provv_netto = provv
      ? (isLast ? round2(provv.provvNetto - acc.provv_netto) : round2(provv.provvNetto * q))
      : 0;
    const provv_addizionali = provv
      ? (isLast ? round2(provv.provvAddizionali - acc.provv_addizionali) : round2(provv.provvAddizionali * q))
      : 0;

    acc.netto += netto;
    acc.addizionali += addizionali;
    acc.tasse += tasse;
    acc.totale += totale;
    acc.provv_netto += provv_netto;
    acc.provv_addizionali += provv_addizionali;

    out.push({ netto, addizionali, tasse, totale, provv_netto, provv_addizionali });
  }

  return out;
}

export function buildDettaglioRipartoInsert(
  titoloId: string,
  rows: RipartoCoassicurazioneRow[],
  totals: RipartoImportiTotals,
  provv?: RipartoProvvInfo,
  tipoPagamento = "C",
) {
  const importi = calcRipartoImporti(totals, rows, provv);
  return rows.map((row, idx) => {
    const imp = importi[idx];
    return {
      titolo_id: titoloId,
      compagnia_id: row.compagniaId || null,
      gruppo_compagnia_id: row.gruppoCompagniaId || null,
      compagnia_rapporto_id: row.rapportoId || null,
      quota_percentuale: parseQuotaPercentuale(row.quotaPercentuale),
      perc_provv_netto: provv?.percProvvNetto ?? 0,
      perc_provv_addizionali: provv?.percProvvAddizionali ?? 0,
      netto: imp.netto,
      addizionali: imp.addizionali,
      tasse: imp.tasse,
      totale: imp.totale,
      provv_netto: imp.provv_netto,
      provv_addizionali: imp.provv_addizionali,
      tipo_pagamento: tipoPagamento,
    };
  });
}

/** Singola riga 100% (polizza non coassicurata). */
export function buildDettaglioRipartoSingolo(
  titoloId: string,
  compagniaId: string,
  totals: RipartoImportiTotals,
  provv?: RipartoProvvInfo,
  extras?: { gruppoCompagniaId?: string | null; compagniaRapportoId?: string | null },
) {
  return buildDettaglioRipartoInsert(
    titoloId,
    [{
      localId: "single",
      gruppoCompagniaId: extras?.gruppoCompagniaId || "",
      compagniaId,
      rapportoId: extras?.compagniaRapportoId || "",
      quotaPercentuale: "100",
    }],
    totals,
    provv,
  );
}
