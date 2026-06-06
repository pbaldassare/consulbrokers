import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Users } from "lucide-react";
import { format } from "date-fns";
import { logAttivita } from "@/lib/logAttivita";
import { findAllRelatedUsers } from "@/lib/findRelatedUsers";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatTabProps {
  entitaTipo: string;
  entitaId: string;
}

// Mappa ruoli interni → label UI (terminologia progetto)
const ruoloLabel = (r: string): string => {
  const map: Record<string, string> = {
    cliente: "Cliente",
    produttore: "Produttore",
    backoffice: "Specialist",
    account_executive: "AE",
    AE: "AE",
    Backoffice: "Specialist",
    corrispondente_1: "Consul 1",
    corrispondente_2: "Consul 2",
    corrispondente_3: "Consul 3",
    "Produttore Sede": "Produttore Sede",
    Agente: "Agente",
    Executive: "Executive",
    admin: "Admin",
    ufficio: "Sede",
    contabilita: "Contabilità",
    cfo: "CFO",
    responsabile_sede: "Resp. Sede",
    assegnato: "Assegnato",
    responsabile: "Responsabile",
    staff: "Staff",
  };
  return map[r] || r;
};

const initials = (nome: string) => {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
};

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
        await supabase.from("chat_canali_membri").insert({
          canale_id: canale.id,
          user_id: user.id,
          ruolo_canale: "admin",
        });
        return canale.id;
      }
      return null;
    },
  });

  // SYNC AUTOMATICA membri: ad ogni apertura del canale ricalcola gli utenti
  // correlati (cliente, produttori, specialist, staff sede, commerciali) e
  // li aggiunge se non sono già membri. Non rimuove mai membri storici.
  useQuery({
    queryKey: ["chat_canale_sync_members", canaleId, entitaTipo, entitaId],
    queryFn: async () => {
      if (!canaleId) return null;
      const related = await findAllRelatedUsers(entitaTipo, entitaId);
      if (related.length === 0) return null;

      const { data: existing } = await supabase
        .from("chat_canali_membri")
        .select("user_id")
        .eq("canale_id", canaleId);

      const existingIds = new Set((existing || []).map((m: any) => m.user_id));
      const toAdd = related.filter((u) => !existingIds.has(u.userId));

      if (toAdd.length > 0) {
        await supabase
          .from("chat_canali_membri")
          .upsert(
            toAdd.map((u) => ({
              canale_id: canaleId,
              user_id: u.userId,
              ruolo_canale: "membro",
            })),
            { onConflict: "canale_id,user_id", ignoreDuplicates: true }
          );
      }
      return { added: toAdd.length };
    },
    enabled: !!canaleId,
    staleTime: 300000,
  });

  // Roster: lista membri attuali del canale con profilo + ruolo logico
  const { data: roster = [] } = useQuery({
    queryKey: ["chat_canale_roster", canaleId, entitaTipo, entitaId],
    queryFn: async () => {
      if (!canaleId) return [];
      const related = await findAllRelatedUsers(entitaTipo, entitaId);
      const roleMap = new Map(related.map((r) => [r.userId, r.ruolo]));

      const { data: membri } = await supabase
        .from("chat_canali_membri")
        .select("user_id, profiles:user_id(nome, cognome, ruolo)")
        .eq("canale_id", canaleId);

      return (membri || []).map((m: any) => {
        const p = m.profiles;
        const nome = p ? `${p.cognome || ""} ${p.nome || ""}`.trim() || "—" : "—";
        const ruoloLogico = roleMap.get(m.user_id) || p?.ruolo || "membro";
        return { userId: m.user_id, nome, ruolo: ruoloLogico };
      });
    },
    enabled: !!canaleId,
    staleTime: 300000,
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
        await supabase
          .from("chat_canali_membri")
          .upsert(
            { canale_id: canaleId, user_id: user.id, ruolo_canale: "membro" },
            { onConflict: "canale_id,user_id", ignoreDuplicates: true }
          );
      }

      await supabase.from("chat_messaggi_interni").insert({
        canale_id: canaleId,
        mittente_id: user.id,
        messaggio: msg.trim(),
      });

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
    <div className="flex flex-col h-[28rem] border rounded-lg">
      {/* Roster header: partecipanti collegati al contesto */}
      {roster.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground shrink-0">
            {roster.length} partecipant{roster.length === 1 ? "e" : "i"}:
          </span>
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1 flex-wrap">
              {roster.map((r) => (
                <Tooltip key={r.userId}>
                  <TooltipTrigger asChild>
                    <div className="inline-flex items-center gap-1.5 bg-background border rounded-full pl-1 pr-2 py-0.5">
                      <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center">
                        {initials(r.nome)}
                      </div>
                      <span className="text-[11px] font-medium text-foreground truncate max-w-[120px]">
                        {r.nome}
                      </span>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                        {ruoloLabel(r.ruolo)}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {r.nome} — {ruoloLabel(r.ruolo)}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>
      )}

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
                    {ruoloLabel(m.profiles.ruolo)}
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
