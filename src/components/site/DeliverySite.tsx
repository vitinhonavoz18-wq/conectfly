import { useState, useEffect } from "react";
import { CartProvider, useCart } from "./CartContext";
import { SiteThemeWrapper } from "./SiteThemeWrapper";
import { SiteHeader } from "./SiteHeader";
import { SiteHero } from "./SiteHero";
import { SiteComboSection } from "./SiteComboSection";
import { SiteMenuSection } from "./SiteMenuSection";
import { SitePizzaSection } from "./SitePizzaSection";
import { SiteCartDrawer } from "./SiteCartDrawer";
import { SiteFooter } from "./SiteFooter";
import { Reveal, ScrollProgress, SectionScroll } from "./Reveal";
import { SiteBeverageSection } from "./SiteBeverageSection";
import type { SiteData } from "@/lib/site/types";

function DeliverySiteContent({ data }: { data: SiteData }) {
  const { totalItems, totalPrice, isCartOpen, setCartOpen } = useCart();
  const r = data.restaurant;
  const isBeverage = (c: any) => {
    const name = c.name.toLowerCase();
    return name === "bebidas" || name === "bebida" || name === "beverages" || name === "drinks" || name === "bebibas";
  };
  const nonPizzaCategories = data.categories.filter((c) => !c.is_pizza && !isBeverage(c));
  const hasBeverages = data.beverages && data.beverages.length > 0;

  // Monitor if header is visible to show/hide floating cart
  const [headerVisible, setHeaderVisible] = useState(true);
  useEffect(() => {
    const handleScroll = () => setHeaderVisible(window.scrollY < 200);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <ScrollProgress />
      <SiteHeader name={r.name} logoUrl={r.logo_url} onOpenCart={() => setCartOpen(true)} />
      <main>
        <SectionScroll className="site-hero-section">
          <SiteHero
            name={r.name}
            tagline={r.tagline}
            description={r.description}
            logoUrl={r.logo_url}
            heroImageUrl={r.hero_image_url}
            heroMediaType={r.hero_media_type}
            heroVideoUrl={r.hero_video_url}
          />
        </SectionScroll>
        <SectionScroll id="pizzas-container">
          <Reveal variant="fade-up">
            <div className="site-scroll-rise">
              <SitePizzaSection categories={data.categories} restaurant={r} />
            </div>
          </Reveal>
        </SectionScroll>

        {hasBeverages && (
          <SectionScroll id="beverages-container">
            <Reveal variant="fade-up" delay={50}>
              <div className="site-scroll-rise px-4 pb-14">
                <div className="max-w-6xl mx-auto">
                  <SiteBeverageSection beverages={data.beverages!} restaurant={r} />
                </div>
              </div>
            </Reveal>
          </SectionScroll>
        )}
        <SectionScroll>
          <Reveal variant="fade-up" delay={80}>
            <div className="site-scroll-rise">
              <SiteComboSection groups={data.comboGroups} />
            </div>
          </Reveal>
        </SectionScroll>
        <SectionScroll>
          <Reveal variant="fade-up" delay={80}>
            <div className="site-scroll-rise">
              <SiteMenuSection categories={nonPizzaCategories} restaurant={r} />
            </div>
          </Reveal>
        </SectionScroll>
      </main>
      <Reveal variant="fade">
        <SiteFooter
          name={r.name}
          phoneDisplay={r.whatsapp_display}
          hours={r.hours}
          address={r.address}
          city={r.city}
        />
      </Reveal>

      {/* Floating Checkout Bar */}
      <div 
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[50] w-[90%] max-w-md transition-all duration-500 transform ${
          totalItems > 0 && !headerVisible && !isCartOpen ? "translate-y-0 opacity-100" : "translate-y-32 opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={() => setCartOpen(true)}
          className="bg-[hsl(var(--site-bg)/0.8)] backdrop-blur-xl border border-white/10 w-full py-4 rounded-3xl flex items-center justify-between px-6 shadow-[0_30px_60px_rgba(0,0,0,0.5)] group active:scale-95 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-2xl bg-gradient-bronze flex items-center justify-center text-primary-foreground shadow-glow">
                <span className="font-black text-lg">{totalItems}</span>
              </div>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-black">Meu Pedido</span>
              <span className="text-lg font-black tracking-tighter text-white">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPrice)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-primary px-5 py-2.5 rounded-2xl text-primary-foreground font-black text-xs uppercase tracking-widest shadow-lg group-hover:bg-primary/80 transition-colors">
            Finalizar
            <span className="text-lg">→</span>
          </div>
        </button>
      </div>

      <SiteCartDrawer
        open={isCartOpen}
        onClose={() => setCartOpen(false)}
        whatsappNumber={r.whatsapp_number}
        restaurantName={r.name}
        deliveryZones={data.deliveryZones ?? []}
        restaurant={r}
      />
    </>
  );
}

export function DeliverySite({ data }: { data: SiteData }) {
  const r = data.restaurant;

  return (
    <SiteThemeWrapper primaryColor={r.primary_color} secondaryColor={r.secondary_color}>
      <CartProvider>
        <DeliverySiteContent data={data} />
      </CartProvider>
    </SiteThemeWrapper>
  );
}