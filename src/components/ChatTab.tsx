import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { format } from "date-fns";
import { logAttivita } from "@/lib/logAttivita";

interface ChatTabProps {
  entitaTipo: string;
  entitaId: string;
}

export default function ChatTab({ entitaTipo, entitaId }: ChatTabProps) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messaggi } = useQuery({
    queryKey: ["chat", entitaTipo, entitaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messaggi")
        .select("*, profiles:mittente_id(nome, cognome)")
        .eq("entita_tipo", entitaTipo)
        .eq("entita_id", entitaId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi]);

  const inviaMessaggio = async () => {
    if (!msg.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("chat_messaggi").insert({
      entita_tipo: entitaTipo,
      entita_id: entitaId,
      mittente_id: user.id,
      messaggio: msg.trim(),
    });

    await logAttivita({ azione: "messaggio_chat", entita_tipo: entitaTipo, entita_id: entitaId, dettagli_json: { preview: msg.trim().slice(0, 50) } });
    setMsg("");
    qc.invalidateQueries({ queryKey: ["chat", entitaTipo, entitaId] });
  };

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
          onKeyDown={e => e.key === "Enter" && inviaMessaggio()}
          placeholder="Scrivi un messaggio..."
          className="flex-1"
        />
        <Button size="icon" onClick={inviaMessaggio} disabled={!msg.trim()}><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
