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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {bevs.map((bev) => {
        const qty = getQty(bev.id);
        return (
          <div 
            key={bev.id} 
            className={`rounded-[2rem] border flex flex-col transition-all duration-500 backdrop-blur-md relative overflow-hidden group ${
              qty > 0 ? 'border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.05)] shadow-glow' : 'border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary)/0.2)] shadow-2xl'
            }`}
          >
            {bev.image_url && (
              <div className="h-48 overflow-hidden relative">
                 <img 
                   src={bev.image_url} 
                   alt={bev.name}
                   className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
            )}
            
            <div className="p-6 flex flex-col flex-1 gap-4">
              {!bev.image_url && (
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <ShoppingBag className="h-16 w-16 text-[hsl(var(--site-primary))]" />
                </div>
              )}

            <div className="flex justify-between items-start gap-4 relative z-10">
              <div className="min-w-0">
                <h3 className="font-black text-xl tracking-tighter uppercase leading-tight truncate text-[hsl(var(--site-fg))]">
                  {bev.name}
                </h3>
                <p className="text-xs text-[hsl(var(--site-muted-fg))] font-bold mt-1 uppercase tracking-widest opacity-80">
                  {bev.brand} {bev.brand && bev.size ? '•' : ''} {bev.size}
                </p>
                {bev.description && (
                  <p className="text-[10px] text-[hsl(var(--site-muted-fg))] mt-2 line-clamp-2 italic">
                    {bev.description}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-[hsl(var(--site-primary))] block tracking-tighter">
                  {formatBRL(Number(bev.price))}
                </span>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between gap-4 pt-4 border-t border-[hsl(var(--site-border))] relative z-10">
              <div className="flex items-center gap-3 bg-[hsl(var(--site-card))] p-1 rounded-2xl border border-[hsl(var(--site-border))]">
                 <button 
                   onClick={(e) => handleRemove(bev, e)}
                   disabled={qty === 0}
                   className="h-10 w-10 flex items-center justify-center site-btn-secondary !rounded-xl active:scale-90"
                 >
                   <Minus className="h-4 w-4" />
                 </button>
                 <span className="w-8 text-center font-black text-lg">{qty}</span>
                 <button 
                   onClick={(e) => handleAdd(bev, e)}
                   className="h-10 w-10 flex items-center justify-center site-btn-primary !rounded-xl active:scale-90 shadow-lg"
                 >
                   <Plus className="h-4 w-4" />
                 </button>
              </div>
              
              {qty > 0 && (
                <div className="text-right animate-in fade-in slide-in-from-right-2">
                  <p className="text-[10px] uppercase font-bold text-[hsl(var(--site-muted-fg))]">Subtotal</p>
                  <p className="font-black text-[hsl(var(--site-fg))]">{formatBRL(qty * Number(bev.price))}</p>
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
    <div id="bebidas" className="py-16 site-stagger">
      <div className="text-center mb-12">
        <span className="inline-block px-4 py-1.5 rounded-full bg-[hsl(var(--site-primary)/0.2)] text-[hsl(var(--site-primary))] text-[10px] font-black tracking-[0.3em] uppercase mb-4 border border-[hsl(var(--site-primary)/0.3)]">
          Refresque sua experiência
        </span>
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="h-1px w-12 bg-[hsl(var(--site-primary)/0.3)] hidden sm:block" />
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase">
            Bebidas
          </h2>
          <div className="h-1px w-12 bg-[hsl(var(--site-primary)/0.3)] hidden sm:block" />
        </div>
        <p className="text-[hsl(var(--site-muted-fg))] mt-2 max-w-xl mx-auto italic">
          Acompanhamento perfeito para a sua pizza artesanal.
        </p>
      </div>

      <div className="space-y-16">
        {activeCatalogs.map(catalog => (
          <div key={catalog.id} className="space-y-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {catalog.image_url && (
                <div className="w-full sm:w-48 h-32 rounded-3xl overflow-hidden border border-[hsl(var(--site-border))] shrink-0">
                  <img src={catalog.image_url} alt={catalog.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="text-center sm:text-left">
                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">{catalog.name}</h3>
                {catalog.description && (
                  <p className="text-[hsl(var(--site-muted-fg))] mt-1 italic">{catalog.description}</p>
                )}
              </div>
            </div>
            {renderBeverageList(beverages.filter(b => b.catalog_id === catalog.id))}
          </div>
        ))}

        {uncategorizedBeverages.length > 0 && (
          <div className="space-y-8">
            {activeCatalogs.length > 0 && (
              <h3 className="text-2xl font-black uppercase tracking-tight border-b border-[hsl(var(--site-border))] pb-4">Outras Bebidas</h3>
            )}
            {renderBeverageList(uncategorizedBeverages)}
          </div>
        )}
      </div>
    </div>
  );
}
