import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getSubdomain, BASE_DOMAIN } from "@/lib/utils/hostname";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    // No servidor, window é undefined. No TanStack Start, podemos tentar detectar pelo host
    // mas para simplificar e seguir a solicitação do usuário, focamos na lógica de não redirecionar.
    
    if (typeof window === "undefined") {
      // No SSR, evitamos redirecionar se não tivermos certeza, 
      // deixando para o cliente decidir após a hidratação.
      return;
    }
    
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    console.log("--- AUTH CHECK ---");
    console.log("HOSTNAME:", hostname);
    console.log("PATHNAME:", pathname);
    
    // Se o path não for "/" e não for rotas de admin conhecidas (se houvesse outras além de /admin/...)
    // O router já cuida de casar /$slug, mas como _authenticated.index.tsx casa com "/",
    // só precisamos garantir que "/" exija login.
    
    // Todas as rotas sob _authenticated exigem login administrativo
    const { data } = await supabase.auth.getSession();
    
    if (!data.session) {
      console.log("SEM SESSÃO - REDIRECIONANDO PARA LOGIN");
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }

    // Opcional: Validar se o usuário logado é de fato o admin único
    if (data.session.user.email !== 'vitinhonavoz18@gmail.com') {
      console.log("USUÁRIO NÃO AUTORIZADO - LOGOUT");
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }

    console.log("SESSÃO ATIVA PARA ADMIN");
    return;

    // Para outros caminhos, o TanStack Router deve decidir se cai em /$slug (público)
    // ou em outras rotas autenticadas.
    // Como estamos dentro do layout _authenticated, se o path não for "/", 
    // e o componente que casou for descendente de _authenticated, ele passaria por aqui.
    // Mas as rotas /edit/$id etc estão sob _authenticated.
  },
  component: () => <Outlet />,
});