import { useCart } from "../site/CartContext";
import { TableQrScanButton } from "../site/TableQrScanButton";
import { SiteHero } from "../site/SiteHero";
import { SiteComboSection } from "../site/SiteComboSection";
import { SiteMenuSection } from "../site/SiteMenuSection";
import { SitePizzaSection } from "../site/SitePizzaSection";
import { SiteBeverageSection } from "../site/SiteBeverageSection";
import { SiteCheckout } from "../site/checkout/SiteCheckout";
import { SiteFooter } from "../site/SiteFooter";
import { MenuBusca } from "../site/MenuBusca";
import { MenuDestaques } from "../site/MenuDestaques";
import type { MenuCategoryRow, SiteData } from "@/lib/site/types";
import { getPrimaryButtonText } from "@/lib/site/format";
import { isAdicionaisCategory, isBordasCategory, isExtrasCategory } from "@/lib/site/categoryKinds";
import { resolverLayout, type BlocoDoCardapio } from "@/lib/site/menuLayout";

/**
 * O cardápio montado pelo layout do segmento.
 *
 * Este é o ÚNICO componente que monta a página do cardápio. Ele não sabe o
 * que é uma pizzaria nem uma farmácia: ele lê a receita do layout (a lista de
 * blocos, na ordem) e monta.
 *
 * É por isso que acrescentar um nicho novo no futuro não exige um arquivo
 * novo aqui — só uma linha em `lib/site/menuLayout.ts`. É a diferença entre
 * ter um cardápio impresso por loja e ter um porta-cardápio onde se troca a
 * folha.
 *
 * Todos os blocos leem exatamente os mesmos dados: as mesmas categorias, os
 * mesmos produtos, os mesmos adicionais, o mesmo carrinho. Layout é vitrine,
 * não estoque.
 */
export function SegmentedTemplate({ data }: { data: SiteData }) {
  const { isCartOpen, setCartOpen } = useCart();
  const r = data.restaurant;
  const layout = resolverLayout(r);

  // A separação de categorias é a mesma dos modelos que já existiam — copiar
  // a regra seria arriscar dois cardápios discordarem sobre o que é bebida.
  const isBeverage = (c: MenuCategoryRow & { type?: string }) => {
    const name = c.name.toLowerCase();
    return (
      name.includes("bebida") ||
      name.includes("beverage") ||
      name.includes("drink") ||
      name.includes("refrigerante") ||
      name.includes("catálogo") ||
      c.type === "beverage" ||
      c.type === "BEVERAGE"
    );
  };

  const hasPizzas = data.categories.some((c) => c.is_pizza && (c.pizza_sizes?.length ?? 0) > 0);
  const nonPizzaCategories = data.categories.filter(
    (c) => !c.is_pizza && !isBeverage(c) && !isExtrasCategory(c),
  );
  const bordasCategory = data.categories.find(isBordasCategory);
  const adicionaisCategory = data.categories.find(isAdicionaisCategory);

  const combosVisibility = r.site_settings?.combos_visibility || "auto";
  const hasCombos = data.comboGroups.some((g) => g.combos.length > 0);
  const showCombos = combosVisibility === "always" || (combosVisibility === "auto" && hasCombos);
  const entryMode = r.site_settings?.entry_mode || "navigation";
  const beveragesVisible = r.site_settings?.beverages_visibility !== false;

  // As categorias que a busca e os destaques varrem: tudo que é produto de
  // verdade. Adicionais e bordas ficam de fora — ninguém procura "borda de
  // catupiry" como se fosse um produto do cardápio.
  const categoriasDeProduto = data.categories.filter((c) => !isExtrasCategory(c));

  function montar(bloco: BlocoDoCardapio) {
    switch (bloco) {
      case "capa":
        return (
          <div key="capa" className="site-hero-section">
            <SiteHero
              name={r.name}
              tagline={r.tagline}
              description={r.description}
              logoUrl={r.logo_url}
              heroImageUrl={r.hero_image_url}
              heroMediaType={r.hero_media_type}
              heroVideoUrl={r.hero_video_url}
              buttonText={getPrimaryButtonText(r)}
              showButton={r.site_settings?.show_hero_button !== false}
              hasCombos={hasCombos}
              combosVisibility={combosVisibility}
            />
          </div>
        );

      case "busca":
        return (
          <MenuBusca
            key="busca"
            categorias={categoriasDeProduto}
            restaurant={r}
            layout={layout}
            adicionaisCategory={adicionaisCategory}
          />
        );

      case "populares":
        return (
          <MenuDestaques
            key="populares"
            categorias={categoriasDeProduto}
            restaurant={r}
            layout={layout}
            adicionaisCategory={adicionaisCategory}
          />
        );

      case "pizzas":
        if (!hasPizzas) return null;
        return (
          <div key="pizzas" id="pizzas-container">
            <SitePizzaSection
              categories={data.categories}
              restaurant={r}
              bordasCategory={bordasCategory}
              adicionaisCategory={adicionaisCategory}
              beverages={data.beverages ?? []}
              beverageCatalogs={data.beverageCatalogs}
            />
          </div>
        );

      case "combos":
        if (!showCombos) return null;
        return (
          <div key="combos">
            <SiteComboSection groups={data.comboGroups} />
          </div>
        );

      // "categorias" e "cardapio" saem do mesmo componente: a diferença é o
      // modo de entrada. Em cardápio grande (mercado, farmácia) a pessoa
      // escolhe a categoria antes de ver produto; em cardápio pequeno tudo
      // aparece de uma vez.
      case "categorias":
      case "cardapio": {
        const modoDoBloco =
          bloco === "categorias" ? "navigation" : entryMode === "cards" ? "cards" : entryMode;
        // Com os dois blocos na receita, o primeiro já mostra as categorias e
        // o segundo repetiria a mesma lista.
        if (bloco === "cardapio" && layout.ordem.includes("categorias")) return null;

        return (
          <div key={bloco}>
            <SiteMenuSection
              categories={entryMode === "cards" ? categoriasDeProduto : nonPizzaCategories}
              restaurant={r}
              adicionaisCategory={adicionaisCategory}
              entryMode={modoDoBloco}
              beverages={!hasPizzas ? (data.beverages ?? []) : []}
              beverageCatalogs={data.beverageCatalogs}
            />
          </div>
        );
      }

      case "bebidas": {
        // O cardápio de bebidas já entra dentro do bloco de produtos quando a
        // loja não tem pizza. Repetir aqui mostraria a mesma lista duas vezes.
        if (!beveragesVisible || !hasPizzas) return null;
        const bebidas = data.beverages ?? [];
        if (bebidas.length === 0) return null;
        return (
          <div key="bebidas">
            <SiteBeverageSection
              beverages={bebidas}
              catalogs={data.beverageCatalogs}
              restaurant={r}
            />
          </div>
        );
      }

      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--site-bg))] pb-safe-extra text-[hsl(var(--site-fg))]">
      <main>
        <div className="mx-auto flex max-w-6xl justify-center px-4 pt-6">
          <TableQrScanButton restaurant={r} />
        </div>

        {layout.ordem.map(montar)}
      </main>

      <SiteFooter
        name={r.name}
        phoneDisplay={r.whatsapp_display}
        hours={r.hours}
        address={r.address}
        city={r.city}
      />

      <SiteCheckout
        open={isCartOpen}
        onClose={() => setCartOpen(false)}
        whatsappNumber={r.whatsapp_number}
        restaurantName={r.name}
        deliveryZones={data.deliveryZones ?? []}
        restaurant={r}
      />
    </div>
  );
}
