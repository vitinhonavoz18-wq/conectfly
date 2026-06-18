import { useCart } from "../site/CartContext";
import { SiteHeader } from "../site/SiteHeader";
import { SiteMenuSection } from "../site/SiteMenuSection";
import { SiteBeverageSection } from "../site/SiteBeverageSection";
import { SiteCartDrawer } from "../site/SiteCartDrawer";
import { SiteFooter } from "../site/SiteFooter";
import type { SiteData } from "@/lib/site/types";
import { Utensils, Beer, Wine, Coffee, Star, ArrowRight, Minus, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

export function BarPrimeTemplate({ data }: { data: SiteData }) {
  const { isCartOpen, setCartOpen, validatedTable, totalItems } = useCart();
  const r = data.restaurant;
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [isRequestingClose, setIsRequestingClose] = useState(false);
  const [closeModal, setCloseModal] = useState<{ open: boolean; duplicate?: boolean; error?: string } | null>(null);

  const requestTableClose = async () => {
    if (!validatedTable || isRequestingClose) return;
    setIsRequestingClose(true);
    try {
      const res = await fetch("/api/public/table-close-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: r.id,
          table_id: validatedTable.id,
          table_token: validatedTable.token,
          table_number: validatedTable.number,
          table_session_id: validatedTable.sessionId ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        setCloseModal({
          open: true,
          error: json?.error || "Não foi possível solicitar o fechamento. Procure um atendente.",
        });
      } else {
        setCloseModal({ open: true, duplicate: !!json?.duplicate });
      }
    } catch (e) {
      setCloseModal({
        open: true,
        error: "Não foi possível solicitar o fechamento. Procure um atendente.",
      });
    } finally {
      setIsRequestingClose(false);
    }
  };

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
  
  // Dynamic categories for the quick nav, excluding beverages as they have their own section
  const navCategories = allCategories.filter(c => c.items && c.items.length > 0 && !isBeverage(c));


  const beveragesVisible = r.site_settings?.beverages_visibility !== false;
  const entryMode = r.site_settings?.entry_mode || "navigation";
  const cardsCategories = allCategories.filter((c) => !isBeverage(c));

  return (
    <div className="min-h-screen text-[hsl(var(--site-fg))] bg-[hsl(var(--site-bg))] pb-safe-extra font-sans">
      <SiteHeader 
        name={r.name} 
        logoUrl={r.logo_url} 
        onOpenCart={() => setCartOpen(true)} 
        showCartButton={r.site_settings?.show_cart_button !== false}
      />
      
      {/* Sticky Bottom Cart Floating Button (Mobile) */}
      {totalItems > 0 && !isCartOpen && (
        <div className="fixed bottom-6 left-0 right-0 z-40 px-4 sm:hidden animate-in fade-in slide-in-from-bottom-10 duration-500">
           <button 
             onClick={() => setCartOpen(true)}
             className="w-full bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] py-5 rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] shadow-[0_20px_50px_hsl(var(--site-primary)/0.4)] flex items-center justify-center gap-3 border-4 border-white/10 active:scale-95 transition-all"
           >
             <ShoppingBag className="h-5 w-5" />
             {validatedTable ? `Pedir na Mesa ${validatedTable.number}` : "Ver meu pedido"}
             <span className="bg-[hsl(var(--site-primary-fg))] text-[hsl(var(--site-primary))] px-2 py-0.5 rounded-lg text-xs">
               {totalItems}
             </span>
           </button>
        </div>
      )}
      
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
        {entryMode !== "cards" && (
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
        )}

        {/* Menu Sections */}
        {entryMode === "cards" ? (
          <SiteMenuSection
            categories={cardsCategories as any}
            restaurant={r}
            entryMode="cards"
            beverages={data.beverages ?? []}
            beverageCatalogs={data.beverageCatalogs}
          />
        ) : (
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
        )}

        {/* Table Closing Request Button */}
        {validatedTable && (
          <div className="max-w-6xl mx-auto px-4 py-12 border-t border-[hsl(var(--site-border))] text-center">
            <button 
              onClick={requestTableClose}
              disabled={isRequestingClose}
              className="px-10 py-5 rounded-full bg-destructive text-destructive-foreground font-black text-lg uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all border-4 border-destructive/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isRequestingClose ? "Enviando..." : "Fechar Mesa"}
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

      {closeModal?.open && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setCloseModal(null)}
        >
          <div
            className="bg-white text-neutral-900 rounded-2xl max-w-md w-full p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {closeModal.error ? (
              <>
                <h3 className="text-xl font-black uppercase tracking-wide mb-3">Não foi possível enviar</h3>
                <p className="text-sm text-neutral-600">{closeModal.error}</p>
              </>
            ) : closeModal.duplicate ? (
              <>
                <h3 className="text-xl font-black uppercase tracking-wide mb-3">Solicitação já enviada</h3>
                <p className="text-sm text-neutral-600">
                  Uma solicitação de fechamento já foi enviada para a Mesa {validatedTable?.number}. Aguarde o atendimento.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black uppercase tracking-wide mb-3">Solicitação enviada</h3>
                <p className="text-sm text-neutral-600">
                  Um atendente foi notificado de que você deseja fechar sua mesa. Por favor, aguarde o atendimento.
                </p>
              </>
            )}
            <button
              onClick={() => setCloseModal(null)}
              className="mt-6 px-8 py-3 rounded-full bg-neutral-900 text-white font-black uppercase tracking-widest text-sm"
            >
              OK
            </button>
          </div>
        </div>
      )}
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

  const formattedPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price);

  return (
    <div className="bg-[hsl(var(--site-card))] rounded-2xl sm:rounded-3xl border border-[hsl(var(--site-border))] overflow-hidden flex flex-row sm:flex-col group hover:border-[hsl(var(--site-primary)/0.6)] transition-all duration-500 shadow-xl relative h-full min-h-[140px] sm:min-h-0">
      {/* Premium Dark Overlay on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--site-primary)/0.05)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      {/* Product Image */}
      {(restaurant?.show_item_images ?? true) && item.image_url ? (
        <div className="w-[110px] xs:w-[130px] sm:w-full aspect-square sm:aspect-video overflow-hidden relative shrink-0">
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none sm:block hidden" />
        </div>
      ) : (
        <div className="w-[110px] xs:w-[130px] sm:hidden bg-[hsl(var(--site-muted))] flex items-center justify-center shrink-0">
          <Utensils className="h-8 w-8 opacity-20" />
        </div>
      )}

      <div className="p-3 sm:p-6 flex flex-col flex-1 gap-2 sm:gap-3 min-w-0 justify-between">
        <div>
          <h3 className="font-black text-sm sm:text-xl uppercase tracking-tighter leading-tight group-hover:text-[hsl(var(--site-primary))] transition-colors line-clamp-2">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-[10px] sm:text-sm text-[hsl(var(--site-muted-fg))] leading-relaxed italic opacity-80 line-clamp-2 mt-1">
              {item.description}
            </p>
          )}
        </div>

        <div className="mt-2 sm:mt-4 flex items-center justify-between gap-2">
          {qtyInCart > 0 ? (
            <div className="flex items-center gap-2 sm:gap-3 bg-[hsl(var(--site-muted))] p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border border-[hsl(var(--site-border))] shadow-inner">
              <button 
                onClick={() => handleUpdateQty(qtyInCart - 1)}
                className="h-7 w-7 sm:h-10 sm:w-10 flex items-center justify-center bg-[hsl(var(--site-card))] rounded-lg sm:rounded-xl text-[hsl(var(--site-fg))] hover:bg-[hsl(var(--site-primary)/0.1)] active:scale-90 transition-all border border-[hsl(var(--site-border))]"
              >
                <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
              <span className="font-black text-sm sm:text-lg min-w-[16px] text-center">{qtyInCart}</span>
              <button 
                onClick={() => handleUpdateQty(qtyInCart + 1)}
                className="h-7 w-7 sm:h-10 sm:w-10 flex items-center justify-center bg-[hsl(var(--site-primary))] rounded-lg sm:rounded-xl text-[hsl(var(--site-primary-fg))] active:scale-90 transition-all shadow-lg"
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              disabled={isAdding}
              className="h-8 sm:h-auto px-4 sm:px-0 sm:flex-1 site-btn-primary py-1 sm:py-3.5 rounded-lg sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 font-black uppercase text-[8px] sm:text-[10px] tracking-widest shadow-xl active:scale-95 transition-all group/btn"
            >
              {isAdding ? (
                <div className="h-3 w-3 sm:h-4 sm:w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 transition-transform group-hover/btn:rotate-90" />
                  <span>Adicionar</span>
                </>
              )}
            </button>
          )}

          <div className="shrink-0">
             <span className="text-[hsl(var(--site-primary))] font-black text-sm sm:text-xl tracking-tighter">
                {formattedPrice}
             </span>
          </div>
        </div>
      </div>
    </div>
  );
}
