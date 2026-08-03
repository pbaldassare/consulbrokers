import { Globe } from "lucide-react";
import { GaranzieChatLayout } from "@/components/documentale/GaranzieChatLayout";
import { useConsultazione } from "@/contexts/ConsultazioneContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGaranzieChat } from "@/hooks/useGaranzieChat";

const SUGGERIMENTI = [
  "Ultimi provvedimenti IVASS su distribuzione assicurativa",
  "Come funziona la copertura cyber per le PMI?",
  "Differenza tra polizza tutela legale e D&O",
  "Trend premi RC auto in Italia 2025-2026",
  "Cosa prevede il Codice delle Assicurazioni sugli obblighi informativi?",
  "Spiegami il concetto di retroattività in RC professionale",
];

type Props = {
  consultazioneMode?: boolean;
};

export default function AssistenteWebChatPanel({ consultazioneMode = false }: Props) {
  const { email: consultazioneEmail, logRicerca } = useConsultazione();
  const { user, profile } = useAuth();

  const callerEmail = consultazioneMode
    ? consultazioneEmail
    : profile?.email ?? user?.email ?? null;

  const chat = useGaranzieChat({
    tipo: "web",
    edgeFunction: "chiedi-mercato-assicurativo",
    consultazioneMode,
    extraBody: () => ({ email: callerEmail }),
    onBeforeSend: consultazioneMode
      ? (text) => logRicerca(text, "Assistente Web")
      : undefined,
  });

  return (
    <GaranzieChatLayout
      canPersist={chat.canPersist}
      sidebarTab={chat.sidebarTab}
      setSidebarTab={chat.setSidebarTab}
      sidebarList={chat.sidebarList}
      activeId={chat.activeId}
      onSelectConv={(id) => {
        chat.setActiveId(id);
        chat.setEphemeralMessages([]);
      }}
      resetChat={chat.resetChat}
      shareMutation={chat.shareMutation}
      deleteMutation={chat.deleteMutation}
      messages={chat.messages}
      isThinking={chat.isThinking}
      scrollRef={chat.scrollRef}
      isSharedReadOnly={chat.isSharedReadOnly}
      sendMessage={chat.sendMessage}
      suggestions={SUGGERIMENTI}
      emptyIcon={<Globe className="h-10 w-10 mb-3 opacity-40" />}
      emptyTitle="Assistente Web"
      emptyDescription="Chiedi qualsiasi cosa sul web, come ChatGPT. Non accede alle tue polizze, ai clienti né al portafoglio CBnet."
      thinkingLabel="Assistente Web sta cercando sul web…"
      formatConvDate={chat.formatConvDate}
    />
  );
}
