import { useState } from "react";
import { SiteMenuItemCard } from "./SiteMenuItemCard";
 import type { MenuCategoryRow, MenuItemRow, RestaurantRow, BeverageRow, BeverageCatalogRow } from "@/lib/site/types";
import { SitePizzaBuilder } from "./SitePizzaBuilder";

  interface Props {
    categories: (MenuCategoryRow & { items: MenuItemRow[] })[];
    restaurant: RestaurantRow;
    bordasCategory?: MenuCategoryRow & { items: MenuItemRow[] };
    beverages: BeverageRow[];
    beverageCatalogs?: BeverageCatalogRow[];

  }
  
  export function SitePizzaSection({ categories, restaurant, bordasCategory, beverages, beverageCatalogs }: Props) {
  const pizzaCats = categories.filter(
    (c) => c.is_pizza && (c.pizza_sizes?.length ?? 0) > 0,
  );
  const [activeId, setActiveId] = useState<string | null>(
    pizzaCats[0]?.id ?? null,
  );

  if (pizzaCats.length === 0) return null;

  const active =
    pizzaCats.find((c) => c.id === activeId) ?? pizzaCats[0];

  return (
    <section
      id="pizzas"
      className="py-14 px-4 border-b border-[hsl(var(--site-border))]"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[hsl(var(--site-secondary)/0.15)] text-[hsl(var(--site-secondary))] text-[9px] sm:text-[10px] font-black tracking-[0.3em] uppercase mb-4 border border-[hsl(var(--site-secondary)/0.25)]">
            Monte seu pedido
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase mb-4 text-[hsl(var(--site-fg))] drop-shadow-sm">
            Personalize sua <span className="text-[hsl(var(--site-primary))]">Artesanal</span>
          </h2>
          <div className="h-1 w-20 bg-[hsl(var(--site-secondary))] mx-auto mb-6 rounded-full opacity-60" />
          <p className="text-[hsl(var(--site-muted-fg))] mt-2 max-w-xl mx-auto italic text-sm sm:text-base leading-relaxed opacity-90 px-4">
            Escolha o tamanho ideal e combine seus sabores favoritos em uma única experiência.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {pizzaCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`px-5 py-2 rounded-full font-semibold text-sm transition ${
                active.id === c.id
                  ? "site-btn-primary"
                  : "site-btn-secondary"
              }`}
            >
              {c.icon ? `${c.icon} ` : ""}
              {c.name}
            </button>
          ))}
          <button
            onClick={() => {
              const el = document.getElementById("sabores-especiais");
              if (el) {
                const offset = 100;
                const pos = el.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top: pos, behavior: "smooth" });
              }
            }}
            className="px-5 py-2 rounded-full font-black text-sm transition bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
          >
            🔥 Especiais
          </button>
        </div>

          <SitePizzaBuilder 
            category={active} 
            restaurant={restaurant} 
            bordasCategory={bordasCategory} 
          />
      </div>
    </section>
  );
}