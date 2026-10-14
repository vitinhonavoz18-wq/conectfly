import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { storeRedirectTarget } from "@/lib/site/storeAddress";
import { getPizzeriaPublicUrl } from "@/lib/site/format";
import { fetchSiteBySlug } from "@/lib/site/queries";
import type { SiteData } from "@/lib/site/types";
import { DeliverySite } from "@/components/site/DeliverySite";
import { getPizzeriaIdentifier, getSubdomain } from "@/lib/utils/hostname";

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

  const navigate = useNavigate();

  useEffect(() => {
    if (!mounted) return;

    // Acabamos de trocar a barra de endereço para o endereço atual desta
    // mesma loja (ver abaixo): o cardápio já está na tela, não busca de novo.
    if (
      data &&
      typeof data === "object" &&
      storeRedirectTarget(detectedIdentifier, data.restaurant) === null
    ) {
      return;
    }

    // LOGS OBRIGATÓRIOS (Conforme solicitado)
    console.log("--- DEBUG PUBLIC SITE ---");
    console.log("HOST:", window.location.hostname);
    console.log("PATH:", window.location.pathname);
    console.log("IS SUBDOMAIN:", !!getSubdomain());
    console.log("SUBDOMAIN:", getSubdomain());
    console.log("IDENTIFIER DETECTADO:", detectedIdentifier);
    console.log("-------------------------");

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
    // `data` fica de fora de propósito: a busca só deve rodar quando o
    // endereço muda, não quando o cardápio chega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedIdentifier, mounted]);

  // Update document title and canonical from restaurant
  useEffect(() => {
    if (data && typeof data === "object" && "restaurant" in data) {
      document.title = data.restaurant.name;
      
      // Chegou por um endereço que não é o atual da loja (o longo de teste,
      // ou um nome que ela usava antes)? Mostra a loja e troca a barra de
      // endereço para o nome atual, mantendo o resto (?mesa=..., #...).
      // É o cartaz antigo na porta com "mudamos para cá": quem chega pelo
      // endereço velho entra do mesmo jeito.
      const destino = storeRedirectTarget(detectedIdentifier, data.restaurant);
      if (destino && routeSlug) {
        void navigate({
          to: "/$slug",
          params: { slug: destino },
          search: (anterior: any) => anterior,
          hash: (anterior: any) => anterior,
          replace: true,
        } as any);
      }

      // Handle canonical link
      const canonicalUrl = getPizzeriaPublicUrl(
        data.restaurant.slug,
        data.restaurant.custom_subdomain,
      );
      let link: HTMLLinkElement | null = document.querySelector("link[rel='canonical']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonicalUrl;
    }
  }, [data, detectedIdentifier, navigate, routeSlug]);

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
        <h1 className="text-3xl font-black">Loja não encontrada</h1>
         <p className="text-muted-foreground">
           Não encontramos nenhum estabelecimento ativo no endereço <strong>{detectedIdentifier}</strong>.
         </p>
         <p className="text-sm text-muted-foreground max-w-sm">
           Verifique se o nome está correto ou se o estabelecimento já publicou o cardápio.
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
