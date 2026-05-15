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
   const isBordas = (c: any) => {
     const name = c.name.toLowerCase();
     return name === "bordas recheadas" || name === "borda recheada" || name === "bordas" || name === "borda";
   };
   const nonPizzaCategories = data.categories.filter((c) => !c.is_pizza && !isBeverage(c) && !isBordas(c));
   const bordasCategory = data.categories.find(isBordas);
  const hasBeverages = data.beverages && data.beverages.length > 0;

  return (
    <>
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
         <div id="pizzas-container">
           <SitePizzaSection 
             categories={data.categories} 
             restaurant={r} 
             bordasCategory={bordasCategory}
             beverages={data.beverages ?? []}
           />
         </div>
 
         <div>
           <SiteComboSection groups={data.comboGroups} />
         </div>
         <div>
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