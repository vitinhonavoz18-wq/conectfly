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
    const subdomain = getSubdomain();
    
    console.log("--- AUTH BEFORE_LOAD ---");
    console.log("HOSTNAME:", hostname);
    console.log("SUBDOMAIN:", subdomain);
    console.log("PATHNAME:", window.location.pathname);
    
    // Se estiver em um subdomínio válido, NUNCA redireciona para login
    if (subdomain) {
      console.log("SUBDOMÍNIO DETECTADO - MANTENDO NA PÁGINA PÚBLICA");
      return;
    }

    // Se estiver no domínio principal mas acessando um slug (ex: conectfly.com.br/slug)
    // O router vai casar com /$slug e não com /_authenticated/ (que é "/")
    // Mas para garantir, se o path não for "/" e estivermos no domínio base, não forçamos login
    if (window.location.pathname !== "/" && (hostname === BASE_DOMAIN || hostname === "localhost")) {
       console.log("ACESSANDO SLUG NO DOMÍNIO PRINCIPAL - MANTENDO");
       return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      console.log("SEM SESSÃO - REDIRECIONANDO PARA LOGIN");
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    
    console.log("SESSÃO ATIVA - ACESSO PERMITIDO AO PAINEL");
  },
  component: () => <Outlet />,
});