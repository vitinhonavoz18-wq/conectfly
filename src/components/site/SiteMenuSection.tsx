import { useState } from "react";
import { ImageIcon } from "lucide-react";
import type { MenuCategoryRow, MenuItemRow } from "@/lib/site/types";
import { SiteMenuItemCard } from "./SiteMenuItemCard";
import { SitePizzaBuilder } from "./SitePizzaBuilder";

interface Props {
  categories: (MenuCategoryRow & { items: MenuItemRow[] })[];
}

export function SiteMenuSection({ categories }: Props) {
  const [active, setActive] = useState<string | null>(null);
  if (categories.length === 0) return null;
  const current = active ? categories.find((c) => c.id === active) ?? null : null;

  return (
    <section id="cardapio" className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Cardápio</h2>
          <p className="text-[hsl(var(--site-muted-fg))] mt-2">
            {current ? "Escolha seus pratos favoritos" : "Toque em uma categoria para ver os produtos"}
          </p>
        </div>

        {!current ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className="group relative aspect-square rounded-2xl overflow-hidden border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary))] transition shadow-lg"
              >
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt={c.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
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
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <button
                onClick={() => setActive(null)}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] hover:border-[hsl(var(--site-primary))]"
              >
                ← Categorias
              </button>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 min-w-0">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActive(c.id)}
                    className={`px-5 py-2 rounded-full whitespace-nowrap font-semibold text-sm transition ${
                      active === c.id
                        ? "bg-[hsl(var(--site-primary))] text-white"
                        : "bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] hover:border-[hsl(var(--site-primary))]"
                    }`}
                  >
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {current.image_url && (
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

            {current.is_pizza ? (
              <SitePizzaBuilder category={current} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {current.items.map((it) => (
                  <SiteMenuItemCard key={it.id} item={it} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}