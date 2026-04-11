import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Users, User, Megaphone, FileText, Briefcase, AlertTriangle, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanaliSidebarProps {
  canaleAttivoId: string | null;
  onSelectCanale: (id: string) => void;
  onNuovaConversazione: () => void;
  userId: string;
  ambito?: "interno" | "contestuale";
  onAmbitoChange?: (ambito: "interno" | "contestuale") => void;
  showAmbitoToggle?: boolean;
}

const tipoIcons = {
  diretto: User,
  gruppo: Users,
  broadcast: Megaphone,
};

const entitaIcons: Record<string, typeof FileText> = {
  cliente: UserCheck,
  trattativa: Briefcase,
  titolo: FileText,
  sinistro: AlertTriangle,
  argomento: Users,
};

const entitaLabels: Record<string, string> = {
  cliente: "Cliente",
  trattativa: "Trattativa",
  titolo: "Polizza",
  sinistro: "Sinistro",
  argomento: "Argomento",
};

export default function CanaliSidebar({
  canaleAttivoId,
  onSelectCanale,
  onNuovaConversazione,
  userId,
  ambito = "interno",
  onAmbitoChange,
  showAmbitoToggle = true,
}: CanaliSidebarProps) {
  const [filtroTipo, setFiltroTipo] = useState<string>("tutti");
  const [ricerca, setRicerca] = useState("");

  const { data: canali } = useQuery({
    queryKey: ["chat_canali", userId, ambito],
    queryFn: async () => {
      let query = supabase
        .from("chat_canali")
        .select("*, chat_canali_membri(user_id, profiles:user_id(nome, cognome))")
        .eq("ambito", ambito)
        .order("created_at", { ascending: false });
      const { data } = await query;
      return data || [];
    },
    refetchInterval: 10000,
  });

  const canaliFiltrati = (canali || []).filter((c: any) => {
    if (filtroTipo !== "tutti") {
      if (ambito === "interno" && c.tipo !== filtroTipo) return false;
      if (ambito === "contestuale" && c.entita_tipo !== filtroTipo) return false;
    }
    if (ricerca) {
      const nomeCanale = getChannelDisplayName(c, userId).toLowerCase();
      if (!nomeCanale.includes(ricerca.toLowerCase())) return false;
    }
    return true;
  });

  const filterOptions = ambito === "interno"
    ? ["tutti", "diretto", "gruppo", "broadcast"]
    : ["tutti", "cliente", "trattativa", "titolo", "sinistro", "argomento"];

  const filterLabels: Record<string, string> = {
    tutti: "Tutti",
    diretto: "Diretti",
    gruppo: "Gruppi",
    broadcast: "Broadcast",
    ...entitaLabels,
  };

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      <div className="p-3 border-b border-border space-y-2">
        {showAmbitoToggle && onAmbitoChange && (
          <Tabs value={ambito} onValueChange={(v) => { onAmbitoChange(v as any); setFiltroTipo("tutti"); }}>
            <TabsList className="w-full h-8">
              <TabsTrigger value="interno" className="flex-1 text-xs">Interna</TabsTrigger>
              <TabsTrigger value="contestuale" className="flex-1 text-xs">Contestuale</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <Button onClick={onNuovaConversazione} className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" /> Nuova Conversazione
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {filterOptions.map((t) => (
            <Badge
              key={t}
              variant={filtroTipo === t ? "default" : "outline"}
              className="cursor-pointer text-[10px] px-2 py-0.5"
              onClick={() => setFiltroTipo(t)}
            >
              {filterLabels[t] || t}
            </Badge>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1">
          {canaliFiltrati.map((canale: any) => {
            const Icon = ambito === "contestuale"
              ? (entitaIcons[canale.entita_tipo] || Users)
              : (tipoIcons[canale.tipo as keyof typeof tipoIcons] || Users);
            const displayName = getChannelDisplayName(canale, userId);
            const subtitle = ambito === "contestuale"
              ? entitaLabels[canale.entita_tipo] || canale.entita_tipo
              : canale.tipo;

            return (
              <button
                key={canale.id}
                onClick={() => onSelectCanale(canale.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors text-sm",
                  canaleAttivoId === canale.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px]">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{subtitle}</p>
                </div>
                {ambito === "contestuale" && canale.visibile_cliente && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">👤</Badge>
                )}
              </button>
            );
          })}
          {!canaliFiltrati.length && (
            <p className="text-center text-xs text-muted-foreground py-6">Nessun canale</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function getChannelDisplayName(canale: any, userId: string): string {
  if (canale.nome) return canale.nome;
  if (canale.tipo === "diretto" && canale.chat_canali_membri) {
    const other = canale.chat_canali_membri.find((m: any) => m.user_id !== userId);
    if (other?.profiles) return `${other.profiles.nome || ""} ${other.profiles.cognome || ""}`.trim();
  }
  return "Conversazione";
}
