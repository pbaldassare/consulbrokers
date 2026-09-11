import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Globe,
  BookOpen,
  Sparkles,
  Mail,
  ScrollText,
  History,
  Link2,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CONSULTAZIONE_ALLOWED_EMAIL_DOMAINS } from "@/lib/consultazioneSession";
import { seedFontiUfficialiSeVuoto } from "@/lib/cbBotFontiSiti";
import { Badge } from "@/components/ui/badge";

type FeedCard = {
  label: string;
  feed: string;
  stato: string;
  icon: LucideIcon;
  path: string;
};

const cards: FeedCard[] = [
  {
    label: "Assistente Web",
    feed: "Si alimenta dalla ricerca web in tempo reale. Nessun catalogo interno.",
    stato: "solo web",
    icon: Globe,
    path: "/cb-bot/assistente-web",
  },
  {
    label: "Fonti siti",
    feed: "Siti che scegli tu: elenco URL da cui caricare i dati per il bot.",
    stato: "da caricare",
    icon: Link2,
    path: "/cb-bot/fonti-siti",
  },
  {
    label: "Libreria CGA",
    feed: "Si alimenta con PDF CGA analizzati (parse-cga) nel catalogo prodotti.",
    stato: "catalogo CGA",
    icon: BookOpen,
    path: "/cb-bot/libreria-cga",
  },
  {
    label: "Assistente IA gestionale",
    feed: "Si alimenta dai dati CBnet (polizze, trattative, report). Non è il bot di consultazione.",
    stato: "dati CBnet",
    icon: Sparkles,
    path: "/ai-assistant",
  },
  {
    label: "Accesso consultazione",
    feed: "Chi entra in /consultazione: solo email dei domini partner autorizzati.",
    stato: "whitelist email",
    icon: Mail,
    path: "/cb-bot/accessi",
  },
  {
    label: "Istruzioni / comandi",
    feed: "Qui andranno i prompt e le regole del bot. Oggi sono ancora nel codice.",
    stato: "da definire",
    icon: ScrollText,
    path: "/cb-bot/istruzioni",
  },
  {
    label: "Ricerche salvate",
    feed: "Archivio delle ricerche pinate da Assistente Web e Libreria CGA.",
    stato: "archivio",
    icon: History,
    path: "/cb-bot/ricerche",
  },
];

const CbBotPage = () => {
  const navigate = useNavigate();

  const { data: ricercheCount } = useQuery({
    queryKey: ["cb-bot", "ricerche-salvate-count"],
    queryFn: async () => {
      const { count, error } = await (supabase.from("garanzie_chat_conversazioni") as any)
        .select("id", { count: "exact", head: true })
        .eq("salvata", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: cgaCount } = useQuery({
    queryKey: ["cb-bot", "prodotti-cga-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("prodotti_cga")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cb Bot</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pannello admin: come si alimenta il bot di consultazione. Da qui decidiamo istruzioni, cataloghi e accessi.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <button
            key={card.path}
            type="button"
            onClick={() => navigate(card.path)}
            className="flex flex-col items-start gap-3 p-5 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all text-left group"
          >
            <div className="flex items-center justify-between w-full gap-2">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <card.icon className="w-6 h-6 text-primary" />
              </div>
              <Badge variant="secondary" className="text-[10px] font-normal">
                {card.label === "Libreria CGA" && cgaCount != null
                  ? `${cgaCount} prodotti`
                  : card.label === "Ricerche salvate" && ricercheCount != null
                    ? `${ricercheCount} salvate`
                  : card.label === "Fonti siti"
                    ? `${seedFontiUfficialiSeVuoto().length} siti`
                    : card.stato}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{card.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.feed}</p>
              {card.label === "Accesso consultazione" && (
                <p className="text-[11px] text-muted-foreground mt-2 font-mono">
                  {CONSULTAZIONE_ALLOWED_EMAIL_DOMAINS.join(", ")}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CbBotPage;
