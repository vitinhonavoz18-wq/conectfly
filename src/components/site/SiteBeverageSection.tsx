import { Minus, Plus, ShoppingBag, FolderPlus } from "lucide-react";
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
    <div className=\"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8\">
      {bevs.map((bev) => {
        const qty = getQty(bev.id);
        return (
          <div 
            key={bev.id} 
            className={`rounded-[1.5rem] sm:rounded-[2rem] border flex flex-col transition-all duration-500 backdrop-blur-md relative overflow-hidden group h-full ${
              qty > 0 ? 'border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.08)] shadow-glow' : 'border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary)/0.3)] shadow-xl'
            }`}
          >
            {bev.image_url && (
              <div className=\"h-40 sm:h-48 overflow-hidden relative shrink-0\">
                 <img 
                   src={bev.image_url} 
                   alt={bev.name}
                   className=\"w-full h-full object-cover transition-transform duration-700 group-hover:scale-110\"
                 />
                 <div className=\"absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent\" />
              </div>
            )}
            
            <div className=\"p-5 sm:p-6 flex flex-col flex-1 gap-4\">
              {!bev.image_url && (
                <div className=\"absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none\">
                  <ShoppingBag className=\"h-12 w-12 sm:h-16 sm:w-16 text-[hsl(var(--site-primary))]\" />
                </div>
              )}

            <div className=\"flex justify-between items-start gap-3 relative z-10\">
              <div className=\"min-w-0 flex-1\">
                <h3 className=\"font-black text-lg sm:text-xl tracking-tighter uppercase leading-tight truncate text-[hsl(var(--site-primary))]\">
                  {bev.name}
                </h3>
                <p className=\"text-[9px] sm:text-xs text-[hsl(var(--site-muted-fg))] font-bold mt-1 uppercase tracking-widest opacity-80 truncate\">
                  {bev.brand} {bev.brand && bev.size ? '•' : ''} {bev.size}
                </p>
                {bev.description && (
                  <p className=\"text-[10px] sm:text-[11px] text-[hsl(var(--site-muted-fg))] mt-2 line-clamp-2 italic leading-relaxed opacity-80\">
                    {bev.description}
                  </p>
                )}
              </div>
              <div className=\"text-right shrink-0\">
                <span className=\"text-lg sm:text-xl font-black text-[hsl(var(--site-fg))] block tracking-tighter\">
                  {formatBRL(Number(bev.price))}
                </span>
              </div>
            </div>

            <div className=\"mt-auto flex items-center justify-between gap-3 sm:gap-4 pt-4 border-t border-[hsl(var(--site-border))] relative z-10\">
              <div className=\"flex items-center gap-2 sm:gap-3 bg-[hsl(var(--site-card))] p-1 rounded-xl sm:rounded-2xl border border-[hsl(var(--site-border))]\">
                 <button 
                   onClick={(e) => handleRemove(bev, e)}
                   disabled={qty === 0}
                   className=\"h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center site-btn-secondary !rounded-lg sm:!rounded-xl active:scale-90 transition-transform\"
                 >
                   <Minus className=\"h-3.5 w-3.5 sm:h-4 sm:w-4\" />
                 </button>
                 <span className=\"w-6 sm:w-8 text-center font-black text-base sm:text-lg\">{qty}</span>
                 <button 
                   onClick={(e) => handleAdd(bev, e)}
                   className=\"h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center site-btn-primary !rounded-lg sm:!rounded-xl active:scale-90 shadow-lg transition-transform\"
                 >
                   <Plus className=\"h-3.5 w-3.5 sm:h-4 sm:w-4\" />
                 </button>
              </div>
              
              {qty > 0 ? (
                <div className=\"text-right animate-in fade-in slide-in-from-right-2\">
                  <p className=\"text-[9px] uppercase font-bold text-[hsl(var(--site-muted-fg))]\">Subtotal</p>
                  <p className=\"font-black text-[hsl(var(--site-fg))] text-sm sm:text-base\">{formatBRL(qty * Number(bev.price))}</p>
                </div>
              ) : (
                <div className=\"text-right opacity-40\">
                   <p className=\"text-[9px] uppercase font-bold text-[hsl(var(--site-muted-fg))]\">Pedir</p>
                   <Plus className=\"h-4 w-4 text-[hsl(var(--site-muted-fg))] ml-auto\" />
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
    <div id=\"bebidas\" className=\"py-12 sm:py-20 site-stagger bg-[hsl(var(--site-muted))] rounded-[2rem] sm:rounded-[3rem] px-4 sm:px-8 mx-2\">
      <div className=\"text-center mb-10 sm:mb-16\">
        <span className=\"inline-block px-4 py-1.5 rounded-full bg-[hsl(var(--site-primary)/0.15)] text-[hsl(var(--site-primary))] text-[9px] sm:text-[10px] font-black tracking-[0.3em] uppercase mb-4 border border-[hsl(var(--site-primary)/0.25)]\">
          Refresque sua experiência
        </span>
        <div className=\"flex items-center justify-center gap-4 mb-4\">
          <div className=\"h-[2px] w-8 sm:w-16 bg-gradient-to-r from-transparent to-[hsl(var(--site-primary)/0.4)]\" />
          <h2 className=\"text-3xl sm:text-5xl font-black tracking-tighter uppercase text-[hsl(var(--site-fg))] drop-shadow-sm\">
            Bebidas
          </h2>
          <div className=\"h-[2px] w-8 sm:w-16 bg-gradient-to-l from-transparent to-[hsl(var(--site-primary)/0.4)]\" />
        </div>
        <p className=\"text-[hsl(var(--site-muted-fg))] mt-2 max-w-xl mx-auto italic text-xs sm:text-base opacity-90\">
          Acompanhamento perfeito para a sua experiência gastronômica artesanal.
        </p>
      </div>

      <div className=\"space-y-12 sm:space-y-20\">
        {activeCatalogs.map(catalog => (
          <div key={catalog.id} className=\"space-y-8 sm:space-y-10\">
            <div className=\"flex flex-col sm:flex-row items-center gap-6 border-l-4 border-[hsl(var(--site-primary))] pl-5 sm:pl-8 py-2 bg-gradient-to-r from-[hsl(var(--site-primary)/0.05)] to-transparent rounded-r-3xl\">
              {catalog.image_url && (
                <div className=\"w-full sm:w-56 h-32 sm:h-40 rounded-2xl sm:rounded-3xl overflow-hidden border border-[hsl(var(--site-border))] shrink-0 shadow-xl\">
                  <img src={catalog.image_url} alt={catalog.name} className=\"w-full h-full object-cover group-hover:scale-105 transition-transform duration-500\" />
                </div>
              )}
              <div className=\"text-center sm:text-left\">
                <h3 className=\"text-2xl sm:text-4xl font-black uppercase tracking-tight text-[hsl(var(--site-fg))]\">{catalog.name}</h3>
                {catalog.description && (
                  <p className=\"text-[hsl(var(--site-muted-fg))] mt-1 italic text-xs sm:text-base opacity-90\">{catalog.description}</p>
                )}
              </div>
            </div>
            {renderBeverageList(beverages.filter(b => b.catalog_id === catalog.id))}
          </div>
        ))}

        {uncategorizedBeverages.length > 0 && (
          <div className=\"space-y-8 sm:space-y-12\">
            {activeCatalogs.length > 0 && (
              <div className=\"flex items-center gap-4 px-2\">
                 <h3 className=\"text-xl sm:text-2xl font-black uppercase tracking-tight text-[hsl(var(--site-fg))]\">Outras Bebidas</h3>
                 <div className=\"h-px flex-1 bg-[hsl(var(--site-border))]\" />
              </div>
            )}
            {renderBeverageList(uncategorizedBeverages)}
          </div>
        )}
      </div>
    </div>
  );
}
