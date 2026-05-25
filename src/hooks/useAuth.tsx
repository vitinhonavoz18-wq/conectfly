 import { createContext, useContext, useEffect, useState, ReactNode } from "react";
 import { toast } from "sonner";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    // Set up listener BEFORE getSession (per Supabase best practices)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    loading,
    signOut: async () => {
      try {
        console.log("[Auth] Iniciando logout administrativo completo...");
        console.log(`[Auth] Rota: ${window.location.pathname} | isAdminRoute: true | adminSessionValid: false | Action: Logout`);
        
        // Limpa tudo (Regra 9)
        localStorage.clear();
        sessionStorage.clear();
        
        // Limpar cookies do Supabase explicitamente se possível
        await supabase.auth.signOut();
        
        toast.success("Sessão administrativa encerrada com sucesso.");
      } catch (e) {
        console.error("Erro no SignOut", e);
      } finally {
        // Força o redirecionamento imediato para a tela de login
        window.location.href = "/login";
      }
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}