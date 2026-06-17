import { useState } from "react";
import { ImageIcon } from "lucide-react";
import type { MenuCategoryRow, MenuItemRow, RestaurantRow, BeverageRow, BeverageCatalogRow } from "@/lib/site/types";
import { SiteMenuItemCard } from "./SiteMenuItemCard";
import { SitePizzaBuilder } from "./SitePizzaBuilder";
import { SiteBeverageSection } from "./SiteBeverageSection";

 
interface Props {
  categories: (MenuCategoryRow & { items: MenuItemRow[] })[];
  restaurant: RestaurantRow;
  entryMode?: "navigation" | "direct" | "cards";
  beverages?: BeverageRow[];
  beverageCatalogs?: BeverageCatalogRow[];
}

 
export function SiteMenuSection({ categories, restaurant, entryMode = "navigation", beverages, beverageCatalogs }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const BEV_ID = "__beverages__";
  
  const hasBeverages = beverages && beverages.length > 0;
  if (categories.length === 0 && !hasBeverages) return null;

  const current = active ? categories.find((c) => c.id === active) ?? null : null;

  const isBeverageCategory = (c: MenuCategoryRow) => {
    return c.type === "BEVERAGE" || c.name.toLowerCase().includes("bebida") || c.name.toLowerCase().includes("beverage");
  };

  const visibleCategories = categories.filter(c => {
    const isBeverage = isBeverageCategory(c);
    if (isBeverage) {
        // Lógica de filtragem de bebidas delegada ao Template
    }
    return c.show_on_public_site !== false;
  });

  const clickableCategories = visibleCategories.filter(c => c.show_as_clickable_category !== false);
  const directCategories = visibleCategories.filter(c => c.show_directly_in_menu !== false);

  // ============ NEW LAYOUT: Category Cards ============
  if (entryMode === "cards") {
    const hasBev = !!(beverages && beverages.length > 0);
    // No auto-open: always show cards first, even with a single category.
    if (!active) {
      return (
        <section id="cardapio" className="py-12 sm:py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase mb-4 text-[hsl(var(--site-fg))]">
                Nosso <span className="text-[hsl(var(--site-primary))]">Cardápio</span>
              </h2>
              <p className="text-[hsl(var(--site-muted-fg))] max-w-xl mx-auto text-sm sm:text-base px-4">
                Escolha uma categoria para começar.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 site-stagger">
              {clickableCategories.map((c) => {
                const count = c.is_pizza
                  ? c.items.length
                  : c.items.length;
                return (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className="group relative aspect-[4/3] rounded-3xl overflow-hidden border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary))] transition-all duration-500 shadow-xl text-left"
                >
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--site-muted))] text-[hsl(var(--site-muted-fg))]">
                      <ImageIcon className="h-14 w-14 opacity-40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                    <h3 className="text-white font-black text-xl sm:text-2xl leading-tight drop-shadow uppercase tracking-tight">
                      {c.icon ? `${c.icon} ` : ""}
                      {c.name}
                    </h3>
                    <p className="text-white/80 text-xs sm:text-sm mt-1 font-medium">
                      {count} {count === 1 ? (c.is_pizza ? "sabor" : "produto") : (c.is_pizza ? "sabores" : "produtos")}
                    </p>
                    {c.description && (
                      <p className="text-white/70 text-[11px] sm:text-xs mt-1 line-clamp-2">{c.description}</p>
                    )}
                  </div>
                </button>
                );
              })}
              {hasBev && (
                <button
                  key={BEV_ID}
                  onClick={() => setActive(BEV_ID)}
                  className="group relative aspect-[4/3] rounded-3xl overflow-hidden border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary))] transition-all duration-500 shadow-xl text-left"
                >
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[hsl(var(--site-primary)/0.2)] to-[hsl(var(--site-muted))]">
                    <span className="text-7xl opacity-60">🍺</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                    <h3 className="text-white font-black text-xl sm:text-2xl leading-tight drop-shadow uppercase tracking-tight">
                      🍺 Bebidas
                    </h3>
                    <p className="text-white/80 text-xs sm:text-sm mt-1 font-medium">
                      {beverages!.length} {beverages!.length === 1 ? "item" : "itens"}
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </section>
      );
    }

    // Selected card view (lazy-rendered: products only mount after a card click)
    const selectedCat = active === BEV_ID ? null : clickableCategories.find((c) => c.id === active) ?? null;
    const isBev = active === BEV_ID;

    return (
      <section id="cardapio" className="py-12 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setActive(null)}
            className="mb-6 px-6 py-2.5 site-btn-secondary !rounded-2xl text-xs sm:text-sm font-bold"
          >
            ← Voltar às categorias
          </button>

          {isBev ? (
            <>
              <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-8 text-[hsl(var(--site-fg))]">
                🍺 Bebidas
              </h3>
              <div className="bg-[hsl(var(--site-muted))] rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8">
                <SiteBeverageSection beverages={beverages!} catalogs={beverageCatalogs} restaurant={restaurant} />
              </div>
            </>
          ) : selectedCat ? (
            <>
              {selectedCat.image_url && (
                <div className="relative h-40 sm:h-56 rounded-2xl overflow-hidden mb-6 border border-[hsl(var(--site-border))]">
                  <img src={selectedCat.image_url} alt={selectedCat.name} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <h3 className="absolute bottom-4 left-4 text-3xl font-black text-white drop-shadow uppercase">
                    {selectedCat.icon ? `${selectedCat.icon} ` : ""}
                    {selectedCat.name}
                  </h3>
                </div>
              )}
              {!selectedCat.image_url && (
                <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-8 text-[hsl(var(--site-fg))]">
                  {selectedCat.icon ? `${selectedCat.icon} ` : ""}
                  {selectedCat.name}
                </h3>
              )}
              {selectedCat.is_pizza ? (
                <SitePizzaBuilder
                  category={selectedCat}
                  restaurant={restaurant}
                  beverages={beverages}
                  beverageCatalogs={beverageCatalogs}
                />
              ) : selectedCat.items.length === 0 ? (
                <div className="py-16 text-center text-[hsl(var(--site-muted-fg))]">
                  Nenhum produto disponível nesta categoria.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 site-stagger">
                  {selectedCat.items.map((it) => (
                    <div key={it.id} className="h-full">
                      <SiteMenuItemCard item={it} restaurant={restaurant} />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </section>
    );
  }
  // ============ END NEW LAYOUT ============

  const renderCategoryList = (cats: (MenuCategoryRow & { items: MenuItemRow[] })[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 site-stagger">
      {cats.map((c) => (
         <button
           key={c.id}
           onClick={() => setActive(c.id)}
           className="group relative aspect-square rounded-2xl sm:rounded-3xl overflow-hidden border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-primary/50 transition-all duration-500 shadow-xl sm:shadow-2xl"
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
          <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-4 text-left">
            <h3 className="text-white font-black text-sm sm:text-lg leading-tight drop-shadow">
              {c.icon ? `${c.icon} ` : ""}
              {c.name}
            </h3>
            <p className="text-white/80 text-[10px] sm:text-xs mt-0.5">
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
    <section id="cardapio" className="py-12 sm:py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {(restaurant.site_settings?.show_categories_section !== false) && clickableCategories.length > 0 && (
          <div className="text-center mb-10 sm:mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[hsl(var(--site-primary)/0.15)] text-[hsl(var(--site-primary))] text-[9px] sm:text-[10px] font-black tracking-[0.3em] uppercase mb-4 border border-[hsl(var(--site-primary)/0.25)]">
              Curadoria Gastronômica
            </span>
            <h2 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase mb-4 text-[hsl(var(--site-fg))] drop-shadow-sm">
              Nossa <span className="text-[hsl(var(--site-primary))]">Cozinha</span>
            </h2>
            <div className="h-1 w-20 bg-[hsl(var(--site-primary))] mx-auto mb-6 rounded-full opacity-80" />
            <p className="text-[hsl(var(--site-muted-fg))] mt-2 max-w-xl mx-auto italic text-sm sm:text-base leading-relaxed opacity-90 px-4">
              {current ? `Explorando a seleção premium de ${current.name}` : "Selecione uma categoria para descobrir nossas especialidades artesanais de alta qualidade."}
            </p>
          </div>
        )}

        {(restaurant.site_settings?.show_categories_section === false || (!current && entryMode !== "direct")) ? (
          <div className="space-y-16 sm:space-y-24">
            {directCategories.map(cat => (
              <div key={cat.id} className="space-y-6 sm:space-y-10">
                <div className="flex items-center gap-4 sm:gap-6 px-2">
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-[hsl(var(--site-border))] to-[hsl(var(--site-primary)/0.3)]" />
                  <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-[hsl(var(--site-fg))] shrink-0">
                    {cat.icon ? `${cat.icon} ` : ""}
                    {cat.name}
                  </h3>
                  <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-[hsl(var(--site-border))] to-[hsl(var(--site-primary)/0.3)]" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8 site-stagger h-full">
                  {cat.items.map((it) => (
                    <div key={it.id} className="h-full">
                      <SiteMenuItemCard item={it} restaurant={restaurant} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {beverages && beverages.length > 0 && (
              <div className="space-y-6 sm:space-y-10 mt-16 pt-12 border-t border-[hsl(var(--site-border))]">
                <div className="flex items-center gap-4 sm:gap-6 px-2">
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-[hsl(var(--site-border))] to-[hsl(var(--site-primary)/0.3)]" />
                  <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-[hsl(var(--site-fg))] shrink-0">
                    Acompanhamentos
                  </h3>
                  <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-[hsl(var(--site-border))] to-[hsl(var(--site-primary)/0.3)]" />
                </div>
                <div className="bg-[hsl(var(--site-muted))] rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8">
                  <SiteBeverageSection beverages={beverages} catalogs={beverageCatalogs} restaurant={restaurant} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {(entryMode !== "direct") && (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                 <button
                   onClick={() => setActive(null)}
                   className="px-6 py-2.5 site-btn-secondary !rounded-2xl"
                 >
                   ← Voltar
                 </button>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 min-w-0">
                  {clickableCategories.map((c) => (
                     <button
                       key={c.id}
                       onClick={() => setActive(c.id)}
                       className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl whitespace-nowrap font-black text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all ${
                         active === c.id
                           ? "site-btn-primary shadow-glow"
                           : "site-btn-secondary text-muted-foreground"
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 site-stagger h-full">
                      {cat.items.map((it) => (
                        <div key={it.id} className="h-full">
                          <SiteMenuItemCard item={it} restaurant={restaurant} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {beverages && beverages.length > 0 && (
                  <div className="space-y-3 mt-16 pt-12 border-t border-[hsl(var(--site-border))]">
                    <div className="flex items-center gap-4 mb-8">
                       <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[hsl(var(--site-border))]" />
                       <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-center">Acompanhamentos</h3>
                       <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[hsl(var(--site-border))]" />
                    </div>
                    <div className="bg-[hsl(var(--site-muted))] rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8">
                      <SiteBeverageSection beverages={beverages} catalogs={beverageCatalogs} restaurant={restaurant} />
                    </div>
                  </div>
                )}
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
                  <SitePizzaBuilder 
                    category={current} 
                    restaurant={restaurant} 
                    beverages={beverages} 
                    beverageCatalogs={beverageCatalogs} 
                  />
                ) : (
                  <div className="space-y-12">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 site-stagger h-full">
                      {current?.items.map((it) => (
                        <div key={it.id} className="h-full">
                          <SiteMenuItemCard item={it} restaurant={restaurant} />
                        </div>
                      ))}
                    </div>

                    {/* Step 4 for non-pizzas: Beverages before summary/footer flow */}
                    {beverages && beverages.length > 0 && (
                      <div className="space-y-3 mt-12">
                        <div className="flex items-center gap-2 mb-4">
                          <h4 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Acompanhamentos</h4>
                        </div>
                        <div className="bg-[hsl(var(--site-muted))] rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8">
                          <SiteBeverageSection beverages={beverages} catalogs={beverageCatalogs} restaurant={restaurant} />
                        </div>
                      </div>
                    )}
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
