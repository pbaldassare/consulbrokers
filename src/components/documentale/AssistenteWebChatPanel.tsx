import { GaranzieChatLayout } from "@/components/documentale/GaranzieChatLayout";
import CbBotLogo from "@/components/shared/CbBotLogo";
import { useConsultazione } from "@/contexts/ConsultazioneContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGaranzieChat } from "@/hooks/useGaranzieChat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { insertCbBotFonte } from "@/lib/cbBotFontiDb";
import { normalizeFonteUrl } from "@/lib/cbBotFonti";
import { CB_BOT_FONTI_QUERY_KEY } from "@/components/documentale/CbBotFontiSalvatePanel";
import { toast } from "sonner";

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
  const qc = useQueryClient();

  const callerEmail = consultazioneMode
    ? consultazioneEmail
    : profile?.email ?? user?.email ?? null;

  const chat = useGaranzieChat({
    tipo: "web",
    edgeFunction: "chiedi-mercato-assicurativo",
    consultazioneMode,
    consultazioneEmail: consultazioneEmail,
    extraBody: () => ({ email: callerEmail }),
    onBeforeSend: consultazioneMode
      ? (text) => logRicerca(text, "Assistente Web")
      : undefined,
  });

  const { data: fontiSalvate = [] } = useQuery({
    queryKey: [...CB_BOT_FONTI_QUERY_KEY, "urls"],
    enabled: !consultazioneMode,
    queryFn: async () => {
      const { data, error } = await supabase.from("cb_bot_fonti").select("url").eq("attiva", true);
      if (error) throw error;
      return (data ?? []).map((r) => r.url);
    },
  });

  const saveFonteMutation = useMutation({
    mutationFn: async (hit: { title?: string; url: string; snippet?: string }) => {
      const res = await insertCbBotFonte({
        hit,
        userId: user?.id ?? null,
        origine: "ricerca",
        conversazioneId: chat.activeId,
      });
      if (res === "duplicata") throw new Error("Fonte già in libreria");
    },
    onSuccess: () => {
      toast.success("Fonte salvata: il bot la riuserà nelle prossime ricerche");
      qc.invalidateQueries({ queryKey: CB_BOT_FONTI_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile salvare la fonte"),
  });

  const { data: sitiAttivi = [] } = useQuery({
    queryKey: ["cb-bot-siti-autorizzati", "attivi"],
    enabled: !consultazioneMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_bot_siti_autorizzati")
        .select("id, nome, dominio")
        .eq("attivo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      {!consultazioneMode && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground mr-1">Interroga:</span>
          {sitiAttivi.length === 0 ? (
            <span className="text-[11px] text-amber-700">
              nessun sito attivo — aggiungili dal tab Siti autorizzati
            </span>
          ) : (
            sitiAttivi.map((s) => (
              <Badge key={s.id} variant="secondary" className="text-[10px] font-normal">
                {s.nome}
              </Badge>
            ))
          )}
        </div>
      )}
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
      emptyIcon={<CbBotLogo className="h-14 w-auto mb-3 opacity-90" />}
      emptyTitle="Assistente Web"
      emptyDescription="Cerca solo sui siti autorizzati dall'admin. Non accede a polizze, clienti né al portafoglio CBnet. Per le CGA usa la tab Libreria CGA."
      thinkingLabel="Assistente Web sta cercando sui siti autorizzati…"
      formatConvDate={chat.formatConvDate}
      evidenzaMutation={consultazioneMode ? undefined : chat.evidenzaMutation}
      onSaveFonte={consultazioneMode ? undefined : (f) => saveFonteMutation.mutate(f)}
      savedFonteUrls={fontiSalvate.map((u) => normalizeFonteUrl(u) ?? u)}
    />
    </div>
  );
}
