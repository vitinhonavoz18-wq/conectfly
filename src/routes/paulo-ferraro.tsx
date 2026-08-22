import { createFileRoute } from "@tanstack/react-router";
import { PauloFerraroSite } from "@/components/paulo-ferraro/PauloFerraroSite";
import { fotoHero, imagemCompartilhamento } from "@/components/paulo-ferraro/assets";
import { cidade, perfil, seo } from "@/components/paulo-ferraro/content";
import { dadosEstruturados, urlAbsoluta } from "@/components/paulo-ferraro/seo";

// Folha de estilo exclusiva do site do advogado. Ela carrega só nesta página:
// quem abre o painel do SiteCreatorFly não baixa nada disso.
import pfCss from "@/components/paulo-ferraro/theme.css?url";
import favicon from "@/assets/paulo-ferraro-favicon.svg?url";

/**
 * Endereço do site: /paulo-ferraro
 *
 * Rotas com nome fixo têm prioridade sobre a rota curinga `/$slug` usada pelos
 * sites de restaurante — ou seja, este endereço nunca será confundido com o
 * slug de um cliente do SiteCreatorFly.
 *
 * O QUE ESTA PÁGINA ANUNCIA PARA O MUNDO
 *
 * Tudo que aparece quando alguém compartilha o link no WhatsApp ou encontra o
 * site no Google é montado aqui. A regra é a mesma do resto do projeto: nada
 * inventado. Onde falta informação — o domínio, a imagem de compartilhamento —
 * o site simplesmente não anuncia aquele item, em vez de anunciar algo errado.
 */

const urlDaPagina = urlAbsoluta();
const urlImagem = imagemCompartilhamento
  ? (urlAbsoluta(imagemCompartilhamento) ?? imagemCompartilhamento)
  : undefined;

export const Route = createFileRoute("/paulo-ferraro")({
  head: () => ({
    meta: [
      { title: seo.titulo },
      { name: "description", content: seo.descricao },
      { name: "author", content: perfil.nome },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "theme-color", content: "#1e1e21" },
      { name: "geo.region", content: `${cidade.pais}-${cidade.estado}` },
      { name: "geo.placename", content: cidade.nome },

      // Open Graph — usado por WhatsApp, Facebook, Instagram e LinkedIn.
      { property: "og:site_name", content: `${perfil.nome} — ${perfil.titulo}` },
      { property: "og:title", content: seo.titulo },
      { property: "og:description", content: seo.descricao },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      ...(urlDaPagina ? [{ property: "og:url", content: urlDaPagina }] : []),
      // A base do sistema anuncia uma imagem de compartilhamento do
      // SiteCreatorFly. Sem esta linha, mandar o link do advogado no WhatsApp
      // mostraria a captura de tela de OUTRO produto — como emprestar o
      // cartão de visita do vizinho. Enquanto a imagem definitiva não chega, o
      // site prefere anunciar imagem nenhuma: o link aparece limpo, só com
      // título e descrição.
      urlImagem
        ? { property: "og:image", content: urlImagem }
        : { property: "og:image", content: "" },
      ...(urlImagem
        ? [
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            { property: "og:image:alt", content: `${perfil.nome}, ${perfil.titulo}` },
          ]
        : []),

      // X / Twitter. Sem imagem, o cartão grande viraria um retângulo vazio —
      // então o formato cai para o resumo simples.
      { name: "twitter:card", content: urlImagem ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: seo.titulo },
      { name: "twitter:description", content: seo.descricao },
      { name: "twitter:image", content: urlImagem ?? "" },
      // Mesma limpeza: a base anuncia o perfil de outra empresa no X.
      { name: "twitter:site", content: "" },
    ],
    links: [
      { rel: "stylesheet", href: pfCss },
      { rel: "icon", type: "image/svg+xml", href: favicon },

      // Endereço oficial da página. Só é declarado quando o domínio existe:
      // apontar para um endereço errado é pior do que não apontar para nenhum.
      ...(urlDaPagina ? [{ rel: "canonical", href: urlDaPagina }] : []),

      // As duas fontes que aparecem já na primeira tela são pedidas antes de o
      // navegador descobrir sozinho que precisa delas. Sem isso, ele só as
      // encontra depois de ler a folha de estilo inteira — e o nome do
      // advogado aparece na letra do sistema antes de trocar pela definitiva.
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/fontes/cormorant-garamond-500-latin.woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/fontes/manrope-400-latin.woff2",
        crossOrigin: "anonymous",
      },

      // A fotografia do advogado é o maior elemento da primeira tela — é ela
      // que o Google cronometra para dizer se a página abriu rápido. Pedi-la
      // com antecedência é o equivalente a deixar o prato principal já no
      // forno quando o cliente senta.
      ...(fotoHero
        ? [{ rel: "preload", as: "image", href: fotoHero, fetchPriority: "high" as const }]
        : []),
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: dadosEstruturados(),
      },
    ],
  }),
  component: PaginaPauloFerraro,
});

function PaginaPauloFerraro() {
  return <PauloFerraroSite />;
}
