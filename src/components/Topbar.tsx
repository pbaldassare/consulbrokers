import { LogOut, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import GlobalSearch from "./GlobalSearch";
import NotificheDropdown from "./NotificheDropdown";
import { Badge } from "./ui/badge";

interface TopbarProps {
  onToggleSidebar: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Amministratore",
  ufficio: "Responsabile Ufficio",
  produttore: "Produttore",
  contabilita: "Contabilità",
  cfo: "CFO",
  cliente: "Cliente",
};

const Topbar = ({ onToggleSidebar }: TopbarProps) => {
  const { profile, signOut } = useAuth();
  const appEnv = import.meta.env.VITE_APP_ENV || "DEV";
  const isDev = appEnv !== "PROD";

  const displayName = profile
    ? `${profile.nome || ""} ${profile.cognome || ""}`.trim() || profile.email || "Utente"
    : "Utente";
  const roleLabel = profile?.ruolo ? (ROLE_LABELS[profile.ruolo] || profile.ruolo) : "—";
  const initials = profile
    ? `${(profile.nome || "")[0] || ""}${(profile.cognome || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-3">
        <GlobalSearch />
        <Badge variant={isDev ? "destructive" : "default"} className="text-[10px] px-2 py-0.5 uppercase tracking-wider">
          {appEnv}
        </Badge>
      </div>

      <div className="flex items-center gap-4">
        <NotificheDropdown />

        <div className="flex items-center gap-3 pl-3 border-l border-border">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground leading-tight">{displayName}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-xs font-semibold text-primary-foreground">{initials}</span>
          </div>
        </div>

        <button
          onClick={signOut}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
