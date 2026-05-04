import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface TimelineTabProps {
  entitaTipo: string;
  entitaId: string;
  /** Extra entity types/ids to include (e.g. trattative logs for a prospect) */
  extraEntities?: { tipo: string; ids: string[] }[];
}

const SEVERITY_CONFIG: Record<string, { icon: React.ElementType; color: string; badge: "default" | "secondary" | "destructive" | "outline" }> = {
  info: { icon: Info, color: "text-primary", badge: "secondary" },
  warning: { icon: AlertTriangle, color: "text-amber-500", badge: "outline" },
  critical: { icon: AlertCircle, color: "text-destructive", badge: "destructive" },
};

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sì" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  // Tronca valori lunghi
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

function humanizeField(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

interface FieldChange { old: unknown; new: unknown; }

function extractChanges(details: Record<string, unknown> | null): Record<string, FieldChange> | null {
  if (!details) return null;
  const c = details.changes as Record<string, FieldChange> | undefined;
  if (c && typeof c === "object" && Object.keys(c).length > 0) return c;
  return null;
}

function formatDetails(details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  if (details.stato_precedente && details.nuovo_stato) {
    return `${details.stato_precedente} → ${details.nuovo_stato}`;
  }
  if (details.descrizione && typeof details.descrizione === "string") {
    return details.descrizione;
  }
  const entries = Object.entries(details).filter(
    ([k, v]) => v != null && v !== "" && !["changes", "op"].includes(k)
  );
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
}

export default function TimelineTab({ entitaTipo, entitaId, extraEntities }: TimelineTabProps) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["timeline", entitaTipo, entitaId, extraEntities],
    queryFn: async () => {
      const { data: main, error } = await supabase
        .from("log_attivita")
        .select("*, profiles:user_id(nome, cognome)")
        .eq("entita_tipo", entitaTipo)
        .eq("entita_id", entitaId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      let all = main || [];

      if (extraEntities?.length) {
        for (const extra of extraEntities) {
          if (!extra.ids.length) continue;
          const { data: extraLogs } = await supabase
            .from("log_attivita")
            .select("*, profiles:user_id(nome, cognome)")
            .eq("entita_tipo", extra.tipo)
            .in("entita_id", extra.ids)
            .order("created_at", { ascending: false })
            .limit(50);
          if (extraLogs) all = [...all, ...extraLogs];
        }
      }

      all.sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
      return all;
    },
  });

  if (isLoading) return <p className="text-center py-6 text-muted-foreground text-sm">Caricamento Log Attività…</p>;

  if (!logs.length) return <p className="text-center py-8 text-muted-foreground text-sm">Nessuna attività registrata</p>;

  return (
    <div className="space-y-1">
      {logs.map((log: any, i: number) => {
        const severity = log.severity || "info";
        const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
        const Icon = cfg.icon;
        const details = log.dettagli_json as Record<string, unknown> | null;
        const changes = extractChanges(details);
        const formattedDetails = formatDetails(details);
        const profile = log.profiles as any;

        return (
          <div key={log.id} className="flex gap-3 py-3 relative">
            {i < logs.length - 1 && (
              <div className="absolute left-[15px] top-[40px] bottom-0 w-px bg-border" />
            )}
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 z-10">
              <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">
                  {log.azione?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </span>
                {severity !== "info" && (
                  <Badge variant={cfg.badge} className="text-[10px] px-1.5 py-0">
                    {severity}
                  </Badge>
                )}
                {changes && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {Object.keys(changes).length} campi
                  </Badge>
                )}
              </div>
              {profile && (
                <p className="text-xs text-muted-foreground">
                  {profile.nome} {profile.cognome}
                </p>
              )}
              {changes ? (
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {Object.entries(changes).map(([field, ch]) => (
                    <li key={field} className="flex flex-wrap items-baseline gap-1">
                      <span className="font-medium text-foreground">{humanizeField(field)}:</span>
                      <span className="line-through text-muted-foreground/70">{fmtVal(ch.old)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-foreground">{fmtVal(ch.new)}</span>
                    </li>
                  ))}
                </ul>
              ) : formattedDetails ? (
                <p className="text-xs text-muted-foreground mt-0.5 break-words">
                  {formattedDetails}
                </p>
              ) : null}
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                {log.created_at ? format(new Date(log.created_at), "dd MMM yyyy · HH:mm", { locale: it }) : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
