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
      .select("id, nome, cognome, email, ruolo, ufficio_id, permessi_json, attivo")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as UserProfile);
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => fetchProfile(currentUser.id), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const hasPermission = (key: string): boolean => {
    if (!profile) return false;
    // Admin has all permissions
    if (profile.ruolo === "admin") return true;
    if (!profile.permessi_json) return false;
    return profile.permessi_json[key] === true;
  };

  const isAdmin = profile?.ruolo === "admin";

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, hasPermission, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
