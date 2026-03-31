import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Shield,
  FileText,
  CalendarClock,
  MessageSquare,
  Bell,
  CreditCard,
  Upload,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  User,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/cliente", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/cliente/polizze", label: "Polizze", icon: Shield },
  { to: "/cliente/sinistri", label: "Sinistri", icon: AlertTriangle },
  { to: "/cliente/documenti", label: "Documenti", icon: FileText },
  { to: "/cliente/scadenze", label: "Scadenze", icon: CalendarClock },
  { to: "/cliente/comunicazioni", label: "Comunicazioni", icon: MessageSquare },
  { to: "/cliente/notifiche", label: "Notifiche", icon: Bell },
  { to: "/cliente/pagamenti", label: "Pagamenti", icon: CreditCard },
  { to: "/cliente/upload", label: "Carica Doc", icon: Upload },
  { to: "/cliente/anagrafica", label: "I Miei Dati", icon: User },
  { to: "/cliente/ufficio", label: "Il Mio Ufficio", icon: Building },
];

const ClienteLayout = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const SidebarContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-primary tracking-tight">CBnet</h1>
        <span className="text-xs text-muted-foreground">Area Clienti</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onItemClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="p-3 border-t border-border space-y-2">
        <p className="text-xs text-muted-foreground truncate px-1">
          {profile?.nome} {profile?.cognome}
        </p>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2 text-muted-foreground">
          <LogOut className="h-4 w-4" />
          Esci
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-border bg-card flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile header + overlay */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-50 border-b border-border bg-card shadow-sm">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <button
                className="p-1.5 rounded-md hover:bg-muted"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <h1 className="text-lg font-bold text-primary tracking-tight">CBnet</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-muted-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)}>
            <aside
              className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <SidebarContent onItemClick={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-card py-3 text-center text-xs text-muted-foreground">
          CBnet — Per assistenza contatta la tua agenzia
        </footer>
      </div>
    </div>
  );
};

export default ClienteLayout;
