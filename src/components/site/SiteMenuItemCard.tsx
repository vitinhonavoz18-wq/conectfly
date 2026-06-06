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

  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    setIsAdding(true);
    addLine({
      itemId: item.id,
      name: item.name,
      description: item.description ?? "",
      unitPrice: price,
      sizeLabel: selected?.label,
    });
    setTimeout(() => setIsAdding(false), 1000);
  };

  const nameParts = item.name.match(/^\[(.*?)\]\s*(.*)$/) || [null, null, item.name];
  const itemCode = nameParts[1];
  const itemName = nameParts[2];

  return (
     <div className="rounded-[1.5rem] sm:rounded-[2rem] border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] flex flex-col gap-0 hover:border-[hsl(var(--site-primary)/0.6)] transition-all duration-500 overflow-hidden shadow-xl group relative backdrop-blur-sm h-full">
       <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--site-primary)/0.08)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
       {(restaurant?.show_item_images ?? true) && item.image_url && (
         <div className="relative aspect-[16/9] sm:aspect-[16/10] overflow-hidden bg-[hsl(var(--site-muted))] shrink-0">
           <img
             src={item.image_url}
             alt={item.name}
             loading="lazy"
             decoding="async"
             className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
             onError={(e) => {
               const container = (e.target as HTMLImageElement).closest('.relative.aspect-\\[16\\/9\\]');
               if (container) (container as HTMLElement).style.display = 'none';
             }}
           />
           <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
         </div>
       )}
       <div className="p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 flex-1 relative z-10">
         <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col min-w-0">
              {itemCode && (
                <span className="text-[10px] font-bold text-[hsl(var(--site-primary))] tracking-widest uppercase mb-1">
                  [{itemCode}]
                </span>
              )}
              <h3 className="font-black text-lg sm:text-xl tracking-tighter uppercase group-hover:text-[hsl(var(--site-primary))] transition-colors leading-tight truncate">
                {itemName}
              </h3>
            </div>
           <div className="flex flex-col items-end shrink-0">
             <span className="text-[hsl(var(--site-primary))] font-black text-lg sm:text-xl tracking-tighter">
               {showConsult ? "CONSULTAR" : formatBRL(price)}
             </span>
           </div>
         </div>
         {item.description && (
           <p className="text-[10px] sm:text-xs text-[hsl(var(--site-muted-fg))] leading-relaxed italic line-clamp-2 min-h-[2.5rem]">
             {item.description}
           </p>
         )}
          {sizes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-auto">
              {sizes.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setSelected(s)}
                  className={`px-3 sm:px-4 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                    selected?.label === s.label
                      ? "site-btn-primary border-[hsl(var(--site-primary)/0.5)] text-[hsl(var(--site-primary-fg))] shadow-lg scale-105"
                       : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-muted))] hover:border-[hsl(var(--site-primary)/0.3)] text-[hsl(var(--site-muted-fg))]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={handleAdd}
            disabled={showConsult || isAdding}
            className={`mt-2 site-btn-primary py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-70 disabled:scale-100 shadow-xl active:scale-95 transition-all group/btn ${sizes.length === 0 ? 'mt-auto' : ''} ${isAdding ? 'bg-green-600 border-green-500 shadow-green-900/20' : ''}`}
          >
            {isAdding ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-black text-white">Adicionado!</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[hsl(var(--site-primary-fg))] group-hover/btn:rotate-90 transition-transform" />
                <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-black">
                  <span className="hidden xs:inline">Adicionar ao pedido</span>
                  <span className="xs:hidden">Adicionar</span>
                </span>
              </>
            )}
          </button>
       </div>
     </div>
  );
}