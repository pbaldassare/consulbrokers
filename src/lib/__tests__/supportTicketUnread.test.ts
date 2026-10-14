import { describe, expect, it } from "vitest";
import {
  countUnreadSupportTickets,
  emptySupportTicketSeenState,
  ensureSupportTicketSeenBaseline,
  isSupportTicketUnread,
  loadSupportTicketSeenState,
  markAllSupportTicketsRead,
  markSupportTicketOpened,
  parseSupportTicketSeenState,
  saveSupportTicketSeenState,
  unreadSupportTicketIds,
} from "../supportTicketUnread";

const seen = (lastSeenAt: string | null, openedIds: string[] = []) => ({ lastSeenAt, openedIds });

describe("supportTicketUnread", () => {
  it("un ticket creato dopo lastSeenAt è nuovo", () => {
    const state = seen("2026-10-14T08:00:00.000Z");
    expect(isSupportTicketUnread({ id: "a", created_at: "2026-10-14T09:00:00.000Z" }, state)).toBe(true);
    expect(isSupportTicketUnread({ id: "b", created_at: "2026-10-14T07:00:00.000Z" }, state)).toBe(false);
    expect(isSupportTicketUnread({ id: "c", created_at: "2026-10-14T09:00:00+00:00" }, state)).toBe(true);
  });

  it("aprire un ticket toglie solo quel pallino", () => {
    const before = seen("2026-10-14T08:00:00.000Z");
    const tickets = [
      { id: "nuovo-1", created_at: "2026-10-14T09:00:00.000Z" },
      { id: "nuovo-2", created_at: "2026-10-14T10:00:00.000Z" },
    ];
    expect(countUnreadSupportTickets(tickets, before)).toBe(2);
    const afterOpen = markSupportTicketOpened(before, "nuovo-1");
    expect(unreadSupportTicketIds(tickets, afterOpen)).toEqual(["nuovo-2"]);
    expect(isSupportTicketUnread(tickets[0], afterOpen)).toBe(false);
  });

  it("uscire dalla pagina marca tutti come letti", () => {
    const tickets = [
      { id: "a", created_at: "2026-10-14T09:00:00.000Z" },
      { id: "b", created_at: "2026-10-14T10:00:00.000Z" },
    ];
    const afterLeave = markAllSupportTicketsRead("2026-10-14T11:00:00.000Z");
    expect(countUnreadSupportTickets(tickets, afterLeave)).toBe(0);
    expect(afterLeave.openedIds).toEqual([]);
  });

  it("senza visita alla tab tutti i ticket sono nuovi", () => {
    const state = parseSupportTicketSeenState(null);
    expect(state.lastSeenAt).toBeNull();
    expect(
      isSupportTicketUnread({ id: "vecchio", created_at: "2026-10-01T00:00:00.000Z" }, state),
    ).toBe(true);
    expect(
      countUnreadSupportTickets(
        [
          { id: "a", created_at: "2026-10-01T00:00:00.000Z" },
          { id: "b", created_at: "2026-10-14T12:00:00.000Z" },
        ],
        state,
      ),
    ).toBe(2);
  });

  it("la baseline non marca lo storico come letto", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    const first = ensureSupportTicketSeenBaseline("u1", storage);
    const second = ensureSupportTicketSeenBaseline("u1", storage);
    expect(first.lastSeenAt).toBeNull();
    expect(second.lastSeenAt).toBeNull();
    expect(
      isSupportTicketUnread({ id: "t1", created_at: "2026-10-14T10:00:00.000Z" }, first),
    ).toBe(true);
  });

  it("empty state ha openedIds vuoti e lastSeenAt null", () => {
    expect(emptySupportTicketSeenState()).toEqual({ lastSeenAt: null, openedIds: [] });
  });

  it("dopo markAllRead un refresh non fa tornare i ticket già visti", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    const tickets = [
      { id: "vecchio", created_at: "2026-10-01T00:00:00.000Z" },
      { id: "visto", created_at: "2026-10-14T10:00:00.000Z" },
    ];

    const baseline = ensureSupportTicketSeenBaseline("u1", storage);
    expect(baseline.lastSeenAt).toBeNull();
    expect(countUnreadSupportTickets(tickets, baseline)).toBe(2);

    // mount pagina Ticket Supporto: persiste lastSeenAt subito
    saveSupportTicketSeenState("u1", markAllSupportTicketsRead("2026-10-14T11:00:00.000Z"), storage);

    // refresh / F5 = ricarica lo stato persistito, non la baseline vuota
    const afterRefresh = loadSupportTicketSeenState("u1", storage);
    expect(afterRefresh.lastSeenAt).toBe("2026-10-14T11:00:00.000Z");
    expect(countUnreadSupportTickets(tickets, afterRefresh)).toBe(0);
    expect(
      isSupportTicketUnread({ id: "nuovo", created_at: "2026-10-14T12:00:00.000Z" }, afterRefresh),
    ).toBe(true);
  });

  it("il caricamento non azzera un lastSeenAt già persistito", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    saveSupportTicketSeenState("u1", markAllSupportTicketsRead("2026-10-14T11:00:00.000Z"), storage);
    const reloaded = ensureSupportTicketSeenBaseline("u1", storage);
    expect(reloaded.lastSeenAt).toBe("2026-10-14T11:00:00.000Z");
    expect(
      countUnreadSupportTickets(
        [{ id: "vecchio", created_at: "2026-10-14T10:00:00.000Z" }],
        reloaded,
      ),
    ).toBe(0);
  });
});
