import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ClienteGuard = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const [areaType, setAreaType] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const isPreviewRole = profile?.ruolo === "admin" || profile?.ruolo === "ufficio";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setChecking(false);
      return;
    }
    // Admin/ufficio: anteprima portale, no query su clienti
    if (isPreviewRole) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("clienti")
      .select("area_riservata_tipo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // Errore o zero righe: non rimandare al login, lì la sessione cliente torna qui e lo spinner non finisce.
        setAreaType(error ? "errore" : ((data as { area_riservata_tipo?: string } | null)?.area_riservata_tipo || "nessuna"));
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAreaType("errore");
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, isPreviewRole]);

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (isPreviewRole) return <>{children}</>;
  if (profile?.ruolo !== "cliente") return <Navigate to="/" replace />;
  if (areaType === "nessuna" || areaType === "errore") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          Questo accesso è segnato come cliente, ma non risulta un&apos;area riservata collegata. Esci e rientra con l&apos;utenza del gestionale.
        </p>
        <Button variant="outline" onClick={() => void supabase.auth.signOut()}>Esci</Button>
      </div>
    );
  }

  return <>{children}</>;
};

export default ClienteGuard;
