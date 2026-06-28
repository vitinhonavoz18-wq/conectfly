 import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
 import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { useEffect } from "react";
import { checkSubdomainRedirect } from "@/lib/utils/hostname";

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
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover",
      },
      { title: "CONECTFLY EMPRESARIAL" },
      { name: "description", content: "O futuro começa aqui" },
      { name: "author", content: "SiteCreatorFly" },
      { property: "og:title", content: "CONECTFLY EMPRESARIAL" },
      { property: "og:description", content: "O futuro começa aqui" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "CONECTFLY EMPRESARIAL" },
      { name: "twitter:description", content: "O futuro começa aqui" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/75e080c6-c0b8-42da-bc3d-fd2c3abf4b64/id-preview-d7ba83c7--eeff7af8-ac85-41f1-a86d-80cbb25eeee0.lovable.app-1777036804868.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/75e080c6-c0b8-42da-bc3d-fd2c3abf4b64/id-preview-d7ba83c7--eeff7af8-ac85-41f1-a86d-80cbb25eeee0.lovable.app-1777036804868.png" },
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
    <html lang="en">
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
