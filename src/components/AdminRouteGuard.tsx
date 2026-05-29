import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const SESSION_KEY = "sitecreatorfly_admin_session_v2";

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      if (typeof window === "undefined") return;

      const path = location.pathname;
      const isAdminRoute = true; 
      
      // 1. Verificar nova chave de sessão v2
      const sessionV2 = localStorage.getItem(SESSION_KEY);
      
      // 2. Verificar usuário no Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      let currentUser = session?.user;
      
      // Se a sessão expirou, tentar refresh
      if (!session && !sessionError) {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        currentUser = refreshedSession?.user;
      }
      
      const adminSessionValid = !!(sessionV2 === "true" && currentUser && currentUser.email === 'vitinhonavoz18@gmail.com');

      console.log(`[AdminGuard] Rota: ${path} | isAdminRoute: ${isAdminRoute} | isPublicPizzeriaSlug: false | adminSessionValid: ${adminSessionValid}`);

      if (!adminSessionValid) {
        console.log("[AdminGuard] Sessão inválida detectada no Guard. Redirecionando...");
        
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem("sitecreatorfly_admin_session");
        
        await supabase.auth.signOut();
        
        navigate({ to: "/login", search: { redirect: window.location.href } });
      } else {
        setChecking(false);
      }
    }

    checkAuth();
  }, [location.pathname, navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse uppercase text-[10px] tracking-widest font-black">
            Validando Acesso Administrativo...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
