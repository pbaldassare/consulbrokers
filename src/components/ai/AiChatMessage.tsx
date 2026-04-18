import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Database } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AiToolCall {
  sql: string;
  purpose?: string;
  rows?: number;
  error?: string;
}

export interface AiMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: AiToolCall[];
}

interface Props {
  message: AiMessage;
}

export const AiChatMessage = ({ message }: Props) => {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3 py-4", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn("flex max-w-[85%] flex-col gap-2", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-lg px-4 py-2.5 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-2 prose-table:my-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || "_(nessuna risposta)_"}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && message.tool_calls && message.tool_calls.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="flex cursor-pointer items-center gap-1.5 hover:text-foreground">
              <Database className="h-3 w-3" />
              {message.tool_calls.length} query eseguit{message.tool_calls.length === 1 ? "a" : "e"}
            </summary>
            <ul className="mt-1.5 space-y-1.5 border-l-2 border-border pl-3">
              {message.tool_calls.map((tc, i) => (
                <li key={i} className="space-y-0.5">
                  {tc.purpose && <div className="font-medium text-foreground">{tc.purpose}</div>}
                  <code className="block whitespace-pre-wrap rounded bg-background/50 p-1.5 font-mono text-[11px]">
                    {tc.sql}
                  </code>
                  <div>
                    {tc.error ? (
                      <span className="text-destructive">Errore: {tc.error}</span>
                    ) : (
                      <span>{tc.rows ?? 0} righe</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
};
