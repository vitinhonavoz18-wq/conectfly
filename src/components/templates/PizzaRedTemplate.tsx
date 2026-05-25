import { useCart } from "../site/CartContext";
import { SiteHeader } from "../site/SiteHeader";
import { SiteHero } from "../site/SiteHero";
import { SiteComboSection } from "../site/SiteComboSection";
import { SiteMenuSection } from "../site/SiteMenuSection";
import { SitePizzaSection } from "../site/SitePizzaSection";
import { SiteCartDrawer } from "../site/SiteCartDrawer";
import { SiteFooter } from "../site/SiteFooter";
import type { SiteData } from "@/lib/site/types";

export function PizzaRedTemplate({ data }: { data: SiteData }) {
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
    ["--site-bg" as string]: "0 0% 100%", // White
    ["--site-fg" as string]: "0 0% 7%", // Black
    ["--site-card" as string]: "0 0% 100%", // White
    ["--site-border" as string]: "0 100% 90%", // Light red border
    ["--site-muted" as string]: "0 100% 98%", // Very light red
    ["--site-muted-fg" as string]: "0 0% 40%",
    ["--site-primary" as string]: "0 84% 45%", // Deep Red #E50914
  };

  return (
    <div style={style as any} className="min-h-screen text-[hsl(var(--site-fg))] bg-[hsl(var(--site-bg))]">
      <style dangerouslySetInnerHTML={{ __html: `
        header {
          background: #E50914 !important;
          color: white !important;
          border-bottom: none !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        header * {
          color: white !important;
        }
        .card-premium {
          background: white !important;
          border-color: #fecaca !important; /* red-200 */
          border-radius: 1.5rem !important;
          color: #1a1a1a !important;
          box-shadow: 0 4px 12px rgba(229, 9, 20, 0.05) !important;
        }
        .btn-premium {
          background: #E50914 !important;
          color: white !important;
          border-radius: 9999px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
        }
        .text-primary {
          color: #E50914 !important;
        }
        .bg-primary {
          background-color: #E50914 !important;
        }
        .text-secondary {
          color: #C80000 !important;
        }
        footer {
          background: #111 !important;
          color: white !important;
        }
        .site-hero-section {
          background: #f8f8f8;
          border-bottom: 4px solid #E50914;
        }
        h1, h2, h3, h4 {
          font-family: 'Space Grotesk', sans-serif !important;
          font-weight: 800 !important;
        }
        .site-hero-section h1 {
          color: #E50914 !important;
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
        <div id="pizzas-container" className="py-12 bg-white">
          <SitePizzaSection 
            categories={data.categories} 
            restaurant={r} 
            bordasCategory={bordasCategory}
            beverages={data.beverages ?? []}
          />
        </div>

        <div className="bg-slate-50 py-12">
          <SiteComboSection groups={data.comboGroups} />
        </div>
        <div className="bg-white py-12">
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
