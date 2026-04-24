import { useState } from "react";
import { Plus } from "lucide-react";
import type { ComboGroupRow, ComboRow } from "@/lib/site/types";
import { formatBRL } from "@/lib/site/format";
import { useCart } from "./CartContext";

interface Props {
  groups: (ComboGroupRow & { combos: ComboRow[] })[];
}

export function SiteComboSection({ groups }: Props) {
  const { addLine } = useCart();
  const [active, setActive] = useState(groups[0]?.id ?? "");
  if (groups.length === 0) return null;
  const current = groups.find((g) => g.id === active) ?? groups[0];

  return (
    <section
      id="combos"
      className="py-16 px-4 bg-gradient-to-b from-[hsl(var(--site-bg))] via-[hsl(var(--site-secondary)/0.05)] to-[hsl(var(--site-bg))]"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 rounded-full bg-[hsl(var(--site-secondary))] text-black text-xs font-bold mb-3">
            PROMOÇÕES
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Combos especiais
          </h2>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-8 justify-start sm:justify-center">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setActive(g.id)}
              className={`px-5 py-2 rounded-full whitespace-nowrap font-semibold text-sm transition ${
                active === g.id
                  ? "bg-[hsl(var(--site-secondary))] text-black"
                  : "bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))] hover:border-[hsl(var(--site-secondary))]"
              }`}
            >
              {g.title}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {current.combos.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-[hsl(var(--site-secondary)/0.4)] bg-[hsl(var(--site-card))] p-5 flex flex-col gap-3 relative"
            >
              {c.badge && (
                <span className="absolute -top-2 right-4 px-2 py-1 rounded-full bg-[hsl(var(--site-secondary))] text-black text-xs font-bold">
                  {c.badge}
                </span>
              )}
              <h3 className="font-bold text-lg">{c.name}</h3>
              <ul className="text-sm text-[hsl(var(--site-muted-fg))] space-y-1">
                {c.items.map((line, i) => (
                  <li key={i}>• {line}</li>
                ))}
              </ul>
              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="text-2xl font-black text-[hsl(var(--site-secondary))]">
                  {formatBRL(c.price)}
                </span>
                <button
                  onClick={() =>
                    addLine({
                      itemId: c.id,
                      name: c.name,
                      description: c.items.join(" + "),
                      unitPrice: c.price,
                    })
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--site-primary))] text-white font-semibold hover:opacity-90 transition"
                >
                  <Plus className="h-4 w-4" /> Adicionar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}