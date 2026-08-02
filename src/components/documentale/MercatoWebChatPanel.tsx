import { Globe } from "lucide-react";
import { GaranzieChatLayout } from "@/components/documentale/GaranzieChatLayout";
import { useGaranzieChat } from "@/hooks/useGaranzieChat";

const SUGGERIMENTI = [
  "Ultimi provvedimenti IVASS su distribuzione assicurativa",
  "Trend premi RC auto in Italia 2025-2026",
  "Requisiti minimi copertura cyber per PMI",
  "Novità normative MIFID su prodotti assicurativi",
  "Confronto mercato D&O in Italia",
  "Obblighi informativi precontrattuali IVASS",
];

type Props = {
  consultazioneMode?: boolean;
};

export default function MercatoWebChatPanel({ consultazioneMode = false }: Props) {
  const chat = useGaranzieChat({
    tipo: "web",
    edgeFunction: "chiedi-mercato-assicurativo",
    consultazioneMode,
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
      emptyTitle="Chiedi sul mercato assicurativo italiano"
      emptyDescription="Le risposte cercano informazioni aggiornate sul web (IVASS, ANIA, stampa di settore) con citazione delle fonti."
      thinkingLabel="Consul Mercato sta cercando sul web…"
      formatConvDate={chat.formatConvDate}
    />
  );
}
