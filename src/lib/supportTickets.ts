export type SupportTicketStatus = "aperto" | "preso_in_carico" | "risolto";

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

export function formatSupportTicketNumber(numero: number | string): string {
  return `TCK-${String(numero).padStart(6, "0")}`;
}

export function isOpenSupportTicket(status: SupportTicketStatus): boolean {
  return status !== "risolto";
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
