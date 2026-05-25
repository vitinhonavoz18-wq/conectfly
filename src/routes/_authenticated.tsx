import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminRouteGuard, SESSION_KEY } from "@/components/AdminRouteGuard";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;

    const path = location.pathname;
    console.log(`[AuthGuard] Verificando acesso para: ${path} | Time: ${new Date().toISOString()}`);

    // Limpeza de localStorage antigo (regra 6)
    const legacySession = localStorage.getItem("sitecreatorfly_admin_session");
    if (legacySession) {
      console.log("[AuthGuard] Removendo sessão legada encontrada");
      localStorage.removeItem("sitecreatorfly_admin_session");
    }

    const sessionV2 = localStorage.getItem(SESSION_KEY);
    const { data: { user } } = await supabase.auth.getUser();
    
    const isValid = sessionV2 === "true" && user && user.email === 'vitinhonavoz18@gmail.com';

    console.log(`[AuthGuard] Path: ${path} | isAdminRoute: true | isPublicPizzeriaSlug: false | adminSessionValid: ${isValid}`);

    if (!isValid) {
      console.log("[AuthGuard] Acesso NEGADO. Redirecionando para /login");
      // Garantir limpeza total se estiver tentando acessar sem autorização
      localStorage.removeItem(SESSION_KEY);
      await supabase.auth.signOut();
      
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }

    console.log("[AuthGuard] Acesso AUTORIZADO.");
    return { user };
  },
  component: () => (
    <AdminRouteGuard>
      <Outlet />
    </AdminRouteGuard>
  ),
});