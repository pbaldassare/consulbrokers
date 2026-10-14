import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  SUPPORT_TICKET_UNREAD_QUERY_KEY,
  ensureSupportTicketSeenBaseline,
  loadSupportTicketSeenState,
  markAllSupportTicketsRead,
  markSupportTicketOpened,
  saveSupportTicketSeenState,
  unreadSupportTicketIds,
  type SupportTicketUnreadRow,
} from "@/lib/supportTicketUnread";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useSupportTicketUnread() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  const { data } = useQuery({
    queryKey: [SUPPORT_TICKET_UNREAD_QUERY_KEY, userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return { tickets: [] as SupportTicketUnreadRow[], unreadIds: [] as string[], unreadCount: 0 };
      const state = ensureSupportTicketSeenBaseline(userId);
      const { data: rows, error } = await db.from("support_tickets").select("id, created_at, data_apertura");
      if (error) throw error;
      const tickets = (rows || []) as SupportTicketUnreadRow[];
      const unreadIds = unreadSupportTicketIds(tickets, state);
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

  const markOpened = useCallback(
    (ticketId: string) => {
      if (!userId || !ticketId) return;
      const next = markSupportTicketOpened(loadSupportTicketSeenState(userId), ticketId);
      saveSupportTicketSeenState(userId, next);
      refresh();
    },
    [refresh, userId],
  );

  const markAllRead = useCallback(() => {
    if (!userId) return;
    saveSupportTicketSeenState(userId, markAllSupportTicketsRead());
    refresh();
  }, [refresh, userId]);

  return { unreadCount, unreadIds, markOpened, markAllRead };
}
