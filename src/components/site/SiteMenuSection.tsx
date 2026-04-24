import { useState } from "react";
import type { MenuCategoryRow, MenuItemRow } from "@/lib/site/types";
import { SiteMenuItemCard } from "./SiteMenuItemCard";

interface Props {
  categories: (MenuCategoryRow & { items: MenuItemRow[] })[];
}

export function SiteMenuSection({ categories }: Props) {
  const [active, setActive] = useState(categories[0]?.id ?? "");
  if (categories.length === 0) return null;
  const current = categories.find((c) => c.id === active) ?? categories[0];

  return (
    <section id="cardapio" className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Cardápio</h2>
          <p className="text-[hsl(var(--site-muted-fg))] mt-2">
            Escolha seus pratos favoritos
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-8 justify-start sm:justify-center">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {current.items.map((it) => (
            <SiteMenuItemCard key={it.id} item={it} />
          ))}
        </div>
      </div>
    </section>
  );
}