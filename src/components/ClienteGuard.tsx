import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ClienteGuard = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const [areaType, setAreaType] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user || loading) return;
    supabase
      .from("clienti")
      .select("area_riservata_tipo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAreaType((data as any)?.area_riservata_tipo || "nessuna");
        setChecking(false);
      });
  }, [user, loading]);

  if (loading || checking) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.ruolo !== "cliente") return <Navigate to="/" replace />;
  if (areaType === "nessuna") return <Navigate to="/login" replace />;

  return <>{children}</>;
};

export default ClienteGuard;
