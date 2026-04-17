import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Shield, FileText, CalendarClock, MessageSquare,
  Bell, CreditCard, Upload, LogOut, Menu, X, AlertTriangle, User, Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const allNavItems = [
  { to: "/cliente", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/cliente/polizze", label: "Polizze", icon: Shield },
  { to: "/cliente/sinistri", label: "Sinistri", icon: AlertTriangle },
  { to: "/cliente/documenti", label: "Documenti", icon: FileText },
  { to: "/cliente/scadenze", label: "Scadenze", icon: CalendarClock },
  { to: "/cliente/chat", label: "Chat", icon: MessageSquare, hasBadge: true },
  { to: "/cliente/notifiche", label: "Notifiche", icon: Bell },
  { to: "/cliente/pagamenti", label: "Pagamenti", icon: CreditCard },
  { to: "/cliente/upload", label: "Carica Doc", icon: Upload, requiresCompleta: true },
  { to: "/cliente/anagrafica", label: "I Miei Dati", icon: User },
  { to: "/cliente/ufficio", label: "Il Mio Ufficio", icon: Building },
];

const ClienteLayout = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [areaType, setAreaType] = useState<string>("completa");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("clienti")
      .select("area_riservata_tipo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAreaType((data as any)?.area_riservata_tipo || "nessuna");
      });
  }, [user]);

  const navItems = allNavItems.filter(
    (item) => !(item as any).requiresCompleta || areaType === "completa"
  );

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const SidebarContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <h1 className="text-xl font-bold text-white tracking-tight">CBnet</h1>
        <span className="text-xs text-white/60">Area Clienti</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onItemClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <p className="text-xs text-white/50 truncate px-1">
          {profile?.nome} {profile?.cognome}
        </p>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2 text-white/70 hover:text-white hover:bg-white/10">
          <LogOut className="h-4 w-4" />
          Esci
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-56 shrink-0 flex-col"
        style={{ background: "linear-gradient(180deg, hsl(199, 58%, 18%) 0%, hsl(199, 58%, 26%) 100%)" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile + main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-50 border-b border-border bg-card shadow-sm">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <button className="p-1.5 rounded-md hover:bg-muted" onClick={() => setMobileOpen(!mobileOpen)}>
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
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)}>
            <aside
              className="absolute left-0 top-0 bottom-0 w-64"
              style={{ background: "linear-gradient(180deg, hsl(199, 58%, 18%) 0%, hsl(199, 58%, 26%) 100%)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <SidebarContent onItemClick={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>

        <footer className="border-t border-border bg-card py-3 text-center text-xs text-muted-foreground">
          CBnet — Per assistenza contatta la tua agenzia
        </footer>
      </div>
    </div>
  );
};

export default ClienteLayout;
