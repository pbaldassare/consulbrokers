import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Database, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

export interface AiToolCall {
  tool?: string;
  sql?: string;
  table?: string;
  purpose?: string;
  rows?: number;
  ms?: number;
  error?: string;
  block?: any;
}

export interface AiMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: AiToolCall[];
}

const CHART_COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))",
  "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899",
];

const toneClass = (tone?: string) => {
  switch (tone) {
    case "success": return "border-emerald-500/40 bg-emerald-500/5";
    case "warning": return "border-amber-500/40 bg-amber-500/5";
    case "danger":  return "border-destructive/40 bg-destructive/5";
    default:        return "border-border bg-muted/40";
  }
};

const RenderBlock = ({ block, kind }: { block: any; kind: string }) => {
  const navigate = useNavigate();
  if (!block) return null;

  if (kind === "render_metrics") {
    const metrics = Array.isArray(block.metrics) ? block.metrics : [];
    return (
      <div className="my-2">
        {block.title && <div className="mb-1.5 text-xs font-semibold text-foreground">{block.title}</div>}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, minmax(0,1fr))` }}>
          {metrics.map((m: any, i: number) => (
            <div key={i} className={cn("rounded-md border p-2.5", toneClass(m.tone))}>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
              <div className="text-lg font-semibold text-foreground">{m.value}</div>
              {m.hint && <div className="text-[11px] text-muted-foreground">{m.hint}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "render_chart") {
    const data = Array.isArray(block.data) ? block.data : [];
    return (
      <div className="my-2 rounded-md border bg-card p-3">
        {block.title && <div className="mb-2 text-xs font-semibold">{block.title}</div>}
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            {block.kind === "pie" ? (
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="label" outerRadius={80} label>
                  {data.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            ) : block.kind === "line" ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} />
              </LineChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill={CHART_COLORS[0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (kind === "render_table") {
    const columns = Array.isArray(block.columns) ? block.columns : [];
    const rows = Array.isArray(block.rows) ? block.rows : [];
    const link = typeof block.link_template === "string" ? block.link_template : null;
    const buildUrl = (row: any) =>
      link ? link.replace(/\{(\w+)\}/g, (_: string, k: string) => String(row?.[k] ?? "")) : null;
    return (
      <div className="my-2 rounded-md border bg-card">
        {block.title && <div className="border-b px-3 py-2 text-xs font-semibold">{block.title}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>{columns.map((c: any) => <th key={c.key} className="px-3 py-1.5 text-left font-medium">{c.label}</th>)}
                {link && <th className="w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, i: number) => {
                const url = buildUrl(r);
                const onClick = url ? () => navigate(url) : undefined;
                return (
                  <tr
                    key={i}
                    className={cn("border-t", i % 2 === 1 && "bg-muted/20", url && "cursor-pointer hover:bg-muted/60")}
                    onClick={onClick}
                  >
                    {columns.map((c: any) => <td key={c.key} className="px-3 py-1.5">{String(r?.[c.key] ?? "")}</td>)}
                    {link && <td className="px-2 text-muted-foreground"><ExternalLink className="h-3 w-3" /></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
};

const InternalLink = ({ href, children }: { href?: string; children: any }) => {
  const navigate = useNavigate();
  const isInternal = typeof href === "string" && href.startsWith("/");
  if (!isInternal) {
    return <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">{children}</a>;
  }
  return (
    <a
      href={href}
      onClick={(e) => { e.preventDefault(); navigate(href!); }}
      className="text-primary underline"
    >
      {children}
    </a>
  );
};

interface Props {
  message: AiMessage;
}

export const AiChatMessage = ({ message }: Props) => {
  const isUser = message.role === "user";
  const tcs = message.tool_calls ?? [];
  const renderBlocks = tcs.filter((tc) => tc.block && (tc.tool ?? "").startsWith("render_"));
  const queryBlocks = tcs.filter((tc) => !tc.block);

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
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-2 prose-table:my-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: InternalLink as any }}>
                {message.content || "_(nessuna risposta)_"}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && renderBlocks.map((tc, i) => (
          <RenderBlock key={`block-${i}`} block={tc.block} kind={tc.tool ?? ""} />
        ))}

        {!isUser && queryBlocks.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="flex cursor-pointer items-center gap-1.5 hover:text-foreground">
              <Database className="h-3 w-3" />
              {queryBlocks.length} operazion{queryBlocks.length === 1 ? "e" : "i"} sui dati
            </summary>
            <ul className="mt-1.5 space-y-1.5 border-l-2 border-border pl-3">
              {queryBlocks.map((tc, i) => (
                <li key={i} className="space-y-0.5">
                  <div className="font-medium text-foreground">
                    {tc.tool ?? "query"}{tc.table ? ` · ${tc.table}` : ""}
                    {tc.purpose ? ` · ${tc.purpose}` : ""}
                  </div>
                  {tc.sql && (
                    <code className="block whitespace-pre-wrap rounded bg-background/50 p-1.5 font-mono text-[11px]">
                      {tc.sql}
                    </code>
                  )}
                  <div>
                    {tc.error
                      ? <span className="text-destructive">Errore: {tc.error}</span>
                      : <span>{tc.rows ?? 0} {tc.tool === "list_enum_values" ? "valori" : "righe"}{tc.ms ? ` · ${tc.ms}ms` : ""}</span>}
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
