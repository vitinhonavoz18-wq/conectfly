import { useCart } from "../site/CartContext";
import { SiteHeader } from "../site/SiteHeader";
import { SiteHero } from "../site/SiteHero";
import { SiteComboSection } from "../site/SiteComboSection";
import { SiteMenuSection } from "../site/SiteMenuSection";
import { SitePizzaSection } from "../site/SitePizzaSection";
import { SiteBeverageSection } from "../site/SiteBeverageSection";
import { SiteCartDrawer } from "../site/SiteCartDrawer";
import { SiteFooter } from "../site/SiteFooter";
import type { SiteData } from "@/lib/site/types";
import { getPrimaryButtonText } from "@/lib/site/format";

export function WhiteTemplate({ data }: { data: SiteData }) {
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
  
  const nonPizzaCategories = data.categories.filter((c) => !c.is_pizza && !isBeverage(c) && !isBordas(c));
  const bordasCategory = data.categories.find(isBordas);


  const combosVisibility = r.site_settings?.combos_visibility || "auto";
  const hasCombos = data.comboGroups.some(g => g.combos.length > 0);
  const showCombos = combosVisibility === "always" || (combosVisibility === "auto" && hasCombos);
  const entryMode = r.site_settings?.entry_mode || "navigation";

  const beveragesVisible = r.site_settings?.beverages_visibility !== false;
  const beveragesPosition = r.site_settings?.beverages_position || "end";

  const renderBeverages = () => (
    (beveragesVisible && data.beverages && data.beverages.length > 0) && (
      <div className="py-12 px-4 border-t border-[hsl(var(--site-border))] bg-[hsl(var(--site-muted))]">
        <div className="max-w-6xl mx-auto">
          <SiteBeverageSection beverages={data.beverages} catalogs={data.beverageCatalogs} restaurant={r} />
        </div>
      </div>
    )
  );

  return (
    <div className="min-h-screen text-[hsl(var(--site-fg))] bg-[hsl(var(--site-bg))]">
      <SiteHeader 
        name={r.name} 
        logoUrl={r.logo_url} 
        onOpenCart={() => setCartOpen(true)} 
        showCartButton={r.site_settings?.show_cart_button !== false}
      />
      <main>
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
        <div id="pizzas-container">
          <SitePizzaSection 
            categories={data.categories} 
            restaurant={r} 
            bordasCategory={bordasCategory}
            beverages={data.beverages ?? []}
          />
        </div>

        {beveragesPosition === "after_products" && renderBeverages()}

        {showCombos && (
          <div>
            <SiteComboSection groups={data.comboGroups} />
          </div>
        )}

        {beveragesPosition === "after_combos" && renderBeverages()}

        <div>
          <SiteMenuSection 
            categories={nonPizzaCategories} 
            restaurant={r} 
            entryMode={entryMode}
          />
        </div>

        {beveragesPosition === "end" && renderBeverages()}
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
