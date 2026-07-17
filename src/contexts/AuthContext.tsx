import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  ruolo: string | null;
  ufficio_id: string | null;
  permessi_json: Record<string, boolean> | null;
  attivo: boolean | null;
  telefono: string | null;
  avatar_url: string | null;
  note: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  hasPermission: () => false,
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, cognome, email, ruolo, ufficio_id, permessi_json, attivo, telefono, avatar_url, note")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as UserProfile);
    } else {
      if (error) console.error("[AuthContext] fetchProfile error:", error);
      setProfile(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (_event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          // Defer to avoid deadlock with Supabase auth callbacks
          setTimeout(() => fetchProfile(currentUser.id), 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.warn("[AuthContext] getSession error, clearing stale tokens:", error.message);
          supabase.auth.signOut().finally(() => {
            setUser(null);
            setProfile(null);
            setLoading(false);
          });
          return;
        }
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          fetchProfile(currentUser.id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[AuthContext] getSession exception:", err);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = profile?.ruolo === "admin";

  const hasPermission = (key: string): boolean => {
    if (!profile) return false;
    if (profile.ruolo === "admin") return true;

    const perms = profile.permessi_json;
    const read = (k: string) => !!(perms && typeof perms === "object" && perms[k]);

    // Alias chiavi sidebar non sempre presenti in permessi_json
    if (key === "dashboard") return true;
    if (key === "portafoglio") return read("documentale") || read("titoli");
    if (key === "impostazioni") return profile.ruolo === "ufficio" || read("impostazioni");

    if (profile.ruolo === "cfo") {
      if (perms && key in perms) return !!perms[key];
      return !["manutenzione", "uffici", "tabelle_base"].includes(key);
    }
    return read(key);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, hasPermission, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
