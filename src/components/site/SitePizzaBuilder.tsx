import { useMemo, useState, useEffect, useRef } from "react";
 import { Check, Plus, Minus, Sparkles, Info, ImageIcon, ShoppingBag, Flame } from "lucide-react";
 import type { MenuCategoryRow, MenuItemRow, PizzaSize, RestaurantRow, BeverageRow } from "@/lib/site/types";
import { formatBRL } from "@/lib/site/format";
import { useCart } from "./CartContext";

  interface Props {
    category: MenuCategoryRow & { items: MenuItemRow[] };
    restaurant?: RestaurantRow;
    bordasCategory?: MenuCategoryRow & { items: MenuItemRow[] };
    beverages?: BeverageRow[];
  }

interface FlavorCardProps {
  it: MenuItemRow;
  checked: boolean;
  disabled: boolean;
  size: any;
  toggleFlavor: (id: string) => void;
  restaurant?: RestaurantRow;
  isSpecialSection?: boolean;
}

function FlavorCard({ it, checked, disabled, size, toggleFlavor, restaurant, isSpecialSection }: FlavorCardProps) {
  return (
    <button
      onClick={() => toggleFlavor(it.id)}
      disabled={!size || disabled}
      className={`relative text-left rounded-2xl border p-4 transition-all duration-500 flex items-start gap-4 overflow-hidden group ${
        checked
          ? isSpecialSection 
            ? "border-red-500 bg-gradient-to-br from-red-600/20 to-transparent shadow-[0_0_25px_rgba(220,38,38,0.2)]"
            : "border-[hsl(var(--site-primary))] bg-gradient-to-br from-[hsl(var(--site-primary)/0.15)] to-transparent"
          : isSpecialSection
            ? "border-red-900/30 bg-red-950/10 hover:border-red-500/50 hover:bg-red-900/10"
            : "border-white/5 bg-white/5 hover:border-white/20"
      } ${disabled ? "opacity-30 cursor-not-allowed" : "hover:scale-[1.01] hover:shadow-xl"}`}
    >
      {(restaurant?.show_item_images ?? true) && it.image_url && (
        <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-lg border border-[hsl(var(--site-border))] bg-black/20">
          <img
            src={it.image_url}
            alt={it.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />
        </div>
      )}
      <div
        className={`mt-0.5 h-5 w-5 shrink-0 rounded border flex items-center justify-center transition-colors duration-300 ${
          checked
            ? isSpecialSection ? "bg-red-600 border-red-600 text-white" : "bg-[hsl(var(--site-primary))] border-[hsl(var(--site-primary))] text-white"
            : isSpecialSection ? "border-red-800" : "border-[hsl(var(--site-border))]"
        }`}
      >
        {checked && <Check className="h-3 w-3" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold leading-tight">{it.name}</p>
          {it.is_special && (
            <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-bold border ${
              isSpecialSection 
                ? "bg-red-600/30 text-red-200 border-red-500/40" 
                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
            }`}>
              <Sparkles className="h-3 w-3" /> Especial
              {it.special_extra > 0 ? ` +${formatBRL(it.special_extra)}` : ""}
            </span>
          )}
        </div>
        {it.description && (
          <p className="text-xs text-[hsl(var(--site-muted-fg))] mt-1">
            {it.description}
          </p>
        )}
      </div>
      {isSpecialSection && !checked && !disabled && (
        <div className="absolute -right-1 -bottom-1 opacity-10 group-hover:opacity-30 transition-opacity">
          <Flame className="h-12 w-12 text-red-600" />
        </div>
      )}
    </button>
  );
}

  export function SitePizzaBuilder({ category, restaurant, bordasCategory, beverages }: Props) {
  const sizes: PizzaSize[] = category.pizza_sizes ?? [];
  const { addLine, setCartOpen } = useCart();
  const [sizeIdx, setSizeIdx] = useState<number | null>(sizes.length > 0 ? 0 : null);
   const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
    const [selectedBorderId, setSelectedBorderId] = useState<string | null>(null);
    const [selectedBeverages, setSelectedBeverages] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const [scrollMessage, setScrollMessage] = useState<string | null>(null);
  const [lastCompletedCount, setLastCompletedCount] = useState<number>(0);

  const bordasRef = useRef<HTMLDivElement>(null);
  const beveragesRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const size = sizeIdx !== null ? sizes[sizeIdx] : null;
  const maxFlavors = size?.max_flavors ?? 0;
  const remaining = Math.max(0, maxFlavors - selectedFlavors.length);
  const canAdd = !!size && selectedFlavors.length > 0;
  const isSelectionComplete = !!size && selectedFlavors.length === maxFlavors && maxFlavors > 0;

  useEffect(() => {
    if (isSelectionComplete && selectedFlavors.length !== lastCompletedCount) {
      setLastCompletedCount(selectedFlavors.length);
      
      // Determine which section to scroll to
      let targetRef = null;
      let message = "";

      if (bordasCategory && bordasCategory.items.length > 0) {
        targetRef = bordasRef;
        message = "Agora escolha sua borda recheada 🍕";
      } else if (beverages && beverages.length > 0) {
        targetRef = beveragesRef;
        message = "Que tal uma bebida para acompanhar? 🥤";
      } else {
        targetRef = summaryRef;
        message = "Tudo pronto! Revise seu pedido abaixo. ✨";
      }

      if (targetRef?.current) {
        setScrollMessage(message);
        const offset = 100; // Safe offset for fixed headers
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = targetRef.current.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });

        // Clear message after some time
        setTimeout(() => setScrollMessage(null), 4000);
      }
    } else if (selectedFlavors.length < maxFlavors) {
      // Reset lastCompletedCount if flavors are removed
      setLastCompletedCount(0);
    }
  }, [isSelectionComplete, selectedFlavors.length, maxFlavors, bordasCategory, beverages, lastCompletedCount]);


  const { flavorMap, classicFlavors, specialFlavors } = useMemo(() => {
    const m = new Map<string, MenuItemRow>();
    const classic: MenuItemRow[] = [];
    const special: MenuItemRow[] = [];
    
    category.items.forEach((it) => {
      m.set(it.id, it);
      if (it.is_special) {
        special.push(it);
      } else {
        classic.push(it);
      }
    });
    
    return { flavorMap: m, classicFlavors: classic, specialFlavors: special };
  }, [category.items]);

  const selectedItems = selectedFlavors
    .map((id) => flavorMap.get(id))
    .filter(Boolean) as MenuItemRow[];
   const specialExtras = selectedItems
     .filter((it) => it.is_special)
     .reduce((sum, it) => sum + (Number(it.special_extra) || 0), 0);
 
   const selectedBorder = selectedBorderId 
     ? bordasCategory?.items.find(b => b.id === selectedBorderId) 
     : null;
    const borderPrice = selectedBorder?.price ?? 0;

    const beveragesPrice = Object.entries(selectedBeverages).reduce((sum, [id, qty]) => {
      const bev = beverages?.find(b => b.id === id);
      return sum + (Number(bev?.price ?? 0) * qty);
    }, 0);
  
    const finalPrice = (size?.price ?? 0) + specialExtras + borderPrice + beveragesPrice;
  const specialNames = selectedItems.filter((it) => it.is_special).map((it) => it.name);

  const toggleFlavor = (id: string) => {
    setSelectedFlavors((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= maxFlavors) return cur;
      return [...cur, id];
    });
  };

  const handleSelectSize = (i: number) => {
    setSizeIdx(i);
    const newMax = sizes[i].max_flavors;
    setSelectedFlavors((cur) => cur.slice(0, newMax));
  };

    const handleAddToCart = (shouldOpenCart = false, event?: React.MouseEvent) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
     if (!size || selectedFlavors.length === 0) return;
     const flavorNames = selectedFlavors
       .map((id) => flavorMap.get(id)?.name)
       .filter(Boolean) as string[];
     const descParts = [
       flavorNames.length === 1
         ? `Sabor: ${flavorNames[0]}`
         : `Sabores: ${flavorNames.join(" + ")}`,
     ];
      if (specialNames.length > 0) {
        descParts.push(`Especiais (+${formatBRL(specialExtras)}): ${specialNames.join(", ")}`);
      }
      if (selectedBorder) {
        descParts.push(`Borda: ${selectedBorder.name} (+${formatBRL(selectedBorder.price)})`);
      }

     // 1. Add Pizza
     addLine({
       itemId: `pizza-${category.id}-${size.label}-${selectedFlavors.join("_")}`,
       name: `Pizza ${size.label}`,
       description: descParts.join(" • "),
       unitPrice: (size?.price ?? 0) + specialExtras + borderPrice,
       sizeLabel: size.label,
       flavors: flavorNames,
       specialFlavors: specialNames,
       extras: specialExtras,
     }, 1);

     // 2. Add Beverages
     Object.entries(selectedBeverages).forEach(([id, qty]) => {
       if (qty > 0) {
         const bev = beverages?.find(b => b.id === id);
         if (bev) {
           addLine({
             itemId: `bev-${bev.id}`,
             name: bev.name,
             description: bev.brand && bev.size ? `${bev.brand} - ${bev.size}` : bev.brand || bev.size || "",
             unitPrice: Number(bev.price),
           }, qty);
         }
       }
     });
 
      setConfirm(`Adicionado ao carrinho!`);
      setSelectedFlavors([]);
      setSelectedBorderId(null);
      setSelectedBeverages({});
      if (shouldOpenCart) setCartOpen(true);


     setTimeout(() => setConfirm(null), 2200);
   };

  if (sizes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--site-border))] p-6 text-center text-[hsl(var(--site-muted-fg))]">
        Nenhum tamanho cadastrado para esta categoria.
      </div>
    );
  }

  return (
    <div className="space-y-6 relative" id={`pizza-builder-${category.id}`}>
      {/* Step 1 — Sizes */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="text-lg font-bold">1. Escolha o tamanho</h4>
          <span className="text-xs text-[hsl(var(--site-muted-fg))]">
            preço definido pelo tamanho
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sizes.map((s, i) => {
            const active = sizeIdx === i;
            return (
               <button
                 key={`${s.label}-${i}`}
                 onClick={() => handleSelectSize(i)}
                 className={`relative rounded-2xl border p-4 text-left transition-all duration-300 transform hover:scale-[1.03] active:scale-95 ${
                   active
                     ? "border-[hsl(var(--site-primary))] bg-gradient-to-br from-[hsl(var(--site-primary)/0.2)] to-transparent shadow-[0_0_20px_rgba(255,90,0,0.15)]"
                     : "border-white/5 bg-white/5 hover:border-white/20"
                 }`}
               >
                {active && (
                  <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[hsl(var(--site-primary))] text-white inline-flex items-center justify-center">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <p className="font-bold leading-tight">{s.label}</p>
                <p className="text-[hsl(var(--site-secondary))] font-bold mt-1">
                  {formatBRL(s.price)}
                </p>
                <p className="text-[11px] text-[hsl(var(--site-muted-fg))] mt-0.5">
                  {s.slices ? `${s.slices} fatias · ` : ""}
                  até {s.max_flavors} {s.max_flavors === 1 ? "sabor" : "sabores"}
                </p>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-start gap-2 text-xs sm:text-sm rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 p-3">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Ao selecionar <strong>sabores especiais</strong>, o valor final da pizza poderá ser
            alterado.
          </span>
        </div>
      </div>

      {/* Step 2 — Flavors */}
      <div>
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-lg font-bold">2. Escolha os sabores</h4>
          {size && (
            <span className="text-xs px-2 py-1 rounded-full bg-[hsl(var(--site-card))] border border-[hsl(var(--site-border))]">
              {selectedFlavors.length}/{maxFlavors} selecionados
              {remaining > 0 && ` · ${remaining} restante${remaining > 1 ? "s" : ""}`}
            </span>
          )}
        </div>
        {category.items.length === 0 ? (
          <p className="text-sm text-[hsl(var(--site-muted-fg))]">
            Nenhum sabor cadastrado ainda.
          </p>
        ) : (
          <div className="space-y-12">
            {/* Classic Flavors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {classicFlavors.map((it) => (
                <FlavorCard 
                  key={it.id} 
                  it={it} 
                  checked={selectedFlavors.includes(it.id)}
                  disabled={!size || (!selectedFlavors.includes(it.id) && selectedFlavors.length >= maxFlavors)}
                  size={size}
                  toggleFlavor={toggleFlavor}
                  restaurant={restaurant}
                />
              ))}
            </div>

            {/* Special Flavors Section */}
            {specialFlavors.length > 0 && (
              <div className="space-y-6" id="sabores-especiais">
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-red-600 via-red-800 to-black p-8 shadow-[0_20px_50px_rgba(220,38,38,0.3)] border border-red-500/30">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Flame className="h-32 w-32 text-white" />
                  </div>
                  <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex items-center justify-center h-8 w-8 rounded-full bg-white/20 backdrop-blur-sm">
                          <Flame className="h-5 w-5 text-red-400" />
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase">
                          Sabores Especiais
                        </h3>
                      </div>
                      <p className="text-red-100/80 font-medium max-w-lg italic">
                        Experimente combinações premium e sabores exclusivos da casa.
                      </p>
                    </div>
                    <span className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold text-xs uppercase tracking-widest shadow-lg">
                      Seleção Premium
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {specialFlavors.map((it) => (
                    <FlavorCard 
                      key={it.id} 
                      it={it} 
                      isSpecialSection
                      checked={selectedFlavors.includes(it.id)}
                      disabled={!size || (!selectedFlavors.includes(it.id) && selectedFlavors.length >= maxFlavors)}
                      size={size}
                      toggleFlavor={toggleFlavor}
                      restaurant={restaurant}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

        {/* Step 3 — Bordas Recheadas */}
        {bordasCategory && bordasCategory.items.length > 0 && (
          <div className="space-y-4" ref={bordasRef}>
            <div className="flex items-baseline justify-between mb-3">
              <h4 className="text-lg font-bold">3. Escolha a borda recheada (opcional)</h4>
              {scrollMessage && scrollMessage.includes("borda") && (
                <span className="text-xs font-bold text-[hsl(var(--site-primary))] animate-bounce">
                  {scrollMessage}
                </span>
              )}
            </div>
           <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
             <button
               onClick={() => setSelectedBorderId(null)}
               className={`relative rounded-2xl border p-4 text-left transition-all duration-300 transform hover:scale-[1.03] active:scale-95 ${
                 selectedBorderId === null
                   ? "border-[hsl(var(--site-primary))] bg-gradient-to-br from-[hsl(var(--site-primary)/0.2)] to-transparent"
                   : "border-white/5 bg-white/5 hover:border-white/20"
               }`}
             >
               {selectedBorderId === null && (
                 <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[hsl(var(--site-primary))] text-white inline-flex items-center justify-center">
                   <Check className="h-3 w-3" />
                 </span>
               )}
               <p className="font-bold leading-tight">Sem Borda</p>
               <p className="text-[hsl(var(--site-secondary))] font-bold mt-1">
                 Grátis
               </p>
             </button>
             {bordasCategory.items.map((b) => {
               const active = selectedBorderId === b.id;
               return (
                 <button
                   key={b.id}
                   onClick={() => setSelectedBorderId(b.id)}
                   className={`relative rounded-2xl border p-4 text-left transition-all duration-300 transform hover:scale-[1.03] active:scale-95 ${
                     active
                       ? "border-[hsl(var(--site-primary))] bg-gradient-to-br from-[hsl(var(--site-primary)/0.2)] to-transparent shadow-[0_0_20px_rgba(255,90,0,0.15)]"
                       : "border-white/5 bg-white/5 hover:border-white/20"
                   }`}
                 >
                   {active && (
                     <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[hsl(var(--site-primary))] text-white inline-flex items-center justify-center">
                       <Check className="h-3 w-3" />
                     </span>
                   )}
                   <p className="font-bold leading-tight">{b.name}</p>
                   <p className="text-[hsl(var(--site-secondary))] font-bold mt-1">
                     +{formatBRL(b.price)}
                   </p>
                 </button>
               );
             })}
            </div>
          </div>
        )}

        {/* Step 4 — Bebidas */}
        {beverages && beverages.length > 0 && (
          <div className="space-y-4" id="bebidas-step" ref={beveragesRef}>
            <div className="flex items-baseline justify-between mb-3">
              <h4 className="text-lg font-bold">4. Escolha as bebidas (opcional)</h4>
              {scrollMessage && scrollMessage.includes("bebida") && (
                <span className="text-xs font-bold text-[hsl(var(--site-primary))] animate-bounce">
                  {scrollMessage}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {beverages.map((bev) => {
                const qty = selectedBeverages[bev.id] || 0;
                return (
                  <div
                    key={bev.id}
                    className={`relative rounded-2xl border p-4 flex items-center justify-between transition-all duration-300 ${
                      qty > 0
                        ? "border-[hsl(var(--site-primary))] bg-gradient-to-br from-[hsl(var(--site-primary)/0.1)] to-transparent"
                        : "border-white/5 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold leading-tight truncate">{bev.name}</p>
                      <p className="text-[11px] text-[hsl(var(--site-muted-fg))]">
                        {bev.brand} {bev.brand && bev.size ? '•' : ''} {bev.size}
                      </p>
                      <p className="text-[hsl(var(--site-secondary))] font-bold mt-0.5">
                        {formatBRL(bev.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 bg-black/40 p-1 rounded-xl border border-white/10">
                      <button
                        onClick={() => {
                          setSelectedBeverages((cur) => ({
                            ...cur,
                            [bev.id]: Math.max(0, (cur[bev.id] || 0) - 1),
                          }));
                        }}
                        disabled={qty === 0}
                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-20 transition-all active:scale-90"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center font-bold text-sm">{qty}</span>
                      <button
                        onClick={() => {
                          setSelectedBeverages((cur) => ({
                            ...cur,
                            [bev.id]: (cur[bev.id] || 0) + 1,
                          }));
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded-lg bg-[hsl(var(--site-primary))] text-white hover:opacity-80 transition-all active:scale-90"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 5 — Summary + add */}
        <div 
          id={`summary-${category.id}`}
          ref={summaryRef}
         className="rounded-[2rem] border border-white/10 bg-black/40 backdrop-blur-md p-8 shadow-2xl relative overflow-hidden"
       >
         {scrollMessage && scrollMessage.includes("pronto") && (
           <div className="absolute top-4 right-8 z-10">
             <span className="text-xs font-bold text-[hsl(var(--site-primary))] animate-pulse">
               {scrollMessage}
             </span>
           </div>
         )}
         <div className="absolute top-0 right-0 p-8 opacity-5">
           <Sparkles className="h-24 w-24 text-primary" />
         </div>
         <h4 className="text-2xl font-black mb-4 tracking-tight">Resumo da sua Pizza</h4>
        {size ? (
          <ul className="text-sm text-[hsl(var(--site-muted-fg))] space-y-1">
            <li>
              <strong className="text-[hsl(var(--site-fg,var(--site-muted-fg)))]">Tamanho:</strong>{" "}
              {size.label} — {formatBRL(size.price)}
            </li>
            <li>
              <strong className="text-[hsl(var(--site-fg,var(--site-muted-fg)))]">Sabores:</strong>{" "}
              {selectedFlavors.length === 0
                ? "nenhum selecionado"
                : selectedFlavors
                    .map((id) => flavorMap.get(id)?.name)
                    .filter(Boolean)
                    .join(" + ")}
            </li>
             {specialExtras > 0 && (
               <li>
                 <strong className="text-amber-300">Adicional especial:</strong>{" "}
                 +{formatBRL(specialExtras)}
                 {specialNames.length > 0 && (
                   <span className="text-xs"> ({specialNames.join(", ")})</span>
                 )}
               </li>
             )}
              {selectedBorder && (
                <li>
                  <strong className="text-amber-300">Borda recheada:</strong>{" "}
                  {selectedBorder.name} (+{formatBRL(selectedBorder.price)})
                </li>
              )}
              {Object.keys(selectedBeverages).some(id => selectedBeverages[id] > 0) && (
                <li className="pt-2 mt-2 border-t border-white/5">
                  <strong className="text-emerald-400">Bebidas:</strong>
                  <ul className="pl-4 space-y-0.5 mt-1">
                    {Object.entries(selectedBeverages).map(([id, qty]) => {
                      if (qty === 0) return null;
                      const bev = beverages?.find(b => b.id === id);
                      if (!bev) return null;
                      return (
                        <li key={id} className="text-xs">
                          {qty}x {bev.name} — {formatBRL(Number(bev.price) * qty)}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              )}
          </ul>
        ) : (
          <p className="text-sm text-[hsl(var(--site-muted-fg))]">Selecione um tamanho.</p>
        )}
        <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--site-muted-fg))]">
              Total
            </span>
            <span className="text-2xl font-black text-[hsl(var(--site-secondary))]">
              {size ? formatBRL(finalPrice) : "—"}
            </span>
          </div>
            <button
              onClick={(e) => handleAddToCart(false, e)}
              disabled={!canAdd}
              className="btn-premium px-10 py-5 rounded-2xl text-lg flex items-center gap-4 disabled:opacity-30 disabled:scale-100 disabled:shadow-none uppercase tracking-widest shadow-2xl"
            >
              <Plus className="h-6 w-6 text-primary-foreground" /> 
              <span>Adicionar ao Pedido</span>
            </button>
        </div>
        {confirm && (
          <p className="mt-3 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
            ✓ {confirm}
          </p>
        )}
      </div>

    </div>
  );
}
