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
    ["--site-bg" as string]: "30 100% 99%", // #FFF9F6 (aprox)
    ["--site-fg" as string]: "0 0% 7%", // #111111
    ["--site-card" as string]: "0 0% 100%", // White
    ["--site-border" as string]: "24 25% 91%", // #EFE7E2
    ["--site-muted" as string]: "24 25% 98%", 
    ["--site-muted-fg" as string]: "0 0% 33%", // #555555
    ["--site-primary" as string]: "358 92% 46%", // #E50914
    ["--site-secondary" as string]: "39 68% 55%", // #D9A441 (Premium Gold)
  };

  return (
    <div style={style as any} className="min-h-screen text-[hsl(var(--site-fg))] bg-[hsl(var(--site-bg))] font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800&display=swap');
        
        body {
          background-color: #FFF9F6 !important;
          color: #111111 !important;
        }

        header {
          background: #E50914 !important;
          color: white !important;
          border-bottom: none !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12) !important;
        }

        header * {
          color: white !important;
        }

        .bg-gradient-gold {
          background: linear-gradient(135deg, #D9A441, #B8860B) !important;
        }

        .bg-gradient-red {
          background: linear-gradient(135deg, #E50914, #B80000) !important;
        }

        .card-premium {
          background: white !important;
          border: 1px solid #EFE7E2 !important;
          border-radius: 1.5rem !important;
          color: #111111 !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04) !important;
          transition: all 0.3s ease !important;
        }
        
        .card-premium:hover {
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08) !important;
          transform: translateY(-2px) !important;
        }

        .btn-premium-gold {
          background: linear-gradient(135deg, #D9A441, #B8860B) !important;
          color: white !important;
          box-shadow: 0 8px 25px rgba(217, 164, 65, 0.25) !important;
          border-radius: 9999px !important;
          font-weight: 800 !important;
          transition: all 0.3s ease !important;
        }

        .btn-premium-red {
          background: linear-gradient(135deg, #E50914, #B80000) !important;
          color: white !important;
          box-shadow: 0 12px 30px rgba(229, 9, 20, 0.30) !important;
          border-radius: 9999px !important;
          font-weight: 800 !important;
          transition: all 0.3s ease !important;
        }

        .btn-premium-red:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 15px 35px rgba(229, 9, 20, 0.40) !important;
        }

        .text-gold {
          color: #D9A441 !important;
        }

        .text-primary {
          color: #E50914 !important;
        }

        .bg-primary {
          background-color: #E50914 !important;
        }

        footer {
          background: #111 !important;
          color: white !important;
        }

        .site-hero-section {
          background: #FFF9F6;
          border-bottom: 6px solid #E50914;
        }

        h1, h2, h3, h4 {
          font-family: 'Space Grotesk', sans-serif !important;
          font-weight: 800 !important;
          letter-spacing: -0.02em !important;
        }

        .site-hero-section h1 {
          color: #E50914 !important;
        }

        .stepper-btn {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .stepper-btn-minus {
          background: #F3F4F6 !important;
          color: #9CA3AF !important;
        }

        .stepper-btn-plus {
          background: #E50914 !important;
          color: white !important;
        }

        .stepper-count {
          background: white !important;
          color: #111 !important;
          font-weight: 700 !important;
          min-width: 32px;
          text-align: center;
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
