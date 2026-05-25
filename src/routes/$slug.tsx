import { createFileRoute, redirect } from "@tanstack/react-router";
import { PublicSiteComponent } from "@/components/site/PublicSiteComponent";

const ADMIN_PATHS = [
  "admin",
  "dashboard",
  "settings",
  "create",
  "restaurants",
  "pizzerias",
  "templates",
  "configuracoes"
];

export const Route = createFileRoute("/$slug")({
  beforeLoad: ({ params }) => {
    // Se o slug for uma rota administrativa conhecida, redireciona para a raiz (que é protegida)
    if (ADMIN_PATHS.includes(params.slug.toLowerCase())) {
      console.log(`[Router] Rota admin detectada no path: /${params.slug}. Redirecionando...`);
      throw redirect({ to: "/" });
    }
  },
  component: PublicSite,
  loader: async ({ params }) => {
    return { slug: params.slug };
  }
});

function PublicSite() {
  const { slug } = Route.useParams();
  return <PublicSiteComponent routeSlug={slug} />;
}
