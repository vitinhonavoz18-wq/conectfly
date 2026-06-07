import { useCart } from "../site/CartContext";
import { SiteHeader } from "../site/SiteHeader";
import { SiteHero } from "../site/SiteHero";
import { SiteMenuSection } from "../site/SiteMenuSection";
import { SiteBeverageSection } from "../site/SiteBeverageSection";
import { SiteCartDrawer } from "../site/SiteCartDrawer";
import { SiteFooter } from "../site/SiteFooter";
import type { SiteData } from "@/lib/site/types";
import { getPrimaryButtonText } from "@/lib/site/format";
import { Utensils, Beer, Wine, Coffee, Star, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

export function BarPrimeTemplate({ data }: { data: SiteData }) {
  const { isCartOpen, setCartOpen, validatedTable } = useCart();
  const r = data.restaurant;
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const isBeverage = (c: any) => {
    const name = c.name.toLowerCase();
    const type = c.type?.toLowerCase();
    return (
      name.includes("bebida") ||
      name.includes("beverage") ||
      name.includes("drink") ||
      name.includes("refrigerante") ||
      name.includes("cerveja") ||
      name.includes("vinho") ||
      name.includes("cocktail") ||
      type === "beverage"
    );
  };

  const allCategories = data.categories.filter(c => c.show_on_public_site !== false);
  const beverageCategories = allCategories.filter(isBeverage);
  const foodCategories = allCategories.filter(c => !isBeverage(c) && !c.is_pizza);
  
  // Dynamic categories for the quick nav
  const navCategories = allCategories.filter(c => c.items && c.items.length > 0);

  const beveragesVisible = r.site_settings?.beverages_visibility !== false;

  return (
    <div className="min-h-screen text-[hsl(var(--site-fg))] bg-[hsl(var(--site-bg))] pb-safe-extra font-sans">
      <SiteHeader 
        name={r.name} 
        logoUrl={r.logo_url} 
        onOpenCart={() => setCartOpen(true)} 
        showCartButton={r.site_settings?.show_cart_button !== false}
      />
      
      <main className="pt-16 sm:pt-20">
        {/* Compact Hero */}
        <div className="relative overflow-hidden bg-gradient-to-b from-[hsl(var(--site-primary)/0.1)] to-transparent">
          <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 flex flex-col items-center text-center">
            {validatedTable && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] font-black uppercase text-[10px] sm:text-xs mb-4 shadow-lg animate-bounce">
                <Utensils className="h-3 w-3 sm:h-4 sm:w-4" />
                Mesa {validatedTable.number} identificada
              </div>
            )}
            <h1 className="text-3xl sm:text-6xl font-black tracking-tighter uppercase mb-2 text-[hsl(var(--site-fg))] drop-shadow-md">
              {validatedTable ? "Peça direto da sua mesa" : r.name}
            </h1>
            <p className="text-sm sm:text-xl text-[hsl(var(--site-muted-fg))] max-w-2xl font-medium italic opacity-90">
              {r.tagline || "Bebidas geladas, petiscos e combos em poucos cliques. Escolha, peça e acompanhe sua comanda."}
            </p>
          </div>
        </div>

        {/* Categories Horizontal Nav */}
        <div className="sticky top-16 sm:top-20 z-30 bg-[hsl(var(--site-bg)/0.8)] backdrop-blur-md border-b border-[hsl(var(--site-border))] py-3 overflow-x-auto scrollbar-hide">
          <div className="max-w-6xl mx-auto px-4 flex gap-2">
            <button
              onClick={() => {
                setActiveCategory("all");
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
                activeCategory === "all" 
                  ? "bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] shadow-lg" 
                  : "bg-[hsl(var(--site-card))] text-[hsl(var(--site-muted-fg))] border border-[hsl(var(--site-border))]"
              }`}
            >
              Todos
            </button>
            {navCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  const el = document.getElementById(`category-${cat.id}`);
                  if (el) {
                    const offset = 140;
                    const pos = el.getBoundingClientRect().top + window.pageYOffset - offset;
                    window.scrollTo({ top: pos, behavior: 'smooth' });
                  }
                }}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
                  activeCategory === cat.id 
                    ? "bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] shadow-lg" 
                    : "bg-[hsl(var(--site-card))] text-[hsl(var(--site-muted-fg))] border border-[hsl(var(--site-border))]"
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Sections */}
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-12 sm:space-y-20">
          {navCategories.map(cat => (
            <section key={cat.id} id={`category-${cat.id}`} className="scroll-mt-32">
              <div className="flex items-center gap-4 mb-6 sm:mb-10">
                <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter text-[hsl(var(--site-fg))] flex items-center gap-3">
                  <span className="text-[hsl(var(--site-primary))]">{cat.icon || <Star className="h-6 w-6" />}</span>
                  {cat.name}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-[hsl(var(--site-border))] to-transparent" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                {cat.items.map(item => (
                  <BarPrimeItemCard key={item.id} item={item} restaurant={r} />
                ))}
              </div>
            </section>
          ))}
          
          {/* Fallback for Beverages if not in categories or explicitly requested */}
          {beveragesVisible && data.beverages && data.beverages.length > 0 && (
             <section id="bebidas-legacy" className="py-12">
                <SiteBeverageSection beverages={data.beverages} catalogs={data.beverageCatalogs} restaurant={r} />
             </section>
          )}
        </div>

        {/* Table Closing Request Button */}
        {validatedTable && (
          <div className="max-w-6xl mx-auto px-4 py-12 border-t border-[hsl(var(--site-border))] text-center">
            <button 
              onClick={() => {
                // Logic to request table closing
                alert(`Solicitação enviada! Um atendente irá até a Mesa ${validatedTable.number}.`);
              }}
              className="px-10 py-5 rounded-full bg-destructive text-destructive-foreground font-black text-lg uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all border-4 border-destructive/20"
            >
              Fechar Mesa
            </button>
            <p className="mt-4 text-xs sm:text-sm text-[hsl(var(--site-muted-fg))] font-medium">
              Chame o atendente para finalizar sua conta na Mesa {validatedTable.number}
            </p>
          </div>
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

function BarPrimeItemCard({ item, restaurant }: { item: any, restaurant: any }) {
  const { addLine, items, updateQty } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const qtyInCart = items.find(i => i.itemId === item.id)?.quantity || 0;

  const handleAdd = () => {
    setIsAdding(true);
    addLine({
      itemId: item.id,
      name: item.name,
      description: item.description ?? "",
      unitPrice: item.price,
    }, 1);
    setTimeout(() => setIsAdding(false), 800);
  };

  const handleUpdateQty = (newQty: number) => {
    updateQty(item.id, undefined, newQty);
  };

  return (
    <div className="bg-[hsl(var(--site-card))] rounded-3xl border border-[hsl(var(--site-border))] overflow-hidden flex flex-col group hover:border-[hsl(var(--site-primary)/0.6)] transition-all duration-500 shadow-xl relative h-full">
      {/* Premium Dark Overlay on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--site-primary)/0.05)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      {/* Product Image */}
      {(restaurant?.show_item_images ?? true) && item.image_url && (
        <div className="aspect-[4/3] sm:aspect-video overflow-hidden relative shrink-0">
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          
          {/* Price Tag Overlay on Image */}
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
            <span className="text-[hsl(var(--site-primary))] font-black text-sm">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
            </span>
          </div>
        </div>
      )}

      <div className="p-5 sm:p-6 flex flex-col flex-1 gap-3">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-black text-lg sm:text-xl uppercase tracking-tighter leading-tight group-hover:text-[hsl(var(--site-primary))] transition-colors">
            {item.name}
          </h3>
          {!(restaurant?.show_item_images ?? true) || !item.image_url ? (
             <span className="text-[hsl(var(--site-primary))] font-black text-lg shrink-0">
               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
             </span>
          ) : null}
        </div>

        {item.description && (
          <p className="text-xs sm:text-sm text-[hsl(var(--site-muted-fg))] leading-relaxed italic opacity-80 line-clamp-2 min-h-[2.5rem]">
            {item.description}
          </p>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between gap-4">
          {qtyInCart > 0 ? (
            <div className="flex items-center gap-3 bg-[hsl(var(--site-muted))] p-1 rounded-2xl border border-[hsl(var(--site-border))] flex-1 justify-between shadow-inner">
              <button 
                onClick={() => handleUpdateQty(qtyInCart - 1)}
                className="h-10 w-10 flex items-center justify-center bg-[hsl(var(--site-card))] rounded-xl text-[hsl(var(--site-fg))] hover:bg-[hsl(var(--site-primary)/0.1)] active:scale-90 transition-all border border-[hsl(var(--site-border))]"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-black text-lg min-w-[20px] text-center">{qtyInCart}</span>
              <button 
                onClick={() => handleUpdateQty(qtyInCart + 1)}
                className="h-10 w-10 flex items-center justify-center bg-[hsl(var(--site-primary))] rounded-xl text-[hsl(var(--site-primary-fg))] active:scale-90 transition-all shadow-lg"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              disabled={isAdding}
              className="flex-1 site-btn-primary py-3.5 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all group/btn"
            >
              {isAdding ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4 transition-transform group-hover/btn:scale-110" />
                  <span>Adicionar</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
