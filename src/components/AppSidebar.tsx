import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  FileText,
  AlertTriangle,
  Calculator,
  BarChart3,
  Percent,
  Send,
  Mail,
  MessageSquare,
  Shield,
  Settings,
  FileStack,
  Wrench,
  UserPlus,
  Building2,
  Tag,
  Package,
  Grid3X3,
  Landmark,
  Bell,
  Receipt,
  HardDrive,
  LucideIcon,
  ChevronDown,
  ChevronRight,
  Search,
  FolderOpen,
  Briefcase,
  ClipboardList,
  FileUp,
  FilePlus,
  Clock,
  FileCheck,
  BookOpen,
  Printer,
  CheckSquare,
  ListChecks,
  DollarSign,
  CalendarCheck,
  CalendarDays,
  FileOutput,
  Import,
  ArrowRightLeft,
  Database,
  Lock,
  Map,
  Archive,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface SidebarGroupDef {
  label: string;
  icon: LucideIcon;
  permissionKey: string;
  adminOnly?: boolean;
  children: SidebarItem[];
}

interface SidebarSingleItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permissionKey: string;
  adminOnly?: boolean;
  hasBadge?: boolean;
}

type SidebarEntry =
  | { type: "single"; item: SidebarSingleItem }
  | { type: "group"; group: SidebarGroupDef };

