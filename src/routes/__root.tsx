 import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
 import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { useEffect } from "react";
import { checkSubdomainRedirect } from "@/lib/utils/hostname";
import {
  getPublicSupabaseConfig,
  setPublicSupabaseConfig,
} from "@/integrations/supabase/publicConfig";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  // Roda no servidor ao montar a página e viaja junto com o HTML, então o
  // navegador já recebe o endereço e a chave do Supabase prontos — sem
  // depender do que estava configurado na máquina que compilou o site.
  loader: () => getPublicSupabaseConfig(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover",
      },
      // Prévia padrão (antes de o cardápio da loja carregar, e quando o link é
      // colado no WhatsApp). O nome da loja entra por cima ao abrir.
      { title: "FlyDelivery — Cardápio digital" },
      { name: "description", content: "Peça direto pelo cardápio digital da loja, com entrega ou retirada." },
      { name: "author", content: "FlyDelivery" },
      { property: "og:site_name", content: "FlyDelivery" },
      { property: "og:title", content: "FlyDelivery — Cardápio digital" },
      { property: "og:description", content: "Peça direto pelo cardápio digital da loja, com entrega ou retirada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "FlyDelivery — Cardápio digital" },
      { name: "twitter:description", content: "Peça direto pelo cardápio digital da loja, com entrega ou retirada." },
      { property: "og:image", content: "https://flydelivery.app/flydelivery-social-preview.jpg" },
      { name: "twitter:image", content: "https://flydelivery.app/flydelivery-social-preview.jpg" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
   // Antes de qualquer tela: guarda o que o servidor mandou. É uma escrita em
   // memória, não estado do React — roda aqui, no corpo do componente raiz,
   // porque o cliente do Supabase só é montado no primeiro uso, que sempre
   // acontece depois deste ponto.
   setPublicSupabaseConfig(Route.useLoaderData());

   useEffect(() => {
     checkSubdomainRedirect();
     // Log inicial para depuração de roteamento (Regra 10)
     console.log(`[Root] Aplicação carregada. Path: ${window.location.pathname}`);
   }, []);

   return (
     <AuthProvider>
       <Outlet />
       <Toaster position="top-center" richColors />
     </AuthProvider>
   );
}
