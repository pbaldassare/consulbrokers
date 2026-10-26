import { isDocumentUploadTooLarge } from "@/lib/uploadLimits";

export type SupportTicketStatus = "aperto" | "preso_in_carico" | "risolto";

export type SupportTicketTipologia = "richiesta_implementazione" | "bug";

/** Sotto-stato interno admin quando stato = preso_in_carico. */
export type SupportTicketPresoInCaricoFase = "in_attesa_risposta" | "in_elaborazione";

export const SUPPORT_TICKET_PRESO_IN_CARICO_FASI: {
  value: SupportTicketPresoInCaricoFase;
  label: string;
}[] = [
  { value: "in_attesa_risposta", label: "IN ATTESA DI RISPOSTA" },
  { value: "in_elaborazione", label: "IN ELABORAZIONE" },
];

export const SUPPORT_TICKET_PRESO_IN_CARICO_FASE_LABEL: Record<
  SupportTicketPresoInCaricoFase,
  string
> = {
  in_attesa_risposta: "IN ATTESA DI RISPOSTA",
  in_elaborazione: "IN ELABORAZIONE",
};

export const SUPPORT_TICKET_TIPOLOGIE: { value: SupportTicketTipologia; label: string }[] = [
  { value: "richiesta_implementazione", label: "RICHIESTA IMPLEMENTAZIONE" },
  { value: "bug", label: "BUG" },
];

export const SUPPORT_TICKET_TIPOLOGIA_LABEL: Record<SupportTicketTipologia, string> = {
  richiesta_implementazione: "RICHIESTA IMPLEMENTAZIONE",
  bug: "BUG",
};

/** Ordine fisso dei gruppi in elenco ticket. */
export const SUPPORT_TICKET_TIPOLOGIA_ORDER: SupportTicketTipologia[] = [
  "richiesta_implementazione",
  "bug",
];

export function groupSupportTicketsByTipologia<T extends { tipologia_problema?: SupportTicketTipologia | null }>(
  tickets: T[],
): { tipologia: SupportTicketTipologia; label: string; tickets: T[] }[] {
  return SUPPORT_TICKET_TIPOLOGIA_ORDER.map((tipologia) => ({
    tipologia,
    label: SUPPORT_TICKET_TIPOLOGIA_LABEL[tipologia],
    tickets: sortSupportTicketsByDateDesc(
      tickets.filter((t) => (t.tipologia_problema ?? "bug") === tipologia),
    ),
  })).filter((g) => g.tickets.length > 0);
}

type SupportTicketSortable = {
  updated_at?: string | null;
  data_apertura?: string | null;
  created_at?: string | null;
  numero?: number | null;
};

function supportTicketSortTimestamp(t: SupportTicketSortable): number {
  const raw = t.updated_at || t.data_apertura || t.created_at || "";
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Elenco ticket: più recenti in alto (aggiornamento, poi apertura). */
export function sortSupportTicketsByDateDesc<T extends SupportTicketSortable>(tickets: T[]): T[] {
  return [...tickets].sort((a, b) => {
    const diff = supportTicketSortTimestamp(b) - supportTicketSortTimestamp(a);
    if (diff !== 0) return diff;
    return (b.numero ?? 0) - (a.numero ?? 0);
  });
}

export const SUPPORT_TICKET_STATUS: Array<{
  value: SupportTicketStatus;
  label: string;
}> = [
  { value: "aperto", label: "Aperto" },
  { value: "preso_in_carico", label: "Preso in carico" },
  { value: "risolto", label: "Risolto" },
];

export const SUPPORT_TICKET_STATUS_LABEL: Record<SupportTicketStatus, string> = {
  aperto: "Aperto",
  preso_in_carico: "Preso in carico",
  risolto: "Risolto",
};

/** Unico account autorizzato a eliminare ticket (solo per ticket inutili/di prova). */
export const SUPPORT_TICKET_DELETE_EMAIL = "admin@consul.it";

export function canDeleteSupportTicket(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === SUPPORT_TICKET_DELETE_EMAIL;
}

export function formatSupportTicketNumber(numero: number | string): string {
  return `TCK-${String(numero).padStart(6, "0")}`;
}

export function isOpenSupportTicket(status: SupportTicketStatus): boolean {
  return status !== "risolto";
}

export function isSupportTicketClosed(status: SupportTicketStatus): boolean {
  return status === "risolto";
}

/** Dopo il salvataggio del supporto l'utente può rispondere; dopo la sua risposta si blocca. */
export function canUserReplyToSupportTicket(opts: {
  stato: SupportTicketStatus;
  utentePuoRispondere?: boolean | null;
  richiedenteId: string;
  userId?: string | null;
  isAdmin: boolean;
}): boolean {
  if (opts.isAdmin) return false;
  if (!opts.userId || opts.userId !== opts.richiedenteId) return false;
  if (isSupportTicketClosed(opts.stato)) return false;
  return opts.utentePuoRispondere === true;
}

export function supportTicketUserLockedMessage(status: SupportTicketStatus): string {
  if (isSupportTicketClosed(status)) {
    return "Ticket risolto. Non puoi più modificarlo. Per una nuova esigenza apri un nuovo ticket.";
  }
  return "In attesa di una risposta del supporto. Potrai rispondere e allegare di nuovo quando il supporto ti risponderà.";
}

export function validateSupportTicketReply(text: string): string | null {
  const value = text.trim();
  if (value.length < 1) {
    return "Scrivi una risposta.";
  }
  if (value.length > 5_000) {
    return "La risposta non può superare 5.000 caratteri.";
  }
  return null;
}

export function validateSupportTicketDescription(description: string): string | null {
  const value = description.trim();
  if (value.length < 20) {
    return "Descrivi il problema o l'esigenza con almeno 20 caratteri.";
  }
  if (value.length > 10_000) {
    return "La descrizione non può superare 10.000 caratteri.";
  }
  return null;
}

export function escapeSupportTicketHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Accoda gli allegati validi e segnala quelli oltre il limite documenti. */
export function mergeSupportTicketAttachmentFiles(
  current: File[],
  incoming: File[],
): { files: File[]; rejected: File[] } {
  const rejected: File[] = [];
  const accepted: File[] = [];
  for (const file of incoming) {
    if (isDocumentUploadTooLarge(file.size)) {
      rejected.push(file);
    } else {
      accepted.push(file);
    }
  }
  return { files: [...current, ...accepted], rejected };
}
