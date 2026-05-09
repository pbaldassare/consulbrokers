import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCheck, MessageSquare, Users } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import ConfermeStatus from "./ConfermeStatus";
import { logAttivita } from "@/lib/logAttivita";

interface ChatAreaProps {
  canaleId: string | null;
  headerSlot?: React.ReactNode;
  highlightTerm?: string;
  aboveMessages?: React.ReactNode;
  renderMessage?: (text: string) => React.ReactNode;
}

export default function ChatArea({ canaleId, headerSlot, highlightTerm, aboveMessages, renderMessage }: ChatAreaProps) {
  const { profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const [richiediConferma, setRichiediConferma] = useState(false);
  const [confermeOpenId, setConfermeOpenId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messaggi } = useQuery({
    queryKey: ["chat_messaggi_interni", canaleId],
    queryFn: async () => {
      if (!canaleId) return [];
      const { data } = await supabase
        .from("chat_messaggi_interni")
        .select("*, profiles:mittente_id(nome, cognome, ruolo)")
        .eq("canale_id", canaleId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!canaleId,
    refetchInterval: 3000,
  });

  const { data: membri } = useQuery({
    queryKey: ["chat_canali_membri", canaleId],
    queryFn: async () => {
      if (!canaleId) return [];
      const { data } = await supabase
        .from("chat_canali_membri")
        .select("user_id, profiles:user_id(nome, cognome, ruolo)")
        .eq("canale_id", canaleId);
      return data || [];
    },
    enabled: !!canaleId,
  });

  // Pending confirmations for current user
  const { data: pendingConferme } = useQuery({
    queryKey: ["chat_conferme_pending", canaleId, profile?.id],
    queryFn: async () => {
      if (!canaleId || !profile?.id) return [];
      const { data } = await supabase
        .from("chat_conferme_lettura")
        .select("*, chat_messaggi_interni!inner(canale_id, messaggio, profiles:mittente_id(nome, cognome))")
        .eq("user_id", profile.id)
        .eq("confermato", false);
      // Filter to current channel
      return (data || []).filter((c: any) => c.chat_messaggi_interni?.canale_id === canaleId);
    },
    enabled: !!canaleId && !!profile?.id,
    refetchInterval: 5000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi]);

  // Mark channel as read on open and when new messages arrive
  useEffect(() => {
    if (!canaleId || !profile?.id) return;
    supabase.rpc("mark_canale_as_read", { _canale_id: canaleId }).then(() => {
      qc.invalidateQueries({ queryKey: ["chat_unread_count"] });
    });
  }, [canaleId, messaggi?.length, profile?.id, qc]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!msg.trim() || !canaleId || !profile?.id) return;
      const { data: inserted } = await supabase
        .from("chat_messaggi_interni")
        .insert({
          canale_id: canaleId,
          mittente_id: profile.id,
          messaggio: msg.trim(),
          richiedi_conferma: isAdmin ? richiediConferma : false,
        })
        .select()
        .single();

      // If richiedi_conferma, create conferme for all other members
      if (richiediConferma && isAdmin && inserted && membri) {
        const otherMembers = membri.filter((m: any) => m.user_id !== profile.id);
        if (otherMembers.length > 0) {
          await supabase.from("chat_conferme_lettura").insert(
            otherMembers.map((m: any) => ({
              messaggio_id: inserted.id,
              user_id: m.user_id,
            }))
          );
        }
      }

      // Log attivita
      await logAttivita({
        azione: "messaggio_chat_interno",
        entita_tipo: "chat_canale",
        entita_id: canaleId,
        dettagli_json: {
          preview: msg.trim().slice(0, 50),
          mittente_ruolo: profile.ruolo || "sconosciuto",
          richiedi_conferma: richiediConferma,
        },
      });
    },
    onSuccess: () => {
      setMsg("");
      setRichiediConferma(false);
      qc.invalidateQueries({ queryKey: ["chat_messaggi_interni", canaleId] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (confermaId: string) => {
      await supabase
        .from("chat_conferme_lettura")
        .update({ confermato: true, confermato_at: new Date().toISOString() })
        .eq("id", confermaId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat_conferme_pending", canaleId, profile?.id] });
    },
  });

  if (!canaleId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Seleziona una conversazione</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {headerSlot}
      {/* Channel members header */}
      {membri && membri.length > 0 && (
        <div className="border-b border-border bg-muted/30 px-4 py-2 flex items-center gap-2 flex-wrap">
          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground font-medium mr-1">Membri:</span>
          {membri.map((m: any) => {
            const nome = m.profiles ? `${m.profiles.nome || ""} ${m.profiles.cognome || ""}`.trim() : "—";
            const ruolo = m.profiles?.ruolo || "";
            return (
              <span key={m.user_id} className="inline-flex items-center gap-1 text-[10px]">
                <span className="font-medium text-foreground">{nome}</span>
                {ruolo && (
                  <span className="text-[9px] text-muted-foreground capitalize bg-muted px-1 py-0.5 rounded">{ruolo}</span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Pending confirmation banner */}
      {pendingConferme && pendingConferme.length > 0 && (
        <div className="border-b border-border bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
          {pendingConferme.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-amber-700 dark:text-amber-400">Conferma richiesta: </span>
                <span className="text-foreground">
                  {c.chat_messaggi_interni?.profiles?.nome} {c.chat_messaggi_interni?.profiles?.cognome}: &ldquo;{c.chat_messaggi_interni?.messaggio?.slice(0, 60)}...&rdquo;
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={() => confirmMutation.mutate(c.id)}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Confermo
              </Button>
            </div>
          ))}
        </div>
      )}

      {aboveMessages}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messaggi?.map((m: any) => {
            const isOwn = m.mittente_id === profile?.id;
            return (
              <div key={m.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {m.profiles ? `${m.profiles.nome || ""} ${m.profiles.cognome || ""}` : "—"}
                  </span>
                  {m.profiles?.ruolo && (
                    <span className="text-[9px] text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded">
                      {m.profiles.ruolo}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(m.created_at), "dd/MM HH:mm")}
                  </span>
                  {m.richiedi_conferma && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-400 text-amber-600">
                      Conferma
                    </Badge>
                  )}
                </div>
                <div className={`rounded-lg px-3 py-2 mt-1 max-w-[80%] text-sm whitespace-pre-wrap break-words ${
                  isOwn ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground"
                }`}>
                  {renderMessage ? renderMessage(m.messaggio) : m.messaggio}
                </div>
                {m.richiedi_conferma && isOwn && isAdmin && (
                  <button
                    onClick={() => setConfermeOpenId(confermeOpenId === m.id ? null : m.id)}
                    className="text-[10px] text-primary hover:underline mt-1"
                  >
                    Stato conferme
                  </button>
                )}
                {confermeOpenId === m.id && (
                  <ConfermeStatus messaggioId={m.id} />
                )}
              </div>
            );
          })}
          {!messaggi?.length && (
            <p className="text-center text-sm text-muted-foreground py-8">Nessun messaggio</p>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-3 space-y-2">
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="conferma"
              checked={richiediConferma}
              onCheckedChange={(v) => setRichiediConferma(!!v)}
            />
            <label htmlFor="conferma" className="text-xs text-muted-foreground cursor-pointer">
              Richiedi conferma di lettura
            </label>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMutation.mutate()}
            placeholder="Scrivi un messaggio..."
            className="flex-1"
          />
          <Button size="icon" onClick={() => sendMutation.mutate()} disabled={!msg.trim() || sendMutation.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
