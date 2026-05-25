import { useCart } from "../site/CartContext";
import { SiteHeader } from "../site/SiteHeader";
import { SiteHero } from "../site/SiteHero";
import { SiteComboSection } from "../site/SiteComboSection";
import { SiteMenuSection } from "../site/SiteMenuSection";
import { SitePizzaSection } from "../site/SitePizzaSection";
import { SiteCartDrawer } from "../site/SiteCartDrawer";
import { SiteFooter } from "../site/SiteFooter";
import type { SiteData } from "@/lib/site/types";

export function BurgerTemplate({ data }: { data: SiteData }) {
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
    ["--site-bg" as string]: "210 20% 98%", // Off-white/Gray
    ["--site-fg" as string]: "0 0% 10%", // Black
    ["--site-card" as string]: "0 0% 100%", // White
    ["--site-border" as string]: "45 100% 90%", // Light yellow
    ["--site-muted" as string]: "0 0% 95%",
    ["--site-muted-fg" as string]: "0 0% 45%",
    ["--site-primary" as string]: "35 100% 43%", // #D99000 Burger Yellow/Orange
  };

  return (
    <div style={style as any} className="min-h-screen text-[hsl(var(--site-fg))] bg-[hsl(var(--site-bg))]">
      <style dangerouslySetInnerHTML={{ __html: `
        header {
          background: #111111 !important;
          color: white !important;
        }
        header * {
          color: white !important;
        }
        .card-premium {
          background: white !important;
          border-radius: 1rem !important;
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05) !important;
        }
        .btn-premium {
          background: #D99000 !important;
          color: white !important;
          border-radius: 0.5rem !important;
          font-weight: 700 !important;
        }
        .site-hero-section {
          background: #111111;
          color: white;
        }
        .site-hero-section h1 {
          color: #D99000 !important;
        }
        .site-hero-section p {
          color: #9ca3af !important;
        }
        footer {
          background: #111111 !important;
          color: white !important;
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
          />
        </div>
        <div id="pizzas-container" className="py-8">
          <SitePizzaSection 
            categories={data.categories} 
            restaurant={r} 
            bordasCategory={bordasCategory}
            beverages={data.beverages ?? []}
          />
        </div>

        <div className="py-8">
          <SiteComboSection groups={data.comboGroups} />
        </div>
        <div className="py-8">
          <SiteMenuSection categories={nonPizzaCategories} restaurant={r} />
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
