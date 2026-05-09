import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ChatArea from "@/components/chat/ChatArea";
import CanaleContextHeader from "@/components/cliente/CanaleContextHeader";
import NuovaChatClienteDialog from "@/components/cliente/NuovaChatClienteDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, FileText, Briefcase, AlertTriangle, Plus, Search } from "lucide-react";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

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

  // Search nei messaggi
  const { data: matchingCanaliIds } = useQuery({
    queryKey: ["chat_search_msg_cliente", search],
    queryFn: async () => {
      if (!search || search.length < 2) return new Set<string>();
      const { data } = await supabase
        .from("chat_messaggi_interni")
        .select("canale_id")
        .ilike("messaggio", `%${search}%`)
        .limit(200);
      return new Set((data || []).map((r: any) => r.canale_id));
    },
    enabled: !!search && search.length >= 2,
  });

  const canaliFiltrati = useMemo(() => {
    if (!canali) return [];
    if (!search) return canali;
    const q = search.toLowerCase();
    return canali.filter((c: any) => {
      const nameMatch = (c.nome || "").toLowerCase().includes(q) ||
        (entitaLabels[c.entita_tipo] || "").toLowerCase().includes(q);
      const msgMatch = matchingCanaliIds?.has(c.id);
      return nameMatch || msgMatch;
    });
  }, [canali, search, matchingCanaliIds]);

  return (
    <div data-tour="cl-chat-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" /> Chat
        </h1>
        <Button data-tour="cl-chat-new" onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nuova conversazione
        </Button>
      </div>

      <div className="flex h-[calc(100vh-14rem)] border rounded-lg overflow-hidden">
        {/* Sidebar canali */}
        <div className="w-72 shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Le tue conversazioni
            </p>
            <div data-tour="cl-chat-search" className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca conversazioni o messaggi..."
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1">
              {canaliFiltrati.map((canale: any) => {
                const Icon = entitaIcons[canale.entita_tipo] || MessageSquare;
                const label = canale.nome || entitaLabels[canale.entita_tipo] || "Chat";
                const matchInMsg = search && matchingCanaliIds?.has(canale.id);
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
                        {matchInMsg && <span className="ml-1 text-primary">• match nei messaggi</span>}
                      </p>
                    </div>
                  </button>
                );
              })}
              {!canaliFiltrati.length && (
                <p className="text-center text-xs text-muted-foreground py-6">
                  {search ? "Nessun risultato" : "Nessuna conversazione attiva"}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Area chat con header contestuale */}
        <ChatArea
          canaleId={canaleAttivoId}
          headerSlot={canaleAttivoId ? <CanaleContextHeader canaleId={canaleAttivoId} /> : undefined}
        />
      </div>

      <NuovaChatClienteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(id) => setCanaleAttivoId(id)}
      />
    </div>
  );
};

export default ClienteComunicazioni;
