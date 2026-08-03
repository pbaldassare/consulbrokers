import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  createConsultazione,
  deleteConsultazione,
  insertMsgConsultazione,
  listMessagesConsultazione,
  listMieConsultazione,
  shareConsultazione,
  touchConsultazione,
} from "@/lib/garanzieChatConsultazione";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { AiMessage } from "@/components/ai/AiChatMessage";

export type ChatTipo = "web" | "cga";

export type GaranzieConv = {
  id: string;
  titolo: string;
  condivisa: boolean;
  condivisa_at: string | null;
  compagnia: string | null;
  ramo: string | null;
  tipo: string;
  updated_at: string;
  autore_email: string | null;
};

export type GaranzieMsg = {
  id: string;
  role: string;
  content: string;
  fonti: unknown;
  created_at: string;
};

type SidebarTab = "mie" | "condivise";

type UseGaranzieChatOptions = {
  tipo: ChatTipo;
  edgeFunction: "chiedi-mercato-assicurativo" | "chiedi-libreria-cga";
  consultazioneMode?: boolean;
  consultazioneEmail?: string | null;
  extraBody?: () => Record<string, unknown>;
  convExtraFields?: () => Record<string, unknown>;
  onBeforeSend?: (text: string) => void;
};

export function useGaranzieChat({
  tipo,
  edgeFunction,
  consultazioneMode = false,
  consultazioneEmail = null,
  extraBody,
  convExtraFields,
  onBeforeSend,
}: UseGaranzieChatOptions) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const isConsultazionePersist = consultazioneMode && !!consultazioneEmail && !user;
  const canPersist = (!!user && !consultazioneMode) || isConsultazionePersist;

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("mie");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ephemeralMessages, setEphemeralMessages] = useState<AiMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const queryKeyBase = ["garanzie-chat", tipo, isConsultazionePersist ? consultazioneEmail : user?.id];

  const { data: mieConversazioni = [] } = useQuery({
    queryKey: [...queryKeyBase, "mie"],
    enabled: canPersist,
    queryFn: async () => {
      if (isConsultazionePersist) {
        return listMieConsultazione(consultazioneEmail!, tipo);
      }
      const { data, error } = await supabase
        .from("garanzie_chat_conversazioni")
        .select("id, titolo, condivisa, condivisa_at, compagnia, ramo, tipo, updated_at, autore_email")
        .eq("user_id", user!.id)
        .eq("tipo", tipo)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GaranzieConv[];
    },
  });

  const { data: condivise = [] } = useQuery({
    queryKey: [...queryKeyBase, "condivise"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("garanzie_chat_conversazioni")
        .select("id, titolo, condivisa, condivisa_at, compagnia, ramo, tipo, updated_at, autore_email")
        .eq("condivisa", true)
        .eq("tipo", tipo)
        .order("condivisa_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as GaranzieConv[];
    },
  });

  const sidebarList = sidebarTab === "mie" ? mieConversazioni : condivise;

  const { data: dbMessages = [] } = useQuery({
    queryKey: [...queryKeyBase, "messages", activeId, sidebarTab],
    enabled: !!activeId,
    queryFn: async () => {
      if (isConsultazionePersist && sidebarTab === "mie") {
        return listMessagesConsultazione(consultazioneEmail!, activeId!);
      }
      const { data, error } = await supabase
        .from("garanzie_chat_messaggi")
        .select("id, role, content, fonti, created_at")
        .eq("conversazione_id", activeId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GaranzieMsg[];
    },
  });

  const persistedMessages: AiMessage[] = activeId
    ? dbMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          fonti: Array.isArray(m.fonti) ? m.fonti : undefined,
        }))
    : [];

  const messages: AiMessage[] = activeId ? persistedMessages : ephemeralMessages;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isThinking]);

  const resetChat = useCallback(() => {
    setActiveId(null);
    setEphemeralMessages([]);
  }, []);

  const shareMutation = useMutation({
    mutationFn: async (convId: string) => {
      if (isConsultazionePersist) {
        await shareConsultazione(consultazioneEmail!, convId);
        return;
      }
      const { error } = await supabase
        .from("garanzie_chat_conversazioni")
        .update({ condivisa: true, condivisa_at: new Date().toISOString() })
        .eq("id", convId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ricerca condivisa con il team");
      qc.invalidateQueries({ queryKey: queryKeyBase });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (convId: string) => {
      if (isConsultazionePersist) {
        await deleteConsultazione(consultazioneEmail!, convId);
        return;
      }
      const { error } = await supabase.from("garanzie_chat_conversazioni").delete().eq("id", convId);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeyBase });
      if (activeId === id) resetChat();
    },
  });

  const sendMessage = async (text: string) => {
    if (isThinking) return;

    onBeforeSend?.(text);

    let convId = activeId;
    let isFirst = false;
    const extra = convExtraFields?.() ?? {};

    if (canPersist && !convId) {
      try {
        if (isConsultazionePersist) {
          convId = await createConsultazione(consultazioneEmail!, tipo, text.slice(0, 80), {
            compagnia: (extra.compagnia as string | null) ?? null,
            ramo: (extra.ramo as string | null) ?? null,
            prodotto_cga_id: (extra.prodotto_cga_id as string | null) ?? null,
          });
        } else {
          const { data, error } = await supabase
            .from("garanzie_chat_conversazioni")
            .insert({
              user_id: user!.id,
              autore_email: profile?.email ?? user!.email ?? null,
              titolo: text.slice(0, 80),
              tipo,
              ...extra,
            })
            .select("id")
            .single();
          if (error) throw error;
          convId = data.id;
        }
        setActiveId(convId);
        isFirst = true;
        qc.invalidateQueries({ queryKey: [...queryKeyBase, "mie"] });
      } catch {
        toast.error("Impossibile creare la conversazione");
        return;
      }
    }

    const userMsg: AiMessage = { role: "user", content: text };
    if (convId) {
      try {
        if (isConsultazionePersist) {
          await insertMsgConsultazione(consultazioneEmail!, convId, "user", text);
        } else {
          const { error } = await supabase.from("garanzie_chat_messaggi").insert({
            conversazione_id: convId,
            role: "user",
            content: text,
          });
          if (error) throw error;
        }
        qc.invalidateQueries({ queryKey: [...queryKeyBase, "messages", convId] });
      } catch {
        toast.error("Impossibile salvare il messaggio");
        return;
      }
    } else {
      setEphemeralMessages((prev) => [...prev, userMsg]);
    }

    const storico = messages.concat(userMsg).map((m) => ({ role: m.role, content: m.content }));

    setIsThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke(edgeFunction, {
        body: { domanda: text, storico: storico.slice(0, -1), ...(extraBody?.() ?? {}) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const assistantContent = data?.risposta ?? "";
      const fonti = data?.fonti ?? [];

      if (convId) {
        if (isConsultazionePersist) {
          await insertMsgConsultazione(consultazioneEmail!, convId, "assistant", assistantContent, fonti);
          await touchConsultazione(consultazioneEmail!, convId, isFirst ? text.slice(0, 80) : undefined);
        } else {
          await supabase.from("garanzie_chat_messaggi").insert({
            conversazione_id: convId,
            role: "assistant",
            content: assistantContent,
            fonti,
          });
          const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (isFirst) updatePayload.titolo = text.slice(0, 80);
          await supabase.from("garanzie_chat_conversazioni").update(updatePayload).eq("id", convId);
        }
        qc.invalidateQueries({ queryKey: [...queryKeyBase, "messages", convId] });
        qc.invalidateQueries({ queryKey: [...queryKeyBase, "mie"] });
      } else {
        setEphemeralMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantContent, fonti },
        ]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore IA";
      toast.error(msg);
      if (!convId) {
        setEphemeralMessages((prev) => prev.filter((m) => m !== userMsg));
      }
    } finally {
      setIsThinking(false);
    }
  };

  const isSharedReadOnly = !!activeId && sidebarTab === "condivise";

  const formatConvDate = (c: GaranzieConv) =>
    c.condivisa_at ? format(new Date(c.condivisa_at), "dd/MM/yy", { locale: it }) : null;

  return {
    canPersist,
    sidebarTab,
    setSidebarTab,
    activeId,
    setActiveId,
    ephemeralMessages,
    setEphemeralMessages,
    isThinking,
    scrollRef,
    sidebarList,
    messages,
    resetChat,
    shareMutation,
    deleteMutation,
    sendMessage,
    isSharedReadOnly,
    formatConvDate,
  };
}
