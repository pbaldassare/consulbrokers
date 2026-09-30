// Titolo di riferimento per un'appendice (es. regolazione RG): la polizza stessa
// (prima rata incassabile) oppure una delle quietanze successive della catena.
import { isAppendice, type TitoloLike } from "@/lib/quietanze";

export type TitoloRiferimentoRow = TitoloLike & {
  id: string;
  riga?: number | null;
  data_scadenza?: string | null;
  premio_lordo?: number | null;
  stato?: string | null;
};

export const STATI_TITOLO_RIFERIMENTO = ["attivo", "incassato", "sospeso"];

const isPolizza = (t: TitoloLike) => !t.sostituisce_polizza;

/** Polizza per prima, poi le quietanze in ordine cronologico. Esclude appendici e titoli annullati/scaduti. */
export function titoliRiferimentoAppendice<T extends TitoloRiferimentoRow>(rows: T[]): T[] {
  return rows
    .filter((t) => !isAppendice(t) && STATI_TITOLO_RIFERIMENTO.includes((t.stato || "").toLowerCase()))
    .sort((a, b) => {
      const pa = isPolizza(a) ? 0 : 1;
      const pb = isPolizza(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (a.riga != null && b.riga != null && a.riga !== b.riga) return a.riga - b.riga;
      return (a.garanzia_da || "").localeCompare(b.garanzia_da || "");
    });
}

/** Numero rata: la polizza è la rata 1, le quietanze seguono. */
export function numeroRataRiferimento(t: TitoloRiferimentoRow, index: number): number {
  if (isPolizza(t)) return 1;
  return t.riga != null && t.riga > 1 ? t.riga : index + 1;
}

export function labelTitoloRiferimento(
  t: TitoloRiferimentoRow,
  index: number,
  fmtDate: (d: string | null | undefined) => string,
  fmtEuro: (n: number | null | undefined) => string,
): string {
  const stato = (t.stato || "").toLowerCase();
  const tipo = isPolizza(t) ? "Polizza (rata 1)" : `Quietanza rata ${numeroRataRiferimento(t, index)}`;
  return `${tipo} · ${fmtDate(t.garanzia_da)} → ${fmtDate(t.garanzia_a)} · ${fmtEuro(t.premio_lordo)}${stato ? ` · ${stato}` : ""}`;
}

/**
 * Pre-selezione: la quietanza da cui si è aperto il dialog; altrimenti il
 * titolo il cui periodo di garanzia contiene `dataRiferimento` (il più
 * recente se più d'uno); altrimenti la polizza.
 */
export function pickTitoloRiferimento(
  list: TitoloRiferimentoRow[],
  opts: { currentId?: string | null; dataRiferimento?: string | null },
): string | null {
  if (list.length === 0) return null;
  const current = opts.currentId ? list.find((t) => t.id === opts.currentId) : undefined;
  if (current && !isPolizza(current)) return current.id;

  const d = (opts.dataRiferimento || "").slice(0, 10);
  if (d) {
    const inPeriodo = list
      .filter((t) => {
        const da = (t.garanzia_da || "").slice(0, 10);
        const a = (t.garanzia_a || t.data_scadenza || "").slice(0, 10);
        return !!da && da <= d && (!a || d <= a);
      })
      .sort((x, y) => (y.garanzia_da || "").localeCompare(x.garanzia_da || ""));
    if (inPeriodo[0]) return inPeriodo[0].id;
  }

  return (list.find(isPolizza) ?? list[0]).id;
}
