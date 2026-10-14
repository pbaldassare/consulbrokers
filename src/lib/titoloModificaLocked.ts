/** Testo esatto richiesto in UI (senza accento su "gia"). */
export const TITOLO_MODIFICA_LOCKED_INCASSO =
  "Non puoi effettuare modifiche se l'incasso è gia stato effettuato, annulla prima l'incasso.";

/**
 * Tooltip del pulsante Modifica quando il titolo è bloccato.
 * Incasso già effettuato: messaggio dedicato. Altri lock (storno / messa a cassa) restano descrittivi.
 */
export function titoloModificaLockedTooltip(opts: {
  isLocked: boolean;
  stato?: string | null;
  isPolizzaMadre?: boolean;
}): string | undefined {
  if (!opts.isLocked) return undefined;
  const stato = (opts.stato || "").toLowerCase();
  if (stato === "incassato") return TITOLO_MODIFICA_LOCKED_INCASSO;
  const kind = opts.isPolizzaMadre === false ? "Quietanza" : "Polizza";
  if (stato === "stornato") return `${kind} stornata: modifiche bloccate`;
  return `${kind} messa a cassa: modifiche bloccate`;
}
