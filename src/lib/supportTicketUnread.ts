/** Stato letture Ticket Supporto. Fonte di verità: tabella `support_ticket_letture`.
 *  localStorage è solo cache ottimistica: F5 / hard reload / altro browser leggono il DB. */

export const SUPPORT_TICKET_UNREAD_STORAGE_PREFIX = "cbnet_support_tickets_seen_v2:";
export const SUPPORT_TICKET_UNREAD_QUERY_KEY = "support-ticket-unread";

export type SupportTicketSeenState = {
  /**
   * ISO dell'ultima apertura (o uscita) dalla tab Ticket Supporto.
   * `null` = la tab non è mai stata aperta: tutti i ticket contano come nuovi.
   * Si persiste sul DB al mount della pagina, non solo in uscita.
   */
  lastSeenAt: string | null;
  openedIds: string[];
};

export type SupportTicketLettureRow = {
  visto_il?: string | null;
  aperti_ids?: unknown;
};

export type SupportTicketUnreadRow = {
  id: string;
  created_at?: string | null;
  data_apertura?: string | null;
};

export function supportTicketSeenStorageKey(userId: string): string {
  return `${SUPPORT_TICKET_UNREAD_STORAGE_PREFIX}${userId}`;
}

export function emptySupportTicketSeenState(): SupportTicketSeenState {
  return { lastSeenAt: null, openedIds: [] };
}

function normalizeOpenedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.length > 0);
}

function laterIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  const am = Date.parse(a);
  const bm = Date.parse(b);
  if (!Number.isFinite(am)) return b;
  if (!Number.isFinite(bm)) return a;
  return bm > am ? b : a;
}

export function parseSupportTicketSeenState(raw: string | null): SupportTicketSeenState {
  if (!raw) return emptySupportTicketSeenState();
  try {
    const parsed = JSON.parse(raw) as Partial<SupportTicketSeenState>;
    const lastSeenAt = typeof parsed.lastSeenAt === "string" && parsed.lastSeenAt ? parsed.lastSeenAt : null;
    return { lastSeenAt, openedIds: normalizeOpenedIds(parsed.openedIds) };
  } catch {
    return emptySupportTicketSeenState();
  }
}

export function seenStateFromDbRow(row: SupportTicketLettureRow | null | undefined): SupportTicketSeenState {
  if (!row) return emptySupportTicketSeenState();
  const lastSeenAt = typeof row.visto_il === "string" && row.visto_il ? row.visto_il : null;
  return { lastSeenAt, openedIds: normalizeOpenedIds(row.aperti_ids) };
}

/** Unisce cache locale e riga DB: lastSeenAt più recente + union openedIds. */
export function mergeSupportTicketSeenState(
  a: SupportTicketSeenState,
  b: SupportTicketSeenState,
): SupportTicketSeenState {
  return {
    lastSeenAt: laterIso(a.lastSeenAt, b.lastSeenAt),
    openedIds: [...new Set([...a.openedIds, ...b.openedIds])],
  };
}

export function isSeenStateAhead(candidate: SupportTicketSeenState, baseline: SupportTicketSeenState): boolean {
  const mergedLast = laterIso(candidate.lastSeenAt, baseline.lastSeenAt);
  if (candidate.lastSeenAt && mergedLast === candidate.lastSeenAt && candidate.lastSeenAt !== baseline.lastSeenAt) {
    return true;
  }
  return candidate.openedIds.some((id) => !baseline.openedIds.includes(id));
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

/** Non marca i ticket come letti: senza visita alla tab `lastSeenAt` resta null. */
export function ensureSupportTicketSeenBaseline(
  userId: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): SupportTicketSeenState {
  const key = supportTicketSeenStorageKey(userId);
  const existing = storage.getItem(key);
  if (existing) return parseSupportTicketSeenState(existing);
  const baseline = emptySupportTicketSeenState();
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
  if (!Number.isFinite(created)) return false;
  if (!state.lastSeenAt) return true;
  const seen = toMs(state.lastSeenAt);
  if (!Number.isFinite(seen)) return true;
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

/** Persiste la visita: lastSeenAt=now. Usato al mount della pagina e in uscita. */
export function markAllSupportTicketsRead(
  now = new Date().toISOString(),
): SupportTicketSeenState {
  return { lastSeenAt: now, openedIds: [] };
}
