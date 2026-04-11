import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { format } from "date-fns";
import { logAttivita } from "@/lib/logAttivita";
import { findAllRelatedUsers } from "@/lib/findRelatedUsers";

interface ChatTabProps {
  entitaTipo: string;
  entitaId: string;
}

export default function ChatTab({ entitaTipo, entitaId }: ChatTabProps) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: canaleId } = useQuery({
    queryKey: ["chat_canale_contestuale", entitaTipo, entitaId],
    queryFn: async () => {
      const { data: existing } = await supabase
        .from("chat_canali")
        .select("id")
        .eq("ambito", "contestuale")
        .eq("entita_tipo", entitaTipo)
        .eq("entita_id", entitaId)
        .limit(1)
        .maybeSingle();

      if (existing) return existing.id;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: canale } = await supabase
        .from("chat_canali")
        .insert({
          tipo: "gruppo",
          ambito: "contestuale",
          entita_tipo: entitaTipo,
          entita_id: entitaId,
          visibile_cliente: true,
          creato_da: user.id,
        })
        .select()
        .single();

      if (canale) {
        // Add creator as admin
        await supabase.from("chat_canali_membri").insert({
          canale_id: canale.id,
          user_id: user.id,
          ruolo_canale: "admin",
        });

        // Find ALL related users (client, producers, office staff, commercials)
        const relatedUsers = await findAllRelatedUsers(entitaTipo, entitaId);
        const otherUsers = relatedUsers.filter(u => u.userId !== user.id);

        if (otherUsers.length > 0) {
          await supabase.from("chat_canali_membri").insert(
            otherUsers.map(u => ({
              canale_id: canale.id,
              user_id: u.userId,
              ruolo_canale: "membro",
            }))
          );
        }

        return canale.id;
      }
      return null;
    },
  });

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
    refetchInterval: 5000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!msg.trim() || !canaleId) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("chat_canali_membri")
        .select("id")
        .eq("canale_id", canaleId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership) {
        await supabase.from("chat_canali_membri").insert({
          canale_id: canaleId,
          user_id: user.id,
          ruolo_canale: "membro",
        });
      }

      await supabase.from("chat_messaggi_interni").insert({
        canale_id: canaleId,
        mittente_id: user.id,
        messaggio: msg.trim(),
      });

      // Get user profile for logging
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("ruolo")
        .eq("id", user.id)
        .maybeSingle();

      await logAttivita({
        azione: "messaggio_chat",
        entita_tipo: entitaTipo,
        entita_id: entitaId,
        dettagli_json: {
          preview: msg.trim().slice(0, 50),
          mittente_ruolo: userProfile?.ruolo || "sconosciuto",
          canale_id: canaleId,
        },
      });
    },
    onSuccess: () => {
      setMsg("");
      qc.invalidateQueries({ queryKey: ["chat_messaggi_interni", canaleId] });
    },
  });

  return (
    <div className="flex flex-col h-80 border rounded-lg">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messaggi?.map((m: any) => (
            <div key={m.id} className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {m.profiles ? `${m.profiles.nome} ${m.profiles.cognome}` : "—"}
                </span>
                {m.profiles?.ruolo && (
                  <span className="text-[10px] text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded">
                    {m.profiles.ruolo}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{format(new Date(m.created_at), "dd/MM HH:mm")}</span>
              </div>
              <p className="text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2 mt-1 inline-block">{m.messaggio}</p>
            </div>
          ))}
          {!messaggi?.length && <p className="text-center text-sm text-muted-foreground py-8">Nessun messaggio</p>}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="flex gap-2 p-3 border-t">
        <Input
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMutation.mutate()}
          placeholder="Scrivi un messaggio..."
          className="flex-1"
        />
        <Button size="icon" onClick={() => sendMutation.mutate()} disabled={!msg.trim() || sendMutation.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
