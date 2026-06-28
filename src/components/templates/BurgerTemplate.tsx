import { useCart } from "../site/CartContext";
import { SiteHeader } from "../site/SiteHeader";
import { TableQrScanButton } from "../site/TableQrScanButton";
import { SiteHero } from "../site/SiteHero";
import { SiteComboSection } from "../site/SiteComboSection";
import { SiteMenuSection } from "../site/SiteMenuSection";
import { SitePizzaSection } from "../site/SitePizzaSection";
import { SiteCartDrawer } from "../site/SiteCartDrawer";
import { SiteFooter } from "../site/SiteFooter";
import type { SiteData } from "@/lib/site/types";
import { getPrimaryButtonText } from "@/lib/site/format";

export function BurgerTemplate({ data }: { data: SiteData }) {
  const { isCartOpen, setCartOpen } = useCart();
  const r = data.restaurant;
  
  const isBeverage = (c: any) => {
    const name = c.name.toLowerCase();
    const isBev = name.includes("bebida") || 
                  name.includes("beverage") || 
                  name.includes("drink") || 
                  name.includes("refrigerante") ||
                  name.includes("catálogo") ||
                  c.type === 'beverage' ||
                  c.type === 'BEVERAGE';
    return isBev;
  };

  
  const isBordas = (c: any) => {
    const name = c.name.toLowerCase();
    return name === "bordas recheadas" || name === "borda recheada" || name === "bordas" || name === "borda";
  };
  
  const hasPizzas = data.categories.some((c) => c.is_pizza && (c.pizza_sizes?.length ?? 0) > 0);
  const nonPizzaCategories = data.categories.filter((c) => !c.is_pizza && !isBeverage(c) && !isBordas(c));
  const bordasCategory = data.categories.find(isBordas);

  const combosVisibility = r.site_settings?.combos_visibility || "auto";
  const hasCombos = data.comboGroups.some(g => g.combos.length > 0);
  const showCombos = combosVisibility === "always" || (combosVisibility === "auto" && hasCombos);
  const entryMode = r.site_settings?.entry_mode || "navigation";
  const cardsCategories = data.categories.filter((c) => !isBordas(c) && !isBeverage(c));

  return (
    <div className="min-h-screen text-[hsl(var(--site-fg))] bg-[hsl(var(--site-bg))] pb-safe-extra">
      <SiteHeader 
        name={r.name} 
        logoUrl={r.logo_url} 
        onOpenCart={() => setCartOpen(true)} 
        showCartButton={r.site_settings?.show_cart_button !== false}
      />
      <main>
        <div className="max-w-6xl mx-auto px-4 pt-6 flex justify-center">
          <TableQrScanButton restaurant={r} />
        </div>
        <div className="site-hero-section">
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
        {entryMode === "cards" ? (
          <div className="py-8">
            <SiteMenuSection
              categories={cardsCategories}
              restaurant={r}
              entryMode="cards"
              beverages={data.beverages ?? []}
              beverageCatalogs={data.beverageCatalogs}
            />
          </div>
        ) : (
          <>
            <div id="pizzas-container" className="py-8">
              <SitePizzaSection
                categories={data.categories}
                restaurant={r}
                bordasCategory={bordasCategory}
                beverages={data.beverages ?? []}
                beverageCatalogs={data.beverageCatalogs}
              />
            </div>

            {showCombos && (
              <div className="py-8">
                <SiteComboSection groups={data.comboGroups} />
              </div>
            )}

            <div className="py-8">
              <SiteMenuSection
                categories={nonPizzaCategories}
                restaurant={r}
                entryMode={entryMode}
                beverages={!hasPizzas ? (data.beverages ?? []) : []}
                beverageCatalogs={data.beverageCatalogs}
              />
            </div>
          </>
        )}
      </main>
      <SiteFooter
        name={r.name}
        phoneDisplay={r.whatsapp_display}
        hours={r.hours}
        address={r.address}
        city={r.city}
      />

      <SiteCartDrawer
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
