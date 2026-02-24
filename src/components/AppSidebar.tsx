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
  LucideIcon,
} from "lucide-react";

interface SidebarItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const menuItems: SidebarItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Prospect & Trattative", path: "/prospect", icon: Users },
  { label: "Titoli", path: "/titoli", icon: FileText },
  { label: "Sinistri", path: "/sinistri", icon: AlertTriangle },
  { label: "Contabilità Ufficio", path: "/contabilita", icon: Calculator },
  { label: "Area CFO", path: "/cfo", icon: BarChart3 },
  { label: "Provvigioni", path: "/provvigioni", icon: Percent },
  { label: "Rimessa Premi", path: "/rimessa-premi", icon: Send },
  { label: "Comunicazioni", path: "/comunicazioni", icon: Mail },
  { label: "Privacy & Consensi", path: "/privacy", icon: Shield },
  { label: "Impostazioni", path: "/impostazioni", icon: Settings },
  { label: "Template Ruoli", path: "/template-ruoli", icon: FileStack },
  { label: "Crea Utente", path: "/crea-utente", icon: UserPlus },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const AppSidebar = ({ collapsed, onToggle }: AppSidebarProps) => {
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
        {menuItems.map((item) => (
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
