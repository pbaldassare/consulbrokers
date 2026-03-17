import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
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
  FileOutput,
  Import,
  ArrowRightLeft,
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
}

type SidebarEntry =
  | { type: "single"; item: SidebarSingleItem }
  | { type: "group"; group: SidebarGroupDef };

const sidebarEntries: SidebarEntry[] = [
  // HOME
  { type: "single", item: { label: "Home", path: "/", icon: LayoutDashboard, permissionKey: "dashboard" } },

  // PROSPECT & TRATTATIVE (standalone)
  { type: "single", item: { label: "Prospect", path: "/prospect", icon: Users, permissionKey: "dashboard" } },
  { type: "single", item: { label: "Trattative", path: "/trattative", icon: ArrowRightLeft, permissionKey: "titoli" } },

  // ARCHIVI
  {
    type: "group",
    group: {
      label: "Archivi",
      icon: FolderOpen,
      permissionKey: "dashboard",
      children: [
        { label: "Compagnie", path: "/compagnie", icon: Building2 },
        { label: "Categorie", path: "/categorie", icon: Tag },
        { label: "Prodotti", path: "/prodotti", icon: Package },
      ],
    },
  },

  // PORTAFOGLIO
  {
    type: "group",
    group: {
      label: "Portafoglio",
      icon: Briefcase,
      permissionKey: "titoli",
      children: [
        { label: "Ricerca Polizze", path: "/titoli", icon: Search },
        { label: "Estrazioni e Stampe", path: "/portafoglio/estrazioni-stampe", icon: Printer },
        { label: "Collettive / Libri Matricola", path: "/portafoglio/collettive", icon: BookOpen },
        { label: "Regolazioni", path: "/portafoglio/regolazioni", icon: ClipboardList },
        { label: "Documentale", path: "/portafoglio/documentale", icon: FileText },
        { label: "Trattative", path: "/trattative", icon: ArrowRightLeft },
        { label: "Rientro Documenti", path: "/portafoglio/rientro-documenti", icon: FileCheck },
        { label: "Import Titoli (Excel)", path: "/portafoglio/import-titoli", icon: FileUp },
      ],
    },
  },

  // SINISTRI
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

  // CONTABILITÀ
  {
    type: "group",
    group: {
      label: "Contabilità",
      icon: Calculator,
      permissionKey: "contabilita",
      children: [
        { label: "Incassi e Coperture", path: "/contabilita", icon: Landmark },
        { label: "Avvisi Incasso", path: "/contabilita/avvisi-incasso", icon: Bell },
        { label: "Chiusura Giornaliera", path: "/contabilita/chiusura-giornaliera", icon: CheckSquare },
        { label: "E/C Clienti", path: "/contabilita/ec-clienti", icon: Users },
        { label: "E/C Compagnia", path: "/contabilita/ec-compagnia", icon: Building2 },
        { label: "E/C Produttori", path: "/contabilita/ec-produttori", icon: Percent },
        { label: "Stampa Primanota", path: "/contabilita/stampa-primanota", icon: Printer },
        { label: "Check Primanota", path: "/contabilita/check-primanota", icon: ListChecks },
        { label: "Stampa Sospesi", path: "/contabilita/stampa-sospesi", icon: FileOutput },
      ],
    },
  },

  // CONT. GENERALE
  {
    type: "group",
    group: {
      label: "Cont. Generale",
      icon: BarChart3,
      permissionKey: "cfo_area",
      children: [
        { label: "Anagrafiche", path: "/cont-generale/anagrafiche", icon: Users },
        { label: "Primanota", path: "/cont-generale/primanota", icon: FileText },
        { label: "Elab. Periodiche", path: "/cont-generale/elab-periodiche", icon: CalendarCheck },
        { label: "Fornitori", path: "/cont-generale/fornitori", icon: Building2 },
        { label: "Clienti", path: "/cont-generale/clienti", icon: Users },
        { label: "Elab. Annuali", path: "/cont-generale/elab-annuali", icon: ClipboardList },
        { label: "Dichiarativi", path: "/cont-generale/dichiarativi", icon: FileStack },
      ],
    },
  },

  // FATTURAPA
  {
    type: "group",
    group: {
      label: "FatturaPA",
      icon: Receipt,
      permissionKey: "contabilita",
      children: [
        { label: "Anagrafiche", path: "/fatturapa/anagrafiche", icon: Users },
        { label: "Gestione", path: "/fatturapa/gestione", icon: Settings },
        { label: "Estrazione XML", path: "/backup-export", icon: FileOutput },
        { label: "Intermediazione", path: "/fatturapa/intermediazione", icon: ArrowRightLeft },
        { label: "Import Fatture Acquisto", path: "/fatturapa/import-fatture", icon: Import },
      ],
    },
  },

  // SISTEMA (admin)
  {
    type: "group",
    group: {
      label: "Sistema",
      icon: Settings,
      permissionKey: "impostazioni",
      adminOnly: true,
      children: [
        { label: "Impostazioni", path: "/impostazioni", icon: Settings },
        { label: "Template Ruoli", path: "/template-ruoli", icon: FileStack },
        { label: "Crea Utente", path: "/crea-utente", icon: UserPlus },
        { label: "Gestione Utenti", path: "/gestione-utenti", icon: Users },
        { label: "Matrice Provvigioni", path: "/matrice-provvigioni", icon: Grid3X3 },
        { label: "Anomalie Sistema", path: "/anomalie-sistema", icon: AlertTriangle },
        { label: "Backup & Export", path: "/backup-export", icon: HardDrive },
        { label: "Manutenzione", path: "/manutenzione", icon: Wrench },
      ],
    },
  },

  // Extra standalone items
  { type: "single", item: { label: "Area CFO", path: "/cfo", icon: BarChart3, permissionKey: "cfo_area" } },
  { type: "single", item: { label: "Provvigioni", path: "/provvigioni", icon: Percent, permissionKey: "provvigioni" } },
  { type: "single", item: { label: "Pagamenti Provvigioni", path: "/pagamenti-provvigioni", icon: DollarSign, permissionKey: "provvigioni" } },
  { type: "single", item: { label: "Rimessa Premi", path: "/rimessa-premi", icon: Send, permissionKey: "rimessa_premi" } },
  { type: "single", item: { label: "Notifiche", path: "/notifiche", icon: Bell, permissionKey: "dashboard" } },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const AppSidebar = ({ collapsed, onToggle }: AppSidebarProps) => {
  const { hasPermission, isAdmin } = useAuth();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Auto-open the group that contains the current route
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
      className={`fixed left-0 top-0 h-screen bg-card border-r border-sidebar-border z-30 transition-all duration-200 flex flex-col ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Brand */}
      <div className="px-4 py-5 border-b border-sidebar-border">
        {!collapsed && (
          <>
            <h1 className="text-xl font-bold text-foreground tracking-tight">AssiGest</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">Gestionale</p>
          </>
        )}
        {collapsed && (
          <h1 className="text-xl font-bold text-foreground text-center">A</h1>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
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
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                    isActive
                      ? "bg-sidebar-active text-sidebar-active-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-hover"
                  } ${collapsed ? "justify-center" : ""}`
                }
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </RouterNavLink>
            );
          }

          // Group
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
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors w-full ${
                  hasActiveChild
                    ? "text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-hover"
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
                <div className="ml-3 pl-3 border-l border-sidebar-border">
                  {group.children.map((child) => (
                    <RouterNavLink
                      key={child.path}
                      to={child.path}
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors mb-0.5 ${
                          isActive
                            ? "bg-sidebar-active text-sidebar-active-foreground font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-hover"
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
