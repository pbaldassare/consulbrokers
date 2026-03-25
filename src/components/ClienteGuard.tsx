import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ClienteGuard = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.ruolo !== "cliente") return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default ClienteGuard;
