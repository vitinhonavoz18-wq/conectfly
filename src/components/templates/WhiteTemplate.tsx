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
    return name === "bebidas" || name === "bebida" || name === "beverages" || name === "drinks" || name === "bebibas";
  };
  
  const isBordas = (c: any) => {
    const name = c.name.toLowerCase();
    return name === "bordas recheadas" || name === "borda recheada" || name === "bordas" || name === "borda";
  };
  
  const nonPizzaCategories = data.categories.filter((c) => !c.is_pizza && !isBeverage(c) && !isBordas(c));
  const bordasCategory = data.categories.find(isBordas);

  const style = {
    ["--site-bg" as string]: "0 0% 98%", // #FAFAFA
    ["--site-fg" as string]: "222 47% 11%", // #0f172a
    ["--site-card" as string]: "0 0% 100%", // White
    ["--site-border" as string]: "214 32% 91%", // #e2e8f0
    ["--site-muted" as string]: "210 40% 96%", // #f1f5f9
    ["--site-muted-fg" as string]: "215 16% 47%", // #64748b
  };

  const combosVisibility = r.site_settings?.combos_visibility || "auto";
  const hasCombos = data.comboGroups.some(g => g.combos.length > 0);
  const showCombos = combosVisibility === "always" || (combosVisibility === "auto" && hasCombos);
  const entryMode = r.site_settings?.entry_mode || "navigation";

  return (
    <div style={style as any} className="min-h-screen text-[hsl(var(--site-fg))] bg-[hsl(var(--site-bg))]">
      <style dangerouslySetInnerHTML={{ __html: `
        .card-premium {
          background: hsl(var(--site-card)) !important;
          border-color: hsl(var(--site-border)) !important;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
          color: hsl(var(--site-fg)) !important;
        }
        header {
          background: rgba(255, 255, 255, 0.8) !important;
          border-bottom: 1px solid hsl(var(--site-border)) !important;
          backdrop-blur: 10px;
        }
        header * {
          color: hsl(var(--site-fg)) !important;
        }
        footer {
          background: hsl(var(--site-muted)) !important;
          border-top: 1px solid hsl(var(--site-border)) !important;
          color: hsl(var(--site-fg)) !important;
        }
        .text-muted-foreground {
          color: hsl(var(--site-muted-fg)) !important;
        }
        .site-hero-section {
          background: #ffffff;
        }
        .bg-black\\/40 {
          background-color: rgba(241, 245, 249, 0.8) !important;
        }
        .border-white\\/10 {
          border-color: hsl(var(--site-border)) !important;
        }
      `}} />
      <SiteHeader name={r.name} logoUrl={r.logo_url} onOpenCart={() => setCartOpen(true)} />
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

        {showCombos && (
          <div>
            <SiteComboSection groups={data.comboGroups} />
          </div>
        )}
        <div>
          <SiteMenuSection 
            categories={nonPizzaCategories} 
            restaurant={r} 
            entryMode={entryMode}
          />
        </div>
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
