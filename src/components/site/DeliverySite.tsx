import { useState } from "react";
import { CartProvider } from "./CartContext";
import { SiteThemeWrapper } from "./SiteThemeWrapper";
import { SiteHeader } from "./SiteHeader";
import { SiteHero } from "./SiteHero";
import { SiteComboSection } from "./SiteComboSection";
import { SiteMenuSection } from "./SiteMenuSection";
import { SitePizzaSection } from "./SitePizzaSection";
import { SiteCartDrawer } from "./SiteCartDrawer";
import { SiteFooter } from "./SiteFooter";
import { Reveal, ScrollProgress, SectionScroll } from "./Reveal";
import type { SiteData } from "@/lib/site/types";

export function DeliverySite({ data }: { data: SiteData }) {
  const [cartOpen, setCartOpen] = useState(false);
  const r = data.restaurant;
  const nonPizzaCategories = data.categories.filter((c) => !c.is_pizza);

  return (
    <SiteThemeWrapper primaryColor={r.primary_color} secondaryColor={r.secondary_color}>
      <CartProvider>
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
          <SectionScroll>
            <Reveal variant="fade-up">
              <div className="site-scroll-rise">
                <SitePizzaSection categories={data.categories} restaurant={r} />
              </div>
            </Reveal>
          </SectionScroll>
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
        <SiteCartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          whatsappNumber={r.whatsapp_number}
          restaurantName={r.name}
          deliveryZones={data.deliveryZones ?? []}
          restaurant={r}
        />
      </CartProvider>
    </SiteThemeWrapper>
  );
}