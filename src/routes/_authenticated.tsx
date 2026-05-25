import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    // No servidor, window é undefined.
    if (typeof window === "undefined") {
      return;
    }
    
    console.log("[AuthGuard] Verificando sessão para:", location.pathname);
    
    // Todas as rotas sob _authenticated exigem login administrativo
    // Usamos getUser() para garantir uma validação real contra o servidor (evita bypass por localStorage antigo)
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.log("[AuthGuard] Sessão inválida ou ausente. Redirecionando para /login");
      // Limpa qualquer resquício de sessão local
      await supabase.auth.signOut();
      
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }

    // Validar se o usuário logado é de fato o admin único
    if (user.email !== 'vitinhonavoz18@gmail.com') {
      console.log("[AuthGuard] Usuário não autorizado (" + user.email + "). Fazendo logout.");
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }

    console.log("[AuthGuard] Sessão administrativa confirmada para:", user.email);
    return;
  },
  component: () => <Outlet />,
});