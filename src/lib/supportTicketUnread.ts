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
  /** Quando il ticket è stato aperto: una risposta successiva rimostra il pallino. */
  openedAt: Record<string, string>;
};

export type SupportTicketLettureRow = {
  visto_il?: string | null;
  aperti_ids?: unknown;
};

export type SupportTicketUnreadRow = {
  id: string;
  created_at?: string | null;
  data_apertura?: string | null;
  updated_at?: string | null;
  aggiornato_da?: string | null;
  richiedente_id?: string | null;
  ultimo_autore_id?: string | null;
};

export function supportTicketSeenStorageKey(userId: string): string {
  return `${SUPPORT_TICKET_UNREAD_STORAGE_PREFIX}${userId}`;
}

export function emptySupportTicketSeenState(): SupportTicketSeenState {
  return { lastSeenAt: null, openedIds: [], openedAt: {} };
}

function normalizeOpenedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.length > 0);
}

function normalizeOpenedAt(value: unknown, fallbackIds: string[], fallbackAt: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [id, iso] of Object.entries(value as Record<string, unknown>)) {
      if (id && typeof iso === "string" && iso) out[id] = iso;
    }
  }
  if (fallbackAt) {
    for (const id of fallbackIds) {
      if (!out[id]) out[id] = fallbackAt;
    }
  }
  return out;
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
    const openedIds = normalizeOpenedIds(parsed.openedIds);
    const openedAt = normalizeOpenedAt(parsed.openedAt, openedIds, lastSeenAt);
    const ids = [...new Set([...openedIds, ...Object.keys(openedAt)])];
    return { lastSeenAt, openedIds: ids, openedAt };
  } catch {
    return emptySupportTicketSeenState();
  }
}

export function seenStateFromDbRow(row: SupportTicketLettureRow | null | undefined): SupportTicketSeenState {
  if (!row) return emptySupportTicketSeenState();
  const lastSeenAt = typeof row.visto_il === "string" && row.visto_il ? row.visto_il : null;
  const openedIds = normalizeOpenedIds(row.aperti_ids);
  return { lastSeenAt, openedIds, openedAt: normalizeOpenedAt(null, openedIds, lastSeenAt) };
}

/** Unisce cache locale e riga DB: lastSeenAt più recente + union openedIds. */
export function mergeSupportTicketSeenState(
  a: SupportTicketSeenState,
  b: SupportTicketSeenState,
): SupportTicketSeenState {
  const openedAt: Record<string, string> = { ...a.openedAt };
  for (const [id, iso] of Object.entries(b.openedAt || {})) {
    openedAt[id] = laterIso(openedAt[id] ?? null, iso) || iso;
  }
  const openedIds = [...new Set([...a.openedIds, ...b.openedIds, ...Object.keys(openedAt)])];
  return {
    lastSeenAt: laterIso(a.lastSeenAt, b.lastSeenAt),
    openedIds,
    openedAt,
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

function ticketActivityAt(ticket: SupportTicketUnreadRow): string {
  return ticket.updated_at || ticket.created_at || ticket.data_apertura || "";
}

function toMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
}

function lastActivityAuthorId(ticket: SupportTicketUnreadRow): string | null {
  return ticket.aggiornato_da || ticket.ultimo_autore_id || null;
}

/** Cutoff = il più recente tra visita globale e apertura di quella riga. */
function cutoffForTicket(ticketId: string, state: SupportTicketSeenState): string | null {
  return laterIso(state.openedAt?.[ticketId] ?? null, state.lastSeenAt);
}

export function isSupportTicketUnread(
  ticket: SupportTicketUnreadRow,
  state: SupportTicketSeenState,
  currentUserId?: string | null,
): boolean {
  if (!ticket.id) return false;
  const authorId = lastActivityAuthorId(ticket);
  if (currentUserId && authorId && authorId === currentUserId) return false;
  if (currentUserId && !authorId && ticket.richiedente_id === currentUserId) return false;
  const activity = toMs(ticketActivityAt(ticket));
  if (!Number.isFinite(activity)) return false;
  const cutoffIso = cutoffForTicket(ticket.id, state);
  if (!cutoffIso) return true;
  const cutoff = toMs(cutoffIso);
  if (!Number.isFinite(cutoff)) return true;
  return activity > cutoff;
}

export function unreadSupportTicketIds(
  tickets: SupportTicketUnreadRow[],
  state: SupportTicketSeenState,
  currentUserId?: string | null,
): string[] {
  return tickets.filter((t) => isSupportTicketUnread(t, state, currentUserId)).map((t) => t.id);
}

export function countUnreadSupportTickets(
  tickets: SupportTicketUnreadRow[],
  state: SupportTicketSeenState,
  currentUserId?: string | null,
): number {
  return unreadSupportTicketIds(tickets, state, currentUserId).length;
}

export function markSupportTicketOpened(
  state: SupportTicketSeenState,
  ticketId: string,
  now = new Date().toISOString(),
): SupportTicketSeenState {
  if (!ticketId) return state;
  if (state.openedAt?.[ticketId] === now) return state;
  return {
    ...state,
    openedIds: state.openedIds.includes(ticketId) ? state.openedIds : [...state.openedIds, ticketId],
    openedAt: { ...state.openedAt, [ticketId]: now },
  };
}

/** Persiste la visita: lastSeenAt=now. Usato al mount della pagina e in uscita. */
export function markAllSupportTicketsRead(
  now = new Date().toISOString(),
): SupportTicketSeenState {
  return { lastSeenAt: now, openedIds: [], openedAt: {} };
}
