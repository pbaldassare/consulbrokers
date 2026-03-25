import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CalendarClock, Bell, FileText } from "lucide-react";

const ClienteDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ polizze: 0, scadenze: 0, notifiche: 0, documenti: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [polRes, notRes, docRes] = await Promise.all([
        supabase.from("titoli").select("id, stato", { count: "exact" }),
        supabase.from("notifiche").select("id", { count: "exact" }).eq("letto", false),
        supabase.from("documenti").select("id", { count: "exact" }),
      ]);

      const polizze = polRes.count ?? 0;
      const attive = (polRes.data ?? []).filter((t) => t.stato === "attivo").length;

      setStats({
        polizze,
        scadenze: attive,
        notifiche: notRes.count ?? 0,
        documenti: docRes.count ?? 0,
      });
      setLoading(false);
    };
    load();
  }, [user]);

  const cards = [
    { title: "Polizze Attive", value: stats.polizze, icon: Shield, color: "text-primary", link: "/cliente/polizze" },
    { title: "Polizze Attive", value: stats.scadenze, icon: CalendarClock, color: "text-accent", link: "/cliente/scadenze" },
    { title: "Notifiche", value: stats.notifiche, icon: Bell, color: "text-destructive", link: "/cliente/notifiche" },
    { title: "Documenti", value: stats.documenti, icon: FileText, color: "text-muted-foreground", link: "/cliente/documenti" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Benvenuto nella tua Area Clienti</h1>
        <p className="text-muted-foreground text-sm mt-1">Panoramica della tua situazione assicurativa</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.title} to={c.link}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{loading ? "…" : c.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Azioni rapide</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link to="/cliente/upload">
            <Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm">📤 Carica documento</Badge>
          </Link>
          <Link to="/cliente/comunicazioni">
            <Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm">💬 Scrivi all'agenzia</Badge>
          </Link>
          <Link to="/cliente/polizze">
            <Badge variant="secondary" className="cursor-pointer px-3 py-1.5 text-sm">📋 Vedi polizze</Badge>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteDashboard;
