import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "Quali sono i 5 clienti che hanno reso di più nell'anno corrente?",
  "Confronta premi 2026 vs 2025 per mese",
  "Mostrami il loss ratio per ramo",
  "Premio medio per ramo nell'ultimo trimestre",
  "Distribuzione clienti per fascia di premio",
  "Quale sede ha il margine maggiore?",
];

interface Props {
  filters: Record<string, any>;
}

export default function CfoAiChat({ filters }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cfo-ai-analyst", {
        body: { messages: next, filters },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setMessages((p) => [...p, { role: "assistant", content: `⚠️ ${data.error}` }]);
      } else {
        setMessages((p) => [...p, { role: "assistant", content: data?.reply || "(nessuna risposta)" }]);
      }
    } catch (e: any) {
      toast.error("Errore: " + (e?.message || e));
      setMessages((p) => [...p, { role: "assistant", content: `⚠️ Errore: ${e?.message || e}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-0 flex flex-col h-[640px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 mx-auto text-primary mb-3" />
              <h3 className="font-semibold mb-1">AI Analista CFO</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Chiedi qualsiasi cosa sui tuoi dati: premi, margini, clienti, rami, sinistri.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                {SUGGESTED.map((s) => (
                  <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-4 py-2 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-table:text-xs prose-th:py-1 prose-td:py-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
              {m.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Sto analizzando i dati...</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Fai una domanda... (Shift+Enter per andare a capo)"
            className="min-h-[44px] max-h-[120px] resize-none"
            disabled={loading}
          />
          <Button onClick={() => send()} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
