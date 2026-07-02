import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { getDefaultRoute } from "@/lib/getDefaultRoute";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[];
  permissionKey?: string;
}

const RoleGuard = ({ children, allowedRoles: _allowedRoles, permissionKey: _permissionKey }: RoleGuardProps) => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  // Tutti gli utenti autenticati con un profilo hanno pieno accesso
  const isAllowed = !!profile && profile.ruolo !== "cliente" && profile.ruolo !== "prospect";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isAllowed) {
      logAttivita({
        azione: "accesso_non_autorizzato_bloccato",
        entita_tipo: "pagina",
        entita_id: "00000000-0000-0000-0000-000000000000",
        dettagli_json: {
          path: window.location.pathname,
          ruolo: profile?.ruolo || "nessuno",
        },
        severity: "warning",
      });
      const fallback = getDefaultRoute(profile);
      navigate(fallback, { replace: true });
    }
  }, [loading, user, isAllowed, navigate, profile]);

  if (loading) return null;
  if (!user || !isAllowed) return null;

  return <>{children}</>;
};

export default RoleGuard;
