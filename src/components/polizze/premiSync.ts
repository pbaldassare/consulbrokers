import type { GaranziaRow } from "./PremiGaranziaCardShell";

/**
 * Logica pura di sincronizzazione Firma → Quietanza per la sezione
 * "Premi per Garanzia".
 *
 * Modello: la Quietanza è inizialmente uno specchio della Firma. Quando l'utente
 * modifica manualmente una riga della Quietanza, quella riga diventa
 * "personalizzata" (`quietanzaPersonalizzata = true`) e smette di ricevere gli
 * aggiornamenti automatici dalla Firma. Le righe non personalizzate continuano a
 * rispecchiare la Firma in tempo reale.
 *
 * La granularità è per riga, coerente con la colonna DB
 * `premi_garanzia_polizza.quietanza_personalizzata` e con `VociRcaCard`.
 */

/** Campi di contenuto rilevanti per stabilire se due righe sono "uguali". */
export function sameRowContent(a?: GaranziaRow, b?: GaranziaRow): boolean {
  if (!a || !b) return false;
  return (
    (a.codice || "") === (b.codice || "") &&
    (a.descrizione || "") === (b.descrizione || "") &&
    (a.sottoramoId || "") === (b.sottoramoId || "") &&
    (a.netto || "") === (b.netto || "") &&
    (a.accessori || "") === (b.accessori || "") &&
    (a.tasse || "") === (b.tasse || "") &&
    (a.tasseRettifica || "") === (b.tasseRettifica || "") &&
    (a.ssn || "") === (b.ssn || "") &&
    (a.aliquotaTasse || 0) === (b.aliquotaTasse || 0) &&
    (a.provvNettoPctOverride || false) === (b.provvNettoPctOverride || false) &&
    (a.provvAccessoriPctOverride || false) === (b.provvAccessoriPctOverride || false) &&
    (a.provvNettoPct ?? null) === (b.provvNettoPct ?? null) &&
    (a.provvAccessoriPct ?? null) === (b.provvAccessoriPct ?? null)
  );
}

/** True se le righe non hanno importi significativi. */
export function rowsAreEmpty(rows: GaranziaRow[]): boolean {
  return !rows.some(
    (r) =>
      parseFloat(r.netto || "0") > 0 ||
      parseFloat(r.accessori || "0") > 0 ||
      parseFloat(r.tasse || "0") > 0 ||
      parseFloat(r.tasseRettifica || "0") > 0 ||
      parseFloat(r.ssn || "0") > 0 ||
      (r.dirittiAgenzia && parseFloat(r.tasse || "0") > 0),
  );
}

/** Clona una riga Firma in una riga Quietanza-specchio (non personalizzata). */
function mirrorRow(firmaRow: GaranziaRow): GaranziaRow {
  // Preserva anche tasseRettifica/tasseManualOverride: altrimenti il salvataggio
  // quietanza (dopo firma) ricalcola premio_lordo senza la rettifica manuale.
  return { ...firmaRow, quietanzaPersonalizzata: false };
}

/**
 * Ricalcola le righe Quietanza a partire dalle righe Firma, preservando le
 * righe personalizzate.
 *
 * - Per ogni indice di Firma: se la corrispondente riga Quietanza è
 *   personalizzata viene mantenuta com'è, altrimenti rispecchia la Firma.
 * - Le righe Quietanza personalizzate oltre la lunghezza della Firma vengono
 *   conservate; quelle non personalizzate in eccesso vengono scartate.
 */
export function syncQuietanzaFromFirma(
  firma: GaranziaRow[],
  quietanza: GaranziaRow[],
): GaranziaRow[] {
  const next: GaranziaRow[] = firma.map((fr, i) => {
    const q = quietanza[i];
    if (q?.quietanzaPersonalizzata) return q;
    return mirrorRow(fr);
  });

  for (let i = firma.length; i < quietanza.length; i++) {
    if (quietanza[i]?.quietanzaPersonalizzata) next.push(quietanza[i]);
  }

  return next;
}