const sidebarEntries: SidebarEntry[] = [
  { type: "single", item: { label: "Home", path: "/", icon: LayoutDashboard, permissionKey: "dashboard" } },
  { type: "single", item: { label: "Prospect", path: "/prospect", icon: Users, permissionKey: "dashboard" } },
  {
    type: "group",
    group: {
      label: "Trattative",
      icon: ArrowRightLeft,
      permissionKey: "titoli",
      children: [
        { label: "Lista Trattative", path: "/trattative", icon: ArrowRightLeft },
        { label: "Calendario", path: "/trattative/calendario", icon: CalendarDays },
        { label: "Storico", path: "/trattative/storico", icon: Archive },
      ],
    },
  },
  { type: "single", item: { label: "Bandi Pubblici", path: "/bandi-pubblici", icon: Landmark, permissionKey: "dashboard" } },
  { type: "single", item: { label: "Chat", path: "/chat", icon: MessageSquare, permissionKey: "dashboard", hasBadge: true } },
  {
    type: "group",
    group: {
      label: "Portafoglio",
      icon: Briefcase,
      permissionKey: "titoli",
      children: [
        { label: "Clienti", path: "/archivi/clienti", icon: Users },
        { label: "Ricerca Polizze", path: "/titoli", icon: Search },
        { label: "Gestione Polizze", path: "/portafoglio/gestione-polizze", icon: Settings },
        { label: "Estrazioni e Stampe", path: "/portafoglio/estrazioni-stampe", icon: Printer },
        { label: "Collettive / Libri Matricola", path: "/portafoglio/collettive", icon: BookOpen },
        { label: "Regolazioni", path: "/portafoglio/regolazioni", icon: Grid3X3 },
        { label: "Rientro Documenti", path: "/portafoglio/rientro-documenti", icon: Import },
        { label: "Import Titoli (Excel)", path: "/portafoglio/import-titoli", icon: FileUp },
        { label: "Analisi Preventivo RCA", path: "/portafoglio/analisi-preventivo-rca", icon: Shield },
      ],
    },
  },
  {
    type: "single",
    item: { label: "Archivio Documentale", path: "/portafoglio/documentale", icon: HardDrive, permissionKey: "portafoglio" },
  },
  {
    type: "group",
    group: {
      label: "Anagrafiche Utenti",
      icon: Briefcase,
      permissionKey: "dashboard",
      children: [
        { label: "Gestione Utenti", path: "/archivi/anagrafiche", icon: Briefcase },
        { label: "Gestione Sedi", path: "/gestione-uffici", icon: Building2 },
        { label: "Crea Utente", path: "/crea-utente", icon: UserPlus },
        { label: "Utenti di Rete", path: "/gestione-utenti", icon: Users },
      ],
    },
  },
  {
    type: "group",
    group: {
      label: "Sinistri",
      icon: AlertTriangle,
      permissionKey: "sinistri",
      children: [
        { label: "Ricerca", path: "/sinistri", icon: Search },
        { label: "Apertura", path: "/sinistri/apertura", icon: FilePlus },
        { label: "Prescrizioni", path: "/sinistri/prescrizioni", icon: Clock },
        { label: "Scadenze", path: "/sinistri/scadenze", icon: CalendarCheck },
        { label: "Report Sanitario SIR", path: "/sinistri/report-sir", icon: FileText },
      ],
    },
  },
  {
    type: "group",
    group: {
      label: "Contabilità",
      icon: Calculator,
      permissionKey: "contabilita",
      children: [
        { label: "Cruscotto del Giorno", path: "/contabilita/cruscotto", icon: LayoutDashboard },
        { label: "Incassi e Coperture", path: "/contabilita", icon: Landmark },
        { label: "Distinta Giornaliera", path: "/contabilita/distinta-giornaliera", icon: CheckSquare },
        { label: "Quadratura Premi", path: "/contabilita/quadratura-premi", icon: Search },
        { label: "Chiusura Contabile", path: "/contabilita/chiusura-contabile", icon: Lock },
        { label: "Avvisi Incasso", path: "/contabilita/avvisi-incasso", icon: Bell },
        { label: "E/C Clienti", path: "/contabilita/ec-clienti", icon: Users },
        { label: "E/C Compagnia", path: "/contabilita/ec-compagnia", icon: Building2 },
        { label: "E/C Produttori", path: "/contabilita/ec-produttori", icon: Percent },
        { label: "Stampa Primanota", path: "/contabilita/stampa-primanota", icon: Printer },
        { label: "Check Primanota", path: "/contabilita/check-primanota", icon: ListChecks },
        { label: "Stampa Sospesi", path: "/contabilita/stampa-sospesi", icon: FileOutput },
      ],
    },
  },
  /* FatturaPA — nascosto, pagine mantenute nel repo */
  {
    type: "group",
    group: {
      label: "Sistema",
      icon: Settings,
      permissionKey: "impostazioni",
      adminOnly: true,
      children: [
        { label: "Anomalie Sistema", path: "/anomalie-sistema", icon: AlertTriangle },
        { label: "Backup & Export", path: "/backup-export", icon: HardDrive },
        { label: "Tabelle di Base", path: "/tabelle-base", icon: Database },
        { label: "Compagnie", path: "/compagnie", icon: Building2 },
        { label: "Template Email", path: "/template", icon: Mail },
        { label: "Sitemap", path: "/sitemap", icon: Map },
      ],
    },
  },
  { type: "single", item: { label: "Area CFO", path: "/cfo", icon: BarChart3, permissionKey: "cfo_area" } },
  { type: "single", item: { label: "Provvigioni Consul", path: "/provvigioni-sede", icon: Landmark, permissionKey: "provvigioni" } },
  { type: "single", item: { label: "Pagamenti Provvigioni", path: "/pagamenti-provvigioni", icon: DollarSign, permissionKey: "provvigioni" } },
  { type: "single", item: { label: "Rimessa Premi", path: "/rimessa-premi", icon: Send, permissionKey: "rimessa_premi" } },
  { type: "single", item: { label: "Notifiche", path: "/notifiche", icon: Bell, permissionKey: "dashboard" } },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const AppSidebar = ({ collapsed, onToggle }: AppSidebarProps) => {
  const { hasPermission, isAdmin, user } = useAuth();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["chat_unread_count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data: channels } = await supabase
        .from("chat_canali_membri")
        .select("canale_id")
        .eq("user_id", user.id);
      if (!channels?.length) return 0;
      const channelIds = channels.map((c) => c.canale_id);
      const { count } = await supabase
        .from("chat_messaggi_interni")
        .select("id", { count: "exact", head: true })
        .in("canale_id", channelIds)
        .neq("mittente_id", user.id)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  useEffect(() => {
    for (const entry of sidebarEntries) {
      if (entry.type === "group") {
        const match = entry.group.children.some(
          (child) =>
            location.pathname === child.path ||
            location.pathname.startsWith(child.path + "/")
        );
        if (match) {
          setOpenGroups((prev) => {
            const next = new Set(prev);
            next.add(entry.group.label);
            return next;
          });
        }
      }
    }
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const isVisible = (permissionKey: string, adminOnly?: boolean) => {
    if (adminOnly && !isAdmin) return false;
    return hasPermission(permissionKey);
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen z-30 transition-all duration-200 flex flex-col ${
        collapsed ? "w-16" : "w-60"
      }`}
      style={{
        background: "linear-gradient(180deg, hsl(var(--sidebar-bg-from)), hsl(var(--sidebar-bg-to)))",
      }}
    >
      {/* Brand */}
      <div className="px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <>
            <h1 className="text-xl font-bold text-white tracking-tight">CBnet</h1>
            <p className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">Gestionale</p>
          </>
        )}
        {collapsed && (
          <h1 className="text-xl font-bold text-white text-center">C</h1>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 sidebar-scrollbar">
        {sidebarEntries.map((entry) => {
          if (entry.type === "single") {
            const item = entry.item;
            if (!isVisible(item.permissionKey, item.adminOnly)) return null;
            return (
              <RouterNavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 ${
                    isActive
                      ? "bg-white/15 text-white shadow-sm backdrop-blur-sm"
                      : "text-white/70 hover:bg-white/8 hover:text-white/90"
                  } ${collapsed ? "justify-center" : ""}`
                }
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && (
                  <span className="flex-1">{item.label}</span>
                )}
                {item.hasBadge && unreadCount > 0 && (
                  <span className={`inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none ${
                    collapsed ? "absolute top-0.5 right-0.5 w-4 h-4" : "ml-auto min-w-[18px] h-[18px] px-1"
                  }`}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </RouterNavLink>
            );
          }

          const group = entry.group;
          if (!isVisible(group.permissionKey, group.adminOnly)) return null;
          const isOpen = openGroups.has(group.label);
          const hasActiveChild = group.children.some(
            (child) =>
              location.pathname === child.path ||
              location.pathname.startsWith(child.path + "/")
          );

          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 w-full ${
                  hasActiveChild
                    ? "text-white"
                    : "text-white/60 hover:bg-white/8 hover:text-white/80"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <group.icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left uppercase text-xs tracking-wider">
                      {group.label}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </>
                )}
              </button>

              {isOpen && !collapsed && (
                <div className="ml-3 pl-3 border-l border-white/15">
                  {group.children.map((child) => (
                    <RouterNavLink
                      key={child.path}
                      to={child.path}
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-150 mb-0.5 ${
                          isActive
                            ? "bg-white/15 text-white font-medium"
                            : "text-white/60 hover:bg-white/8 hover:text-white/80"
                        }`
                      }
                    >
                      <child.icon className="w-4 h-4 shrink-0" />
                      <span>{child.label}</span>
                    </RouterNavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default AppSidebar;
