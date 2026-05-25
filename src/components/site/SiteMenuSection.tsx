import { useState } from "react";
import { ImageIcon } from "lucide-react";
import type { MenuCategoryRow, MenuItemRow, RestaurantRow } from "@/lib/site/types";
import { SiteMenuItemCard } from "./SiteMenuItemCard";
import { SitePizzaBuilder } from "./SitePizzaBuilder";
 
interface Props {
  categories: (MenuCategoryRow & { items: MenuItemRow[] })[];
  restaurant: RestaurantRow;
  entryMode?: "navigation" | "direct";
}
 
export function SiteMenuSection({ categories, restaurant, entryMode = "navigation" }: Props) {
  const [active, setActive] = useState<string | null>(null);
  if (categories.length === 0) return null;
  const current = active ? categories.find((c) => c.id === active) ?? null : null;

  const isBeverageCategory = (c: MenuCategoryRow) => {
    return c.type === "BEVERAGE" || c.name.toLowerCase().includes("bebida");
  };

  const visibleCategories = categories.filter(c => c.show_on_public_site !== false);
  const clickableCategories = visibleCategories.filter(c => c.show_as_clickable_category !== false);
  const directCategories = visibleCategories.filter(c => c.show_directly_in_menu !== false);

  const renderCategoryList = (cats: (MenuCategoryRow & { items: MenuItemRow[] })[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 site-stagger">
      {cats.map((c) => (
         <button
           key={c.id}
           onClick={() => setActive(c.id)}
           className="group relative aspect-square rounded-3xl overflow-hidden border border-white/5 bg-white/5 hover:border-primary/50 transition-all duration-500 shadow-2xl"
         >
          {c.image_url && (
            <img
              src={c.image_url}
              alt={c.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          {!c.image_url && (
            <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--site-card))] text-[hsl(var(--site-muted-fg))]">
              <ImageIcon className="h-10 w-10 opacity-40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 text-left">
            <h3 className="text-white font-black text-base sm:text-lg leading-tight drop-shadow">
              {c.icon ? `${c.icon} ` : ""}
              {c.name}
            </h3>
            <p className="text-white/80 text-xs mt-0.5">
              {c.is_pizza
                ? `${c.items.length} ${c.items.length === 1 ? "sabor" : "sabores"}`
                : `${c.items.length} ${c.items.length === 1 ? "item" : "itens"}`}
            </p>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <section id="cardapio" className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {(restaurant.site_settings?.show_categories_section !== false) && clickableCategories.length > 0 && (
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/20 text-primary text-[10px] font-black tracking-[0.3em] uppercase mb-4 border border-primary/30">
              Curadoria Gastronômica
            </span>
            <h2 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase mb-4">
              Nossa <span className="text-primary glow-bronze">Cozinha</span>
            </h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto italic">
              {current ? `Explorando a seleção de ${current.name}` : "Selecione uma categoria para descobrir nossas especialidades artesanais."}
            </p>
          </div>
        )}

        {(restaurant.site_settings?.show_categories_section === false || (!current && entryMode !== "direct")) ? (
          <div className="space-y-16">
            {directCategories.map(cat => (
              <div key={cat.id} className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[hsl(var(--site-border))]" />
                  <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
                    {cat.icon ? `${cat.icon} ` : ""}
                    {cat.name}
                  </h3>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[hsl(var(--site-border))]" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 site-stagger">
                  {cat.items.map((it) => (
                    <SiteMenuItemCard key={it.id} item={it} restaurant={restaurant} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {(entryMode !== "direct") && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                 <button
                   onClick={() => setActive(null)}
                   className="px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-white/5 border border-white/10 hover:border-primary/50 transition-all"
                 >
                   ← Voltar
                 </button>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 min-w-0">
                  {clickableCategories.map((c) => (
                     <button
                       key={c.id}
                       onClick={() => setActive(c.id)}
                       className={`px-6 py-2.5 rounded-2xl whitespace-nowrap font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
                         active === c.id
                           ? "bg-gradient-bronze text-primary-foreground shadow-glow"
                           : "bg-white/5 border border-white/10 hover:border-primary/30 text-muted-foreground"
                       }`}
                     >
                      {c.icon ? `${c.icon} ` : ""}
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {entryMode === "direct" ? (
              <div className="space-y-16">
                {directCategories.map(cat => (
                  <div key={cat.id} className="space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[hsl(var(--site-border))]" />
                      <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
                        {cat.icon ? `${cat.icon} ` : ""}
                        {cat.name}
                      </h3>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[hsl(var(--site-border))]" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 site-stagger">
                      {cat.items.map((it) => (
                        <SiteMenuItemCard key={it.id} item={it} restaurant={restaurant} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {current && current.image_url && (
                  <div className="relative h-40 sm:h-56 rounded-2xl overflow-hidden mb-6 border border-[hsl(var(--site-border))]">
                    <img
                      src={current.image_url}
                      alt={current.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <h3 className="absolute bottom-4 left-4 text-3xl font-black text-white drop-shadow">
                      {current.icon ? `${current.icon} ` : ""}
                      {current.name}
                    </h3>
                  </div>
                )}

                {current && current.is_pizza ? (
                  <SitePizzaBuilder category={current} restaurant={restaurant} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 site-stagger">
                    {current?.items.map((it) => (
                      <SiteMenuItemCard key={it.id} item={it} restaurant={restaurant} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}