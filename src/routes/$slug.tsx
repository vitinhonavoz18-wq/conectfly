import { createFileRoute } from "@tanstack/react-router";
import { PublicSiteComponent } from "@/components/site/PublicSiteComponent";

export const Route = createFileRoute("/$slug")({
  component: PublicSite,
  loader: async ({ params }) => {
    return { slug: params.slug };
  }
});

function PublicSite() {
  const { slug } = Route.useParams();
  return <PublicSiteComponent routeSlug={slug} />;
}
