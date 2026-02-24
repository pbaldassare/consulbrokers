import { NavLink as RouterNavLink } from "react-router-dom";
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
  UserPlus,
  Building2,
  Tag,
  Package,
  Grid3X3,
  Landmark,
  Search,
  Bell,
  Receipt,
  ArrowRightLeft,
  LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permissionKey: string;
  adminOnly?: boolean;
}

const allMenuItems: SidebarItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, permissionKey: "dashboard" },
  { label: "Prospect & Trattative", path: "/prospect", icon: Users, permissionKey: "prospect" },
  { label: "Titoli", path: "/titoli", icon: FileText, permissionKey: "titoli" },
  { label: "Sinistri", path: "/sinistri", icon: AlertTriangle, permissionKey: "sinistri" },
  { label: "Contabilità Ufficio", path: "/contabilita", icon: Calculator, permissionKey: "contabilita" },
  { label: "Area CFO", path: "/cfo", icon: BarChart3, permissionKey: "cfo_area" },
  { label: "Provvigioni", path: "/provvigioni", icon: Percent, permissionKey: "provvigioni" },
  { label: "Rimessa Premi", path: "/rimessa-premi", icon: Send, permissionKey: "rimessa_premi" },
  { label: "Import Banca", path: "/banca-import", icon: Landmark, permissionKey: "contabilita" },
  { label: "Anomalie KO", path: "/anomalie-ko", icon: Search, permissionKey: "contabilita" },
  { label: "Note Restituzione", path: "/note-restituzione", icon: FileStack, permissionKey: "contabilita" },
  { label: "Spedizioni", path: "/spedizioni", icon: Package, permissionKey: "contabilita" },
  { label: "Report IVA", path: "/report-iva", icon: Receipt, permissionKey: "contabilita" },
  { label: "Portafoglio Incassi", path: "/portafoglio", icon: Landmark, permissionKey: "contabilita" },
  { label: "Flussi Compagnie", path: "/flussi-compagnie", icon: ArrowRightLeft, permissionKey: "contabilita" },
  { label: "Notifiche", path: "/notifiche", icon: Bell, permissionKey: "dashboard" },
  { label: "Comunicazioni", path: "/comunicazioni", icon: Mail, permissionKey: "comunicazioni" },
  { label: "Privacy & Consensi", path: "/privacy", icon: Shield, permissionKey: "privacy" },
  { label: "Compagnie", path: "/compagnie", icon: Building2, permissionKey: "impostazioni", adminOnly: true },
  { label: "Categorie", path: "/categorie", icon: Tag, permissionKey: "impostazioni", adminOnly: true },
  { label: "Prodotti", path: "/prodotti", icon: Package, permissionKey: "impostazioni", adminOnly: true },
  { label: "Pagamenti Provvigioni", path: "/pagamenti-provvigioni", icon: Percent, permissionKey: "provvigioni" },
  { label: "Matrice Provvigioni", path: "/matrice-provvigioni", icon: Grid3X3, permissionKey: "provvigioni", adminOnly: true },
  { label: "Impostazioni", path: "/impostazioni", icon: Settings, permissionKey: "impostazioni" },
  { label: "Template Ruoli", path: "/template-ruoli", icon: FileStack, permissionKey: "impostazioni", adminOnly: true },
  { label: "Crea Utente", path: "/crea-utente", icon: UserPlus, permissionKey: "impostazioni", adminOnly: true },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const AppSidebar = ({ collapsed, onToggle }: AppSidebarProps) => {
  const { hasPermission, isAdmin } = useAuth();

  const visibleItems = allMenuItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    return hasPermission(item.permissionKey);
  });

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
        {visibleItems.map((item) => (
          <RouterNavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                isActive
                  ? "bg-sidebar-active text-sidebar-active-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-hover"
              } ${collapsed ? "justify-center" : ""}`
            }
          >
            <item.icon className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </RouterNavLink>
        ))}
      </nav>
    </aside>
  );
};

export default AppSidebar;
