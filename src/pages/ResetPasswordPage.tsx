import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  recoveryCodeFromUrl,
  recoveryTokenHashFromUrl,
  urlLooksLikePasswordRecovery,
} from "@/lib/authPasswordRecovery";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const href = window.location.href;
    const hadRecoveryUrl = urlLooksLikePasswordRecovery(href);

    const finishBootstrap = () => {
      if (!cancelled) setBootstrapping(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setBootstrapError(null);
        finishBootstrap();
      }
    });

    (async () => {
      if (hadRecoveryUrl) setIsRecovery(true);

      const tokenHash = recoveryTokenHashFromUrl(href);
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (error) {
          setBootstrapError(error.message);
          setIsRecovery(false);
        } else {
          setIsRecovery(true);
          window.history.replaceState({}, "", window.location.pathname);
        }
      }

      const code = recoveryCodeFromUrl(href);
      if (!tokenHash && code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setBootstrapError(error.message);
          setIsRecovery(false);
        } else {
          setIsRecovery(true);
          window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
        }
      }

      // Attende il parse automatico del token in hash (flow legacy).
      await new Promise((r) => setTimeout(r, hadRecoveryUrl && !tokenHash ? 400 : 0));
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) setBootstrapError(sessErr.message);

      if (session && hadRecoveryUrl) setIsRecovery(true);

      if (!tokenHash && !code && hadRecoveryUrl && !session) {
        setBootstrapError((prev) => prev || "Sessione di recupero non avviata. Richiedi un nuovo link.");
        setIsRecovery(false);
      }

      finishBootstrap();
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Le password non coincidono");
      return;
    }
    if (password.length < 6) {
      toast.error("La password deve essere di almeno 6 caratteri");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Impossibile aggiornare la password", { description: error.message });
    } else {
      toast.success("Password aggiornata", { description: "Ora puoi accedere con la nuova password." });
      navigate("/login", { replace: true });
    }
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl p-8 shadow-sm max-w-sm w-full text-center">
          <p className="text-muted-foreground">
            {bootstrapError || "Link di recupero non valido o scaduto."}
          </p>
          <Button className="mt-4" onClick={() => navigate("/login")}>Torna al login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Lock className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-foreground text-center mb-1">Nuova Password</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Inserisci la tua nuova password
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nuova password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
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
            <div className="space-y-2">
              <Label htmlFor="confirm">Conferma password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Attendere..." : "Aggiorna password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
