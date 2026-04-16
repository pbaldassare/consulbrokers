import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultRoute } from "@/lib/getDefaultRoute";

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

  // If user lands on "/" but has no dashboard permission, redirect to their default route
  if (location.pathname === "/") {
    const defaultRoute = getDefaultRoute(profile);
    if (defaultRoute !== "/" && defaultRoute !== "/login") {
      return <Navigate to={defaultRoute} replace />;
    }
  }

  return <>{children}</>;
};

export default AuthGuard;
