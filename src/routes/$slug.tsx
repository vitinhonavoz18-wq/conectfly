import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchSiteBySlug } from "@/lib/site/queries";
import type { SiteData } from "@/lib/site/types";
import { DeliverySite } from "@/components/site/DeliverySite";

export const Route = createFileRoute("/$slug")({
  component: PublicSite,
});

function PublicSite() {
  const { slug: routeSlug } = Route.useParams();
  const [data, setData] = useState<SiteData | null | "loading" | "error">("loading");
  const [mounted, setMounted] = useState(false);

  // Função robusta para detectar o slug da URL atual
  const getDetectedSlug = () => {
    if (typeof window === "undefined") return routeSlug;
    
    // Extrai o slug do pathname (ex: /cheirosaa-pizzaria -> cheirosaa-pizzaria)
    // Remove query params, barras extras e espaços
    const pathname = window.location.pathname;
    const cleanSlug = pathname
      .split('?')[0] // Remove query params se existirem no path (embora incomum)
      .replace(/^\/+|\/+$/g, '') // Remove barras no início e fim
      .trim();
    
    return cleanSlug || routeSlug;
  };

  const detectedSlug = getDetectedSlug();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    console.log("--- DEBUG ACESSO ---");
    console.log("DOMAIN:", window.location.hostname);
    console.log("PATHNAME:", window.location.pathname);
    console.log("SLUG DETECTADO:", detectedSlug);
    console.log("-------------------");

    let alive = true;
    fetchSiteBySlug(detectedSlug)
      .then((d) => {
        console.log("RESULTADO RESTAURANTE:", d?.restaurant ? `Encontrado (ID: ${d.restaurant.id})` : "Não encontrado");
        if (alive) setData(d);
      })
      .catch((err) => {
        console.error("ERRO AO BUSCAR RESTAURANTE:", err);
        if (alive) setData("error");
      });
      
    return () => {
      alive = false;
    };
  }, [detectedSlug, mounted]);

  // Update document title from restaurant
  useEffect(() => {
    if (data && typeof data === "object" && "restaurant" in data) {
      document.title = data.restaurant.name;
    }
  }, [data]);

  if (!mounted) {
    return <div className="min-h-screen bg-background" />;
  }

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
           O endereço /{detectedSlug} não corresponde a nenhum restaurante.
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