import { useState } from "react";
import type { MenuCategoryRow, MenuItemRow, RestaurantRow } from "@/lib/site/types";
import { SitePizzaBuilder } from "./SitePizzaBuilder";

interface Props {
  categories: (MenuCategoryRow & { items: MenuItemRow[] })[];
  restaurant: RestaurantRow;
}

export function SitePizzaSection({ categories, restaurant }: Props) {
  const pizzaCats = categories.filter(
    (c) => c.is_pizza && (c.pizza_sizes?.length ?? 0) > 0,
  );
  const [activeId, setActiveId] = useState<string | null>(
    pizzaCats[0]?.id ?? null,
  );

  if (pizzaCats.length === 0) return null;

  const active =
    pizzaCats.find((c) => c.id === activeId) ?? pizzaCats[0];

  const beverageCategory = categories.find(c => {
    const name = c.name.toLowerCase();
    return name === "bebidas" || name === "bebida" || name === "beverages" || name === "drinks";
  });

  return (
    <section
      id="pizzas"
      className="py-14 px-4 border-b border-[hsl(var(--site-border))]"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <span className="inline-block text-xs uppercase tracking-[0.2em] text-[hsl(var(--site-secondary))] font-bold mb-2">
            🍕 Monte sua pizza
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Escolha o tamanho e os sabores
          </h2>
          <p className="text-[hsl(var(--site-muted-fg))] mt-2 max-w-xl mx-auto">
            Comece pelo tamanho — o preço base é definido por ele. Depois selecione seus sabores
            preferidos.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {pizzaCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`px-5 py-2 rounded-full font-semibold text-sm transition ${
                active.id === c.id
                  ? "bg-[hsl(var(--site-primary))] text-white"
                  : "bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] hover:border-[hsl(var(--site-primary))]"
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
            className="px-5 py-2 rounded-full font-black text-sm transition bg-red-600/20 text-red-500 border border-red-500/30 hover:bg-red-600/30 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
          >
            🔥 Especiais
          </button>
        </div>

        <SitePizzaBuilder category={active} restaurant={restaurant} />

        {beverageCategory && (
          <div id="bebidas" className="mt-20 pt-16 border-t border-[hsl(var(--site-border))]">
            <div className="text-center mb-8">
              <span className="inline-block text-xs uppercase tracking-[0.2em] text-[hsl(var(--site-secondary))] font-bold mb-2">
                🥤 Refresque-se
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight uppercase">
                Bebidas
              </h2>
              <p className="text-[hsl(var(--site-muted-fg))] mt-2 max-w-xl mx-auto italic">
                Adicione uma bebida gelada para acompanhar sua pizza.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {beverageCategory.items.map((it) => (
                <SiteMenuItemCard key={it.id} item={it} restaurant={restaurant} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}