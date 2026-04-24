import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchSiteBySlug } from "@/lib/site/queries";
import type { SiteData } from "@/lib/site/types";
import { DeliverySite } from "@/components/site/DeliverySite";

export const Route = createFileRoute("/s/$slug")({
  component: PublicSite,
});

function PublicSite() {
  const { slug } = Route.useParams();
  const router = useRouter();
  const [data, setData] = useState<SiteData | null | "loading" | "error">("loading");

  useEffect(() => {
    let alive = true;
    fetchSiteBySlug(slug)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => alive && setData("error"));
    return () => {
      alive = false;
    };
  }, [slug]);

  // Update document title from restaurant
  useEffect(() => {
    if (data && typeof data === "object" && "restaurant" in data) {
      document.title = data.restaurant.name;
    }
  }, [data]);

  if (data === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (data === "error" || data === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4 text-center">
        <h1 className="text-3xl font-black">Site não encontrado</h1>
        <p className="text-muted-foreground">
          O endereço /s/{slug} não corresponde a nenhum restaurante.
        </p>
        <Link
          to="/"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold"
        >
          Voltar
        </Link>
      </div>
    );
  }

  return <DeliverySite data={data} />;
}