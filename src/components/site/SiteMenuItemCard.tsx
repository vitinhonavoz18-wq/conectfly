import { useState } from "react";
import { Plus, ImageIcon } from "lucide-react";
import type { MenuItemRow, Size, RestaurantRow } from "@/lib/site/types";
import { formatBRL } from "@/lib/site/format";
import { useCart } from "./CartContext";

export function SiteMenuItemCard({ item, restaurant }: { item: MenuItemRow, restaurant?: RestaurantRow }) {
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
     <div className="rounded-[2rem] border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] flex flex-col gap-4 hover:border-primary/40 transition-all duration-500 overflow-hidden shadow-2xl group relative backdrop-blur-sm">
       <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
       {(restaurant?.show_item_images ?? true) && item.image_url && (
         <div className="relative aspect-[16/10] overflow-hidden bg-black/40">
           <img
             src={item.image_url}
             alt={item.name}
             loading="lazy"
             decoding="async"
             className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
             onError={(e) => {
               const container = (e.target as HTMLImageElement).closest('.aspect-\\[16\\/10\\]');
               if (container) (container as HTMLElement).style.display = 'none';
             }}
           />
           <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
         </div>
       )}
       <div className="p-6 pt-2 flex flex-col gap-4 flex-1 relative z-10">
         <div className="flex items-start justify-between gap-4">
           <h3 className="font-black text-xl tracking-tighter uppercase group-hover:text-primary transition-colors leading-tight">{item.name}</h3>
           <div className="flex flex-col items-end">
             <span className="text-primary font-black text-lg tracking-tighter">
               {showConsult ? "CONSULTAR" : formatBRL(price)}
             </span>
           </div>
         </div>
         {item.description && (
           <p className="text-sm text-muted-foreground italic line-clamp-2">{item.description}</p>
         )}
          {sizes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setSelected(s)}
                  className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                    selected?.label === s.label
                      ? "site-btn-primary border-primary/50 text-white shadow-lg"
                      : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-muted))] hover:border-primary/30 text-[hsl(var(--site-muted-fg))]"
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
            className="mt-auto site-btn-primary py-3 rounded-2xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:scale-100 shadow-xl active:scale-95"
          >
            <Plus className="h-4 w-4 text-white" />
            <span className="text-[10px] uppercase tracking-[0.2em]">Adicionar à Experiência</span>
          </button>
       </div>
     </div>
  );
}