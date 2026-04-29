import { useState } from "react";
import { Plus, ImageIcon } from "lucide-react";
import type { MenuItemRow, Size } from "@/lib/site/types";
import { formatBRL } from "@/lib/site/format";
import { useCart } from "./CartContext";

export function SiteMenuItemCard({ item }: { item: MenuItemRow }) {
  const { addLine } = useCart();
  const sizes: Size[] = item.sizes && item.sizes.length > 0 ? item.sizes : [];
  const [selected, setSelected] = useState<Size | null>(sizes[0] ?? null);

  const price = selected ? selected.price : item.price;
  const showConsult = !selected && item.price === 0;

  const handleAdd = () => {
    addLine({
      itemId: item.id,
      name: item.name,
      description: item.description ?? "",
      unitPrice: price,
      sizeLabel: selected?.label,
    });
  };

  return (
    <div className="rounded-xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] flex flex-col gap-3 hover:border-[hsl(var(--site-primary))] transition overflow-hidden shadow-lg group">
      {item.image_url ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-black/30">
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      ) : (
        <div className="relative aspect-[4/3] flex items-center justify-center bg-[hsl(var(--site-card))] text-[hsl(var(--site-muted-fg))]">
          <ImageIcon className="h-10 w-10 opacity-30" />
        </div>
      )}
      <div className="p-5 pt-2 flex flex-col gap-3 flex-1">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-lg leading-tight">{item.name}</h3>
        <span className="text-[hsl(var(--site-secondary))] font-bold whitespace-nowrap">
          {showConsult ? "Consultar" : formatBRL(price)}
        </span>
      </div>
      {item.description && (
        <p className="text-sm text-[hsl(var(--site-muted-fg))]">{item.description}</p>
      )}
      {sizes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => (
            <button
              key={s.label}
              onClick={() => setSelected(s)}
              className={`px-3 py-1 text-sm rounded-full border transition ${
                selected?.label === s.label
                  ? "bg-[hsl(var(--site-primary))] border-[hsl(var(--site-primary))] text-white"
                  : "border-[hsl(var(--site-border))] hover:border-[hsl(var(--site-primary))]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={handleAdd}
        disabled={showConsult}
        className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--site-primary))] text-white font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="h-4 w-4" /> Adicionar
      </button>
      </div>
    </div>
  );
}