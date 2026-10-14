import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  SUPPORT_TICKET_UNREAD_QUERY_KEY,
  emptySupportTicketSeenState,
  isSeenStateAhead,
  loadSupportTicketSeenState,
  markAllSupportTicketsRead,
  markSupportTicketOpened,
  mergeSupportTicketSeenState,
  saveSupportTicketSeenState,
  seenStateFromDbRow,
  unreadSupportTicketIds,
  type SupportTicketSeenState,
  type SupportTicketUnreadRow,
} from "@/lib/supportTicketUnread";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type UnreadQueryData = {
  tickets: SupportTicketUnreadRow[];
  unreadIds: string[];
  unreadCount: number;
};

function readLocalSeenState(userId: string): SupportTicketSeenState {
  try {
    return loadSupportTicketSeenState(userId);
  } catch {
    return emptySupportTicketSeenState();
  }
}

async function loadSeenStateFromDb(userId: string): Promise<SupportTicketSeenState> {
  const { data: row, error } = await db
    .from("support_ticket_letture")
    .select("visto_il, aperti_ids")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return seenStateFromDbRow(row);
}

async function persistSeenState(
  userId: string,
  state: SupportTicketSeenState,
  mode: "merge" | "replace" = "merge",
): Promise<SupportTicketSeenState> {
  let dbState = emptySupportTicketSeenState();
  try {
    dbState = await loadSeenStateFromDb(userId);
  } catch {
    /* se il SELECT fallisce, scriviamo comunque lo stato nuovo */
  }
  const next = mode === "replace" ? state : mergeSupportTicketSeenState(dbState, state);
  try {
    saveSupportTicketSeenState(userId, next);
  } catch {
    /* cache locale opzionale */
  }
  const { error } = await db.from("support_ticket_letture").upsert(
    {
      user_id: userId,
      visto_il: next.lastSeenAt,
      aperti_ids: next.openedIds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  return next;
}

export function useSupportTicketUnread() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  const { data } = useQuery({
    queryKey: [SUPPORT_TICKET_UNREAD_QUERY_KEY, userId],
    enabled: !!userId,
    queryFn: async (): Promise<UnreadQueryData> => {
      if (!userId) return { tickets: [], unreadIds: [], unreadCount: 0 };
      const dbState = await loadSeenStateFromDb(userId);
      const localState = readLocalSeenState(userId);
      const state = mergeSupportTicketSeenState(dbState, localState);
      if (isSeenStateAhead(localState, dbState)) {
        try {
          await persistSeenState(userId, state);
        } catch (err) {
          console.error("[useSupportTicketUnread] sync locale→db", err);
        }
      } else {
        try {
          saveSupportTicketSeenState(userId, state);
        } catch {
          /* ignore */
        }
      }
      const { data: rows, error } = await db
        .from("support_tickets")
        .select("id, created_at, data_apertura, updated_at, aggiornato_da, richiedente_id");
      if (error) throw error;
      const tickets = (rows || []) as SupportTicketUnreadRow[];
      const unreadIds = unreadSupportTicketIds(tickets, state, userId);
      return { tickets, unreadIds, unreadCount: unreadIds.length };
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`support_tickets_unread_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_tickets" },
        () => {
          qc.invalidateQueries({ queryKey: [SUPPORT_TICKET_UNREAD_QUERY_KEY, userId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets" },
        () => {
          qc.invalidateQueries({ queryKey: [SUPPORT_TICKET_UNREAD_QUERY_KEY, userId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_ticket_eventi" },
        () => {
          qc.invalidateQueries({ queryKey: [SUPPORT_TICKET_UNREAD_QUERY_KEY, userId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const unreadIds = useMemo(() => new Set(data?.unreadIds || []), [data?.unreadIds]);
  const unreadCount = data?.unreadCount ?? 0;

  const refresh = useCallback(() => {
    if (!userId) return;
    qc.invalidateQueries({ queryKey: [SUPPORT_TICKET_UNREAD_QUERY_KEY, userId] });
  }, [qc, userId]);

  const applyOptimisticRead = useCallback(
    (next: SupportTicketSeenState) => {
      if (!userId) return;
      qc.setQueryData([SUPPORT_TICKET_UNREAD_QUERY_KEY, userId], (prev: UnreadQueryData | undefined) => {
        if (!prev) return prev;
        const unread = unreadSupportTicketIds(prev.tickets, next, userId);
        return { ...prev, unreadIds: unread, unreadCount: unread.length };
      });
    },
    [qc, userId],
  );

  const markOpened = useCallback(
    async (ticketId: string) => {
      if (!userId || !ticketId) return;
      const next = markSupportTicketOpened(readLocalSeenState(userId), ticketId);
      applyOptimisticRead(next);
      try {
        await persistSeenState(userId, next);
      } catch (err) {
        console.error("[useSupportTicketUnread] markOpened", err);
      }
      refresh();
    },
    [applyOptimisticRead, refresh, userId],
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const next = markAllSupportTicketsRead();
    applyOptimisticRead(next);
    try {
      await persistSeenState(userId, next, "replace");
    } catch (err) {
      console.error("[useSupportTicketUnread] markAllRead", err);
    }
    refresh();
  }, [applyOptimisticRead, refresh, userId]);

  return { unreadCount, unreadIds, markOpened, markAllRead, refresh };
}
