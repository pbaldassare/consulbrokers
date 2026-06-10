import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultRoute } from "@/lib/getDefaultRoute";

const LoginPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  // Già loggato + profilo caricato → redirect reattivo verso la rotta corretta
  if (!authLoading && user && profile) {
    const route = getDefaultRoute(profile) || "/";
    return <Navigate to={route === "/login" ? "/" : route} replace />;
  }

  // Bootstrap auth in corso, OPPURE user presente ma profile ancora in fetch → spinner (no flash form, no redirect prematuro)
  if (authLoading || (user && !profile)) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, hsl(199 58% 14%), hsl(199 50% 24%), hsl(170 55% 32%))" }}
      >
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      console.error("[LoginPage] signIn error:", error);
      toast.error("Accesso fallito", { description: error.message });
      return;
    }
    // Nessuna navigazione manuale: onAuthStateChange aggiorna AuthContext,
    // il guard in cima al componente fa il <Navigate> reattivo.
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Inserisci la tua email");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("Errore", { description: error.message });
    } else {
      toast.success("Email inviata", { description: "Controlla la tua casella per il link di reset." });
      setResetMode(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, hsl(199 58% 14%), hsl(199 50% 24%), hsl(170 55% 32%))",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="bg-card/95 backdrop-blur-sm border border-white/10 rounded-xl p-8 shadow-2xl">
          <div className="flex items-center justify-center mb-4">
            <img src={logoCbnet.url} alt="CBnet" className="h-16 w-auto" />
          </div>
          <h2 className="text-base font-semibold text-foreground text-center mt-2 mb-1">
            {resetMode ? "Recupera Password" : "Accedi"}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {resetMode
              ? "Inserisci la tua email per ricevere il link di reset"
              : "Inserisci le tue credenziali per accedere"}
          </p>

          <form onSubmit={resetMode ? handleResetPassword : handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="nome@esempio.it"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {!resetMode && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full btn-primary-gradient" disabled={loading}>
              {loading ? "Attendere..." : resetMode ? "Invia link di reset" : "Accedi"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setResetMode(!resetMode)}
              className="text-sm text-primary hover:underline"
            >
              {resetMode ? "Torna al login" : "Password dimenticata?"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
