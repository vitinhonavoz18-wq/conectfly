"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  role: "customer" | "admin";
};

type AuthContextValue = {
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  /** false quando o Supabase não está configurado (modo demonstração). */
  authEnabled: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const authEnabled = Boolean(supabase);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(authEnabled);

  const loadProfile = useCallback(
    async (currentUser: User | null) => {
      if (!supabase || !currentUser) {
        setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, cpf, role")
        .eq("id", currentUser.id)
        .maybeSingle();

      setProfile(
        data
          ? {
              id: data.id as string,
              fullName: (data.full_name as string) ?? "",
              email: (data.email as string) ?? currentUser.email ?? "",
              phone: (data.phone as string | null) ?? null,
              cpf: (data.cpf as string | null) ?? null,
              role: (data.role as "customer" | "admin") ?? "customer",
            }
          : null,
      );
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      await loadProfile(data.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      await loadProfile(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(user);
  }, [loadProfile, user]);

  const value = useMemo(
    () => ({ user, profile, loading, authEnabled, signOut, refreshProfile }),
    [user, profile, loading, authEnabled, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return context;
}
