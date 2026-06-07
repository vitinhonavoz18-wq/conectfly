import { Minus, Plus, ShoppingBag } from "lucide-react";
import type { BeverageRow, RestaurantRow, BeverageCatalogRow } from "@/lib/site/types";
import { formatBRL } from "@/lib/site/format";
import { useCart } from "./CartContext";

interface Props {
  beverages: BeverageRow[];
  catalogs?: BeverageCatalogRow[];
  restaurant: RestaurantRow;
}

export function SiteBeverageSection({ beverages, catalogs, restaurant }: Props) {
  const { items, updateQty, addLine } = useCart();
  const isBarPrime = restaurant.selected_template === "bar_prime";

  if (!beverages || beverages.length === 0) return null;

  const getQty = (id: string) => {
    const line = items.find((l) => l.itemId === `bev-${id}`);
    return line?.quantity ?? 0;
  };

  const handleAdd = (bev: BeverageRow, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const currentQty = getQty(bev.id);
    if (currentQty > 0) {
      updateQty(`bev-${bev.id}`, undefined, currentQty + 1);
    } else {
      addLine({
        itemId: `bev-${bev.id}`,
        name: bev.name,
        description: bev.description || (bev.brand && bev.size ? `${bev.brand} - ${bev.size}` : bev.brand || bev.size || ""),
        unitPrice: Number(bev.price),
      }, 1);
    }
  };

  const handleRemove = (bev: BeverageRow, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const currentQty = getQty(bev.id);
    if (currentQty > 0) {
      updateQty(`bev-${bev.id}`, undefined, currentQty - 1);
    }
  };

  const renderBeverageList = (bevs: BeverageRow[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8">
      {bevs.map((bev) => {
        const qty = getQty(bev.id);
        return (
          <div 
            key={bev.id} 
            className={`rounded-xl sm:rounded-[2rem] border flex transition-all duration-500 backdrop-blur-md relative overflow-hidden group h-full ${
              qty > 0 ? 'border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.08)] shadow-glow' : 'border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary)/0.3)]'
            }`}
          >
            {bev.image_url && (
              <div className="w-20 sm:w-auto h-auto sm:h-48 overflow-hidden relative shrink-0">
                 <img 
                   src={bev.image_url} 
                   alt={bev.name}
                   className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent hidden sm:block" />
              </div>
            )}
            
            <div className="p-3 sm:p-6 flex flex-col flex-1 gap-2 sm:gap-4">
              {!bev.image_url && (
                <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
                  <ShoppingBag className="h-10 w-10 sm:h-16 sm:w-16 text-[hsl(var(--site-primary))]" />
                </div>
              )}

            <div className="flex justify-between items-start gap-2 relative z-10">
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-sm sm:text-xl tracking-tighter uppercase leading-tight truncate text-[hsl(var(--site-primary))]">
                  {bev.name}
                </h3>
                <p className="text-[8px] sm:text-xs text-[hsl(var(--site-muted-fg))] font-bold mt-0.5 sm:mt-1 uppercase tracking-widest opacity-80 truncate">
                  {bev.brand} {bev.brand && bev.size ? '•' : ''} {bev.size}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm sm:text-xl font-black text-[hsl(var(--site-fg))] block tracking-tighter">
                  {formatBRL(Number(bev.price))}
                </span>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 sm:gap-4 pt-2 sm:pt-4 border-t border-[hsl(var(--site-border))] relative z-10">
              <div className="flex items-center gap-1.5 sm:gap-3 bg-[hsl(var(--site-card))] p-0.5 sm:p-1 rounded-lg sm:rounded-2xl border border-[hsl(var(--site-border))]">
                 <button 
                   onClick={(e) => handleRemove(bev, e)}
                   disabled={qty === 0}
                   className="h-7 w-7 sm:h-10 sm:w-10 flex items-center justify-center site-btn-secondary !rounded-md sm:!rounded-xl active:scale-90 transition-transform"
                 >
                   <Minus className="h-3 sm:h-4 w-3 sm:w-4" />
                 </button>
                 <span className="w-4 sm:w-8 text-center font-black text-sm sm:text-lg">{qty}</span>
                 <button 
                   onClick={(e) => handleAdd(bev, e)}
                   className="h-7 w-7 sm:h-10 sm:w-10 flex items-center justify-center site-btn-primary !rounded-md sm:!rounded-xl active:scale-90 shadow-lg transition-transform"
                 >
                   <Plus className="h-3 sm:h-4 w-3 sm:w-4" />
                 </button>
              </div>
              
              {qty > 0 && (
                <div className="text-right animate-in fade-in slide-in-from-right-2">
                  <p className="text-[8px] uppercase font-bold text-[hsl(var(--site-muted-fg))] leading-none">Subtotal</p>
                  <p className="font-black text-[hsl(var(--site-fg))] text-xs sm:text-base">{formatBRL(qty * Number(bev.price))}</p>
                </div>
              )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const activeCatalogs = catalogs?.filter(c => beverages.some(b => b.catalog_id === c.id)) || [];
  const uncategorizedBeverages = beverages.filter(b => !b.catalog_id || !activeCatalogs.some(c => c.id === b.catalog_id));

  return (
    <div id="bebidas" className="py-6 sm:py-20 site-stagger bg-[hsl(var(--site-muted))] rounded-2xl sm:rounded-[3rem] px-2 sm:px-8">
      <div className="text-center mb-6 sm:mb-16">
        <span className="inline-block px-3 py-1 rounded-full bg-[hsl(var(--site-primary)/0.15)] text-[hsl(var(--site-primary))] text-[8px] sm:text-[10px] font-black tracking-[0.2em] sm:tracking-[0.3em] uppercase mb-2 sm:mb-4 border border-[hsl(var(--site-primary)/0.25)]">
          Refresque sua experiência
        </span>
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-2 sm:mb-4">
          <div className="h-[1px] sm:h-[2px] w-6 sm:w-16 bg-gradient-to-r from-transparent to-[hsl(var(--site-primary)/0.4)]" />
          <h2 className="text-2xl sm:text-5xl font-black tracking-tighter uppercase text-[hsl(var(--site-fg))] drop-shadow-sm">
            Bebidas
          </h2>
          <div className="h-[1px] sm:h-[2px] w-6 sm:w-16 bg-gradient-to-l from-transparent to-[hsl(var(--site-primary)/0.4)]" />
        </div>
        <p className="text-[hsl(var(--site-muted-fg))] mt-1 max-w-xl mx-auto italic text-[10px] sm:text-base opacity-90 px-2">
          Acompanhamento perfeito para a sua experiência gastronômica.
        </p>
      </div>

      <div className="space-y-8 sm:space-y-20">
        {activeCatalogs.map(catalog => (
          <div key={catalog.id} className="space-y-6 sm:space-y-10">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 border-l-4 border-[hsl(var(--site-primary))] pl-4 sm:pl-8 py-1 sm:py-2 bg-gradient-to-r from-[hsl(var(--site-primary)/0.05)] to-transparent rounded-r-2xl sm:rounded-r-3xl">
              {catalog.image_url && (
                <div className="w-full sm:w-56 h-24 sm:h-40 rounded-xl sm:rounded-3xl overflow-hidden border border-[hsl(var(--site-border))] shrink-0 shadow-lg sm:shadow-xl">
                  <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              <div className="text-center sm:text-left">
                <h3 className="text-xl sm:text-4xl font-black uppercase tracking-tight text-[hsl(var(--site-fg))]">{catalog.name}</h3>
                {catalog.description && (
                  <p className="text-[hsl(var(--site-muted-fg))] mt-0.5 italic text-[10px] sm:text-base opacity-90">{catalog.description}</p>
                )}
              </div>
            </div>
            {renderBeverageList(beverages.filter(b => b.catalog_id === catalog.id))}
          </div>
        ))}

        {uncategorizedBeverages.length > 0 && (
          <div className="space-y-6 sm:space-y-12">
            {activeCatalogs.length > 0 && (
              <div className="flex items-center gap-3 px-2">
                 <h3 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-[hsl(var(--site-fg))]">Outras Bebidas</h3>
                 <div className="h-px flex-1 bg-[hsl(var(--site-border))]" />
              </div>
            )}
            {renderBeverageList(uncategorizedBeverages)}
          </div>
        )}
      </div>
    </div>
  );
}