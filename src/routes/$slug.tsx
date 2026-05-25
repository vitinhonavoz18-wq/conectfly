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
  beforeLoad: ({ params, location }) => {
    const slug = params.slug.toLowerCase();
    const isPublicPizzeriaSlug = !ADMIN_PATHS.includes(slug);
    
    console.log(`[Router] Path: ${location.pathname} | isPublicPizzeriaSlug: ${isPublicPizzeriaSlug}`);

    // Se o slug for uma rota administrativa conhecida, redireciona para a raiz (que é protegida)
    if (!isPublicPizzeriaSlug) {
      console.log(`[Router] Rota admin detectada no path: /${params.slug}. Redirecionando para Auth Guard...`);
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
