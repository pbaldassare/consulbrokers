/** Stato locale: ticket nuovi dall'ultima visita alla pagina Ticket Supporto. */

export const SUPPORT_TICKET_UNREAD_STORAGE_PREFIX = "cbnet_support_tickets_seen_v1:";
export const SUPPORT_TICKET_UNREAD_QUERY_KEY = "support-ticket-unread";

export type SupportTicketSeenState = {
  /** ISO: ticket con created_at successivo sono nuovi, salvo openedIds. */
  lastSeenAt: string;
  openedIds: string[];
};

export type SupportTicketUnreadRow = {
  id: string;
  created_at?: string | null;
  data_apertura?: string | null;
};

export function supportTicketSeenStorageKey(userId: string): string {
  return `${SUPPORT_TICKET_UNREAD_STORAGE_PREFIX}${userId}`;
}

export function emptySupportTicketSeenState(now = new Date().toISOString()): SupportTicketSeenState {
  return { lastSeenAt: now, openedIds: [] };
}

export function parseSupportTicketSeenState(raw: string | null, now = new Date().toISOString()): SupportTicketSeenState {
  if (!raw) return emptySupportTicketSeenState(now);
  try {
    const parsed = JSON.parse(raw) as Partial<SupportTicketSeenState>;
    const lastSeenAt = typeof parsed.lastSeenAt === "string" && parsed.lastSeenAt ? parsed.lastSeenAt : now;
    const openedIds = Array.isArray(parsed.openedIds)
      ? parsed.openedIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    return { lastSeenAt, openedIds };
  } catch {
    return emptySupportTicketSeenState(now);
  }
}

export function loadSupportTicketSeenState(userId: string, storage: Pick<Storage, "getItem"> = localStorage): SupportTicketSeenState {
  return parseSupportTicketSeenState(storage.getItem(supportTicketSeenStorageKey(userId)));
}

export function saveSupportTicketSeenState(
  userId: string,
  state: SupportTicketSeenState,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(supportTicketSeenStorageKey(userId), JSON.stringify(state));
}

export function ensureSupportTicketSeenBaseline(
  userId: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  now = new Date().toISOString(),
): SupportTicketSeenState {
  const key = supportTicketSeenStorageKey(userId);
  const existing = storage.getItem(key);
  if (existing) return parseSupportTicketSeenState(existing, now);
  const baseline = emptySupportTicketSeenState(now);
  storage.setItem(key, JSON.stringify(baseline));
  return baseline;
}

function ticketCreatedAt(ticket: SupportTicketUnreadRow): string {
  return ticket.created_at || ticket.data_apertura || "";
}

function toMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

export function isSupportTicketUnread(ticket: SupportTicketUnreadRow, state: SupportTicketSeenState): boolean {
  if (!ticket.id || state.openedIds.includes(ticket.id)) return false;
  const created = toMs(ticketCreatedAt(ticket));
  const seen = toMs(state.lastSeenAt);
  if (!Number.isFinite(created) || !Number.isFinite(seen)) return false;
  return created > seen;
}

export function unreadSupportTicketIds(
  tickets: SupportTicketUnreadRow[],
  state: SupportTicketSeenState,
): string[] {
  return tickets.filter((t) => isSupportTicketUnread(t, state)).map((t) => t.id);
}

export function countUnreadSupportTickets(
  tickets: SupportTicketUnreadRow[],
  state: SupportTicketSeenState,
): number {
  return unreadSupportTicketIds(tickets, state).length;
}

export function markSupportTicketOpened(state: SupportTicketSeenState, ticketId: string): SupportTicketSeenState {
  if (!ticketId || state.openedIds.includes(ticketId)) return state;
  return { ...state, openedIds: [...state.openedIds, ticketId] };
}

export function markAllSupportTicketsRead(
  now = new Date().toISOString(),
): SupportTicketSeenState {
  return { lastSeenAt: now, openedIds: [] };
}
