import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, User, RefreshCw, Trash2, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Msg = { role: "user" | "assistant"; content: string; isError?: boolean };

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

const TIMEOUT_MS = 60_000;

export default function CfoAiChat({ filters }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUserMsg, setLastUserMsg] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const friendlyError = (msg: string): string => {
    if (/429|rate.?limit/i.test(msg)) return "Troppe richieste in poco tempo. Riprova tra qualche secondo.";
    if (/402|credit/i.test(msg)) return "Crediti AI esauriti. Aggiungi fondi nelle impostazioni del workspace.";
    if (/abort|cancel/i.test(msg)) return "Richiesta annullata.";
    if (/timeout/i.test(msg)) return "La richiesta ha impiegato troppo tempo. Riprova o semplifica la domanda.";
    return msg;
  };

  const send = async (text?: string, isRetry = false) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    let next: Msg[];
    if (isRetry) {
      // remove last error message if present
      next = messages.filter((m, i) => !(i === messages.length - 1 && m.isError));
    } else {
      next = [...messages, { role: "user" as const, content }];
      setInput("");
    }
    setMessages(next);
    setLastUserMsg(content);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort("timeout"), TIMEOUT_MS);

    try {
      const { data, error } = await supabase.functions.invoke("cfo-ai-analyst", {
        body: { messages: next, filters },
      });
      clearTimeout(timeoutId);
      if (controller.signal.aborted) return;

      if (error) throw error;
      if (data?.error) {
        const friendly = friendlyError(data.error);
        toast.error(friendly);
        setMessages((p) => [...p, { role: "assistant", content: `⚠️ ${friendly}`, isError: true }]);
      } else {
        setMessages((p) => [...p, { role: "assistant", content: data?.reply || "(nessuna risposta)" }]);
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (controller.signal.aborted) {
        const reason = controller.signal.reason === "timeout" ? "timeout" : "abort";
        const friendly = friendlyError(reason);
        setMessages((p) => [...p, { role: "assistant", content: `⚠️ ${friendly}`, isError: true }]);
      } else {
        const friendly = friendlyError(e?.message || String(e));
        toast.error(friendly);
        setMessages((p) => [...p, { role: "assistant", content: `⚠️ ${friendly}`, isError: true }]);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const cancelRequest = () => {
    abortRef.current?.abort("abort");
  };

  const retryLast = () => {
    if (lastUserMsg) send(lastUserMsg, true);
  };

  const clearConversation = () => {
    setMessages([]);
    setLastUserMsg(null);
  };

  const lastIsError = messages.length > 0 && messages[messages.length - 1].isError;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Analista CFO
        </CardTitle>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearConversation} disabled={loading}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Pulisci
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0 flex flex-col h-[600px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 mx-auto text-primary mb-3" />
              <h3 className="font-semibold mb-1">Chiedi qualsiasi cosa sui tuoi dati</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Premi, margini, clienti, rami, sinistri — risposte basate sui dati reali.
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
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.isError ? "bg-destructive/10" : "bg-primary/10"}`}>
                  {m.isError ? <AlertCircle className="w-4 h-4 text-destructive" /> : <Sparkles className="w-4 h-4 text-primary" />}
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : m.isError
                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                    : "bg-muted"
                }`}
              >
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

          {lastIsError && !loading && lastUserMsg && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={retryLast}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Riprova ultima domanda
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Sto analizzando i dati...</span>
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={cancelRequest}>
                  <X className="w-3 h-3 mr-1" /> Annulla
                </Button>
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
