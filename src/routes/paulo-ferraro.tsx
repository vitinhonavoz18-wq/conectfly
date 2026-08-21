import { createFileRoute } from "@tanstack/react-router";
import { PauloFerraroSite } from "@/components/paulo-ferraro/PauloFerraroSite";
import { seo } from "@/components/paulo-ferraro/content";

// Folha de estilo exclusiva do site do advogado. Ela carrega só nesta página:
// quem abre o painel do SiteCreatorFly não baixa nada disso.
import pfCss from "@/components/paulo-ferraro/theme.css?url";

/**
 * Endereço do site: /paulo-ferraro
 *
 * Rotas com nome fixo têm prioridade sobre a rota curinga `/$slug` usada pelos
 * sites de restaurante — ou seja, este endereço nunca será confundido com o
 * slug de um cliente do SiteCreatorFly.
 */
export const Route = createFileRoute("/paulo-ferraro")({
  head: () => ({
    meta: [
      { title: seo.titulo },
      { name: "description", content: seo.descricao },
      { name: "author", content: "Paulo Ferraro" },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: seo.titulo },
      { property: "og:description", content: seo.descricao },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: seo.titulo },
      { name: "twitter:description", content: seo.descricao },
      { name: "theme-color", content: "#1a1a1c" },
    ],
    links: [
      { rel: "stylesheet", href: pfCss },
      // As fontes vêm do Google Fonts. O `preconnect` avisa o navegador para
      // já abrir a conexão enquanto o resto da página carrega — como pedir a
      // conta antes de terminar a sobremesa: ninguém espera parado no fim.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Manrope:wght@300;400;500;600;700;800&display=swap",
      },
    ],
  }),
  component: PaginaPauloFerraro,
});

function PaginaPauloFerraro() {
  return <PauloFerraroSite />;
}
