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
import type { SiteData } from "@/lib/site/types";

export function DeliverySite({ data }: { data: SiteData }) {
  const [cartOpen, setCartOpen] = useState(false);
  const r = data.restaurant;
  const nonPizzaCategories = data.categories.filter((c) => !c.is_pizza);

  return (
    <SiteThemeWrapper primaryColor={r.primary_color} secondaryColor={r.secondary_color}>
      <CartProvider>
        <SiteHeader name={r.name} logoUrl={r.logo_url} onOpenCart={() => setCartOpen(true)} />
        <main>
          <SiteHero
            name={r.name}
            tagline={r.tagline}
            description={r.description}
            logoUrl={r.logo_url}
            heroImageUrl={r.hero_image_url}
            heroMediaType={r.hero_media_type}
            heroVideoUrl={r.hero_video_url}
          />
          <SitePizzaSection categories={data.categories} />
          <SiteComboSection groups={data.comboGroups} />
          <SiteMenuSection categories={nonPizzaCategories} />
        </main>
        <SiteFooter
          name={r.name}
          phoneDisplay={r.whatsapp_display}
          hours={r.hours}
          address={r.address}
          city={r.city}
        />
        <SiteCartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          whatsappNumber={r.whatsapp_number}
          restaurantName={r.name}
        />
      </CartProvider>
    </SiteThemeWrapper>
  );
}