import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[];
  /** Optional permission key to check via permessi_json */
  permissionKey?: string;
}

const RoleGuard = ({ children, allowedRoles, permissionKey }: RoleGuardProps) => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  const isAllowed =
    profile &&
    allowedRoles.includes(profile.ruolo || "") &&
    (!permissionKey || profile.ruolo === "admin" || (profile.permessi_json as Record<string, boolean>)?.[permissionKey]);

  useEffect(() => {
    if (loading) return;
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
      navigate("/", { replace: true });
    }
  }, [loading, isAllowed, navigate, profile]);

  if (loading) return null;
  if (!isAllowed) return null;

  return <>{children}</>;
};

export default RoleGuard;
