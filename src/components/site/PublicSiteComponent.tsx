import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { fetchSiteBySlug } from "@/lib/site/queries";
import type { SiteData } from "@/lib/site/types";
import { DeliverySite } from "@/components/site/DeliverySite";
import { getPizzeriaIdentifier } from "@/lib/utils/hostname";

interface Props {
  routeSlug?: string;
}

export function PublicSiteComponent({ routeSlug }: Props) {
  const detectedIdentifier = getPizzeriaIdentifier(routeSlug);
  const [data, setData] = useState<SiteData | null | "loading" | "error">("loading");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (import.meta.env.DEV) {
      console.log("--- DEBUG ACESSO ---");
      console.log("DOMAIN:", window.location.hostname);
      console.log("PATHNAME:", window.location.pathname);
      console.log("IDENTIFIER DETECTADO:", detectedIdentifier);
      console.log("-------------------");
    }

    let alive = true;
    fetchSiteBySlug(detectedIdentifier)
      .then((d) => {
        if (import.meta.env.DEV) {
          console.log("RESULTADO RESTAURANTE:", d?.restaurant ? `Encontrado (ID: ${d.restaurant.id})` : "Não encontrado");
        }
        if (alive) setData(d);
      })
      .catch((err) => {
        console.error("ERRO AO BUSCAR RESTAURANTE:", err);
        if (alive) setData("error");
      });
      
    return () => {
      alive = false;
    };
  }, [detectedIdentifier, mounted]);

  // Update document title and canonical from restaurant
  useEffect(() => {
    if (data && typeof data === "object" && "restaurant" in data) {
      document.title = data.restaurant.name;
      
      // Handle canonical link
      const subdomain = data.restaurant.custom_subdomain;
      if (subdomain) {
        const canonicalUrl = `https://${subdomain}.conectfly.com.br`;
        let link: HTMLLinkElement | null = document.querySelector("link[rel='canonical']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "canonical";
          document.head.appendChild(link);
        }
        link.href = canonicalUrl;
      }
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
        <h1 className="text-3xl font-black">Pizzaria não encontrada</h1>
         <p className="text-muted-foreground">
           Não encontramos nenhuma pizzaria ativa no endereço <strong>{detectedIdentifier}</strong>.
         </p>
         <p className="text-sm text-muted-foreground max-w-sm">
           Verifique se o nome está correto ou se a pizzaria já publicou o cardápio.
         </p>
        <Link
          to="/"
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:scale-105 transition-transform"
        >
          Ir para a página inicial
        </Link>
      </div>
    );
  }

  return <DeliverySite data={data} />;
}
