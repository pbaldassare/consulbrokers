import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ChatArea from "@/components/chat/ChatArea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FileText, Briefcase, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const entitaIcons: Record<string, typeof FileText> = {
  cliente: MessageSquare,
  trattativa: Briefcase,
  titolo: FileText,
  sinistro: AlertTriangle,
  argomento: MessageSquare,
};

const entitaLabels: Record<string, string> = {
  cliente: "Generale",
  trattativa: "Trattativa",
  titolo: "Polizza",
  sinistro: "Sinistro",
  argomento: "Argomento",
};

const ClienteComunicazioni = () => {
  const { user } = useAuth();
  const [canaleAttivoId, setCanaleAttivoId] = useState<string | null>(null);

  const { data: canali } = useQuery({
    queryKey: ["chat_canali_cliente", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_canali")
        .select("*, chat_canali_membri(user_id, profiles:user_id(nome, cognome))")
        .eq("ambito", "contestuale")
        .eq("visibile_cliente", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" /> Chat
      </h1>

      <div className="flex h-[calc(100vh-14rem)] border rounded-lg overflow-hidden">
        {/* Sidebar canali */}
        <div className="w-64 shrink-0 border-r border-border bg-card">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Le tue conversazioni</p>
          </div>
          <ScrollArea className="h-full">
            <div className="p-1">
              {(canali || []).map((canale: any) => {
                const Icon = entitaIcons[canale.entita_tipo] || MessageSquare;
                const label = canale.nome || entitaLabels[canale.entita_tipo] || "Chat";
                return (
                  <button
                    key={canale.id}
                    onClick={() => setCanaleAttivoId(canale.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors text-sm",
                      canaleAttivoId === canale.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[13px]">{label}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {entitaLabels[canale.entita_tipo] || canale.entita_tipo}
                      </p>
                    </div>
                  </button>
                );
              })}
              {!canali?.length && (
                <p className="text-center text-xs text-muted-foreground py-6">
                  Nessuna conversazione attiva
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Area chat */}
        <ChatArea canaleId={canaleAttivoId} />
      </div>
    </div>
  );
};

export default ClienteComunicazioni;
