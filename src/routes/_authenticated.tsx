import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminRouteGuard, SESSION_KEY } from "@/components/AdminRouteGuard";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    // 1. Bloqueio Imediato: Se estiver no navegador, validamos antes de qualquer renderização
    if (typeof window !== "undefined") {
      const path = location.pathname;
      const sessionV2 = localStorage.getItem(SESSION_KEY);
      
      // Limpeza de localStorage antigo (regra 6)
      if (localStorage.getItem("sitecreatorfly_admin_session")) {
        localStorage.removeItem("sitecreatorfly_admin_session");
      }

      // Verificação rápida (sem await obrigatório aqui para redirect instantâneo se a chave sumiu)
      if (sessionV2 !== "true") {
        console.log(`[AuthGuard] Chave V2 ausente para ${path}. Redirecionando...`);
        throw redirect({
          to: "/login",
          search: { redirect: location.href },
        });
      }

      // Verificação real com Supabase
      const { data: { user } } = await supabase.auth.getUser();
      const isValid = user && user.email === 'vitinhonavoz18@gmail.com';

      console.log(`[AuthGuard] Path: ${path} | isAdminRoute: true | adminSessionValid: ${isValid}`);

      if (!isValid) {
        console.log("[AuthGuard] Usuário inválido ou sessão expirada. Redirecionando...");
        localStorage.removeItem(SESSION_KEY);
        await supabase.auth.signOut();
        throw redirect({
          to: "/login",
          search: { redirect: location.href },
        });
      }
    }
  },
  component: () => (
    <AdminRouteGuard>
      <Outlet />
    </AdminRouteGuard>
  ),
});