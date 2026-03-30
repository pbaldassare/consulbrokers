import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const AuthGuard = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  // Redirect clients to portal if trying to access gestionale
  if (profile?.ruolo === "cliente" && !location.pathname.startsWith("/cliente")) {
    return <Navigate to="/cliente" replace />;
  }

  // Redirect prospects to portal if trying to access gestionale
  if (profile?.ruolo === "prospect" && !location.pathname.startsWith("/prospect")) {
    return <Navigate to="/prospect" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