/**
 * Marca come personalizzate le righe Quietanza che l'utente ha modificato a mano.
 *
 * Confronta lo stato precedente con quello successivo:
 * - stessa lunghezza (edit di un campo): le righe il cui contenuto è cambiato
 *   diventano personalizzate;
 * - lunghezza diversa (aggiunta/rimozione riga): si preservano i flag esistenti e
 *   le righe nuove (flag non definito) diventano personalizzate.
 */
export function markQuietanzaEdits(
  prev: GaranziaRow[],
  next: GaranziaRow[],
): GaranziaRow[] {
  if (next.length === prev.length) {
    return next.map((r, i) =>
      sameRowContent(prev[i], r) ? r : { ...r, quietanzaPersonalizzata: true },
    );
  }
  return next.map((r) =>
    r.quietanzaPersonalizzata == null ? { ...r, quietanzaPersonalizzata: true } : r,
  );
}

/** Specchio completo della Firma: azzera ogni personalizzazione. */
export function mirrorAllFromFirma(firma: GaranziaRow[]): GaranziaRow[] {
  return firma.map(mirrorRow);
}

/** Riallinea una singola riga Quietanza alla Firma corrispondente (toglie il flag). */
export function resetQuietanzaRow(
  firma: GaranziaRow[],
  quietanza: GaranziaRow[],
  idx: number,
): GaranziaRow[] {
  const firmaRow = firma[idx];
  if (!firmaRow) {
    // Nessuna riga Firma corrispondente: la riga torna comunque non personalizzata
    return quietanza.map((r, i) => (i === idx ? { ...r, quietanzaPersonalizzata: false } : r));
  }
  return quietanza.map((r, i) => (i === idx ? mirrorRow(firmaRow) : r));
}

/** True se la Quietanza è un puro specchio della Firma (nessuna riga personalizzata). */
export function isQuietanzaSincronizzata(quietanza: GaranziaRow[] | null | undefined): boolean {
  return Array.isArray(quietanza) && quietanza.length > 0 && quietanza.every((r) => !r?.quietanzaPersonalizzata);
}

/** True se al salvataggio la Quietanza va allineata alla Firma (vuota o senza personalizzazioni). */
export function shouldAutoMirrorQuietanza(quietanza: GaranziaRow[] | null | undefined): boolean {
  if (!Array.isArray(quietanza) || quietanza.length === 0) return true;
  return quietanza.every((r) => !r?.quietanzaPersonalizzata);
}

/**
 * Stesso criterio dei premi: se la Quietanza è specchio della Firma,
 * anche il blocco provvigioni (totale €, % medie, riparto) segue la Firma.
 * `provvPersonalizzata` = l'utente ha toccato il blocco Quietanza a mano.
 */
export function shouldMirrorProvvigioni(
  quietanza: GaranziaRow[] | null | undefined,
  provvPersonalizzata = false,
): boolean {
  return !provvPersonalizzata && shouldAutoMirrorQuietanza(quietanza);
}

export type ProvvigioniBlocco = {
  importo: number;
  pctDisplay: string;
};

/** Se specchio: usa Firma. Se personalizzata: tiene il calcolo Quietanza. */
export function resolveProvvigioniQuietanza(
  quietanza: GaranziaRow[] | null | undefined,
  firma: ProvvigioniBlocco,
  quietanzaCalcolata: ProvvigioniBlocco,
  provvPersonalizzata = false,
): ProvvigioniBlocco {
  return shouldMirrorProvvigioni(quietanza, provvPersonalizzata) ? firma : quietanzaCalcolata;
}

export type ProvvManualState = {
  auto: boolean;
  importo: number | null;
  fromEuro: boolean;
  pct: string;
};

/** Copia lo stato manuale/auto del blocco provvigioni Firma → Quietanza. */
export function mirrorProvvManualState(firma: ProvvManualState): ProvvManualState {
  return {
    auto: firma.auto,
    importo: firma.importo,
    fromEuro: firma.fromEuro,
    pct: firma.pct,
  };
}
