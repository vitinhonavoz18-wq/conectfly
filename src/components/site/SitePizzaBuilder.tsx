import { useMemo, useState, useEffect, useRef } from "react";
 import { Check, Plus, Minus, Sparkles, Info, ImageIcon, ShoppingBag, Flame } from "lucide-react";
 import type { MenuCategoryRow, MenuItemRow, PizzaSize, RestaurantRow, BeverageRow, BeverageCatalogRow } from "@/lib/site/types";
import { formatBRL } from "@/lib/site/format";
import { useCart } from "./CartContext";

  interface Props {
    category: MenuCategoryRow & { items: MenuItemRow[] };
    restaurant?: RestaurantRow;
    bordasCategory?: MenuCategoryRow & { items: MenuItemRow[] };

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
      className={`relative text-left rounded-3xl border p-5 transition-all duration-300 flex items-start gap-4 overflow-hidden group ${
        checked
          ? "border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.05)] shadow-[0_10px_30px_hsl(var(--site-primary)/0.1)] ring-2 ring-[hsl(var(--site-primary)/0.2)]"
          : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary)/0.5)] hover:shadow-lg"
      } ${disabled ? "opacity-30 cursor-not-allowed" : "hover:scale-[1.02]"}`}
    >
      {(restaurant?.show_item_images ?? true) && it.image_url && (
        <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-2xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-muted))]">
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
        className={`mt-1 h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
          checked
            ? "bg-[hsl(var(--site-primary))] border-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] shadow-[0_4px_12px_hsl(var(--site-primary)/0.3)] scale-110"
            : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] group-hover:border-[hsl(var(--site-primary)/0.5)]"
        }`}
      >
        {checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-base leading-tight text-[hsl(var(--site-fg))]">{it.name}</p>
          {it.is_special && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-extrabold bg-[hsl(var(--site-primary))] text-white shadow-sm">
              <Sparkles className="h-3 w-3" /> Especial
              {it.special_extra > 0 ? ` +${formatBRL(it.special_extra)}` : ""}
            </span>
          )}
        </div>
        {it.description && (
          <p className="text-sm text-[hsl(var(--site-muted-fg))] mt-1.5 leading-relaxed">
            {it.description}
          </p>
        )}
      </div>
    </button>
  );
}

  export function SitePizzaBuilder({ category, restaurant, bordasCategory }: Props) {
  const sizes: PizzaSize[] = category.pizza_sizes ?? [];
  const { addLine, setCartOpen } = useCart();
  const [sizeIdx, setSizeIdx] = useState<number | null>(sizes.length > 0 ? 0 : null);
   const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
    const [selectedBorderId, setSelectedBorderId] = useState<string | null>(null);
    
  const [confirm, setConfirm] = useState<string | null>(null);
  const [scrollMessage, setScrollMessage] = useState<string | null>(null);
  const [lastCompletedCount, setLastCompletedCount] = useState<number>(0);

  const bordasRef = useRef<HTMLDivElement>(null);
  
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
        message = "Agora escolha seu adicional ✨";
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
  }, [isSelectionComplete, selectedFlavors.length, maxFlavors, bordasCategory, lastCompletedCount]);


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

  
    const finalPrice = (size?.price ?? 0) + specialExtras + borderPrice;
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

 
      setConfirm(`Adicionado ao carrinho!`);
      setSelectedFlavors([]);
      setSelectedBorderId(null);
      
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {sizes.map((s, i) => {
            const active = sizeIdx === i;
            return (
               <button
                 key={`${s.label}-${i}`}
                 onClick={() => handleSelectSize(i)}
                 className={`relative rounded-3xl border p-5 text-left transition-all duration-300 transform ${
                   active
                     ? "border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.05)] shadow-[0_12px_30px_hsl(var(--site-primary)/0.12)] scale-[1.05] z-10 border-2"
                     : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary)/0.3)] hover:bg-[hsl(var(--site-muted))]"
                 }`}
               >
                {active && (
                  <span className="absolute top-3 right-3 h-6 w-6 rounded-full bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] inline-flex items-center justify-center shadow-lg">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                )}
                <p className={`font-extrabold text-lg leading-tight ${active ? "text-[hsl(var(--site-primary))]" : "text-[hsl(var(--site-fg))]"}`}>{s.label}</p>
                <p className="text-[hsl(var(--site-secondary))] font-black text-xl mt-1.5">
                  {formatBRL(s.price)}
                </p>
                <p className="text-xs font-medium text-[hsl(var(--site-muted-fg))] mt-1">
                  {s.slices ? `${s.slices} fatias · ` : ""}
                  até {s.max_flavors} {s.max_flavors === 1 ? "sabor" : "sabores"}
                </p>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-start gap-3 text-sm rounded-2xl border border-[hsl(var(--site-primary)/0.3)] bg-[hsl(var(--site-primary)/0.05)] text-[hsl(var(--site-primary))] p-4 font-medium shadow-sm">
          <Info className="h-5 w-5 shrink-0 text-[hsl(var(--site-primary))]" />
          <span>
            Ao selecionar <strong className="font-extrabold">itens especiais</strong>, o valor final poderá ser
            alterado proporcionalmente.
          </span>
        </div>
      </div>

      {/* Step 2 — Flavors */}
      <div>
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-xl font-extrabold text-[hsl(var(--site-fg))]">2. Escolha os itens</h4>
          {size && (
            <span className="text-sm font-extrabold px-4 py-1.5 rounded-full bg-[hsl(var(--site-card))] border-2 border-[hsl(var(--site-primary))] text-[hsl(var(--site-primary))] shadow-sm">
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
          <div className="space-y-16">
            {/* Classic Flavors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="space-y-8" id="sabores-especiais">
                <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[hsl(var(--site-primary))] to-[hsl(var(--site-primary)/0.7)] p-10 shadow-[0_20px_50px_hsl(var(--site-primary)/0.3)] border border-white/10">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Sparkles className="h-40 w-40 text-white" />
                  </div>
                  <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="flex items-center justify-center h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md">
                          <Flame className="h-6 w-6 text-[hsl(var(--site-primary-fg))]" />
                        </span>
                        <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase italic">
                          Destaques Especiais
                        </h3>
                      </div>
                      <p className="text-white/90 font-medium max-w-lg text-lg">
                        Experimente nossas opções premium e itens exclusivos da casa.
                      </p>
                    </div>
                    <span className="px-6 py-3 rounded-2xl bg-[hsl(var(--site-card))] text-[hsl(var(--site-primary))] font-black text-sm uppercase tracking-widest shadow-xl">
                      Seleção Gourmet
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Step 3 — Adicionais */}
      {bordasCategory && bordasCategory.items.length > 0 && (
        <div className="space-y-4" ref={bordasRef}>
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-lg font-bold">3. Escolha um adicional (opcional)</h4>
            {scrollMessage && scrollMessage.includes("escolha") && (
              <span className="text-xs font-bold text-[hsl(var(--site-primary))] animate-bounce">
                {scrollMessage}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setSelectedBorderId(null)}
              className={`relative rounded-3xl border p-5 text-left transition-all duration-300 transform ${
                selectedBorderId === null
                  ? "border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.05)] shadow-[0_10px_30px_rgba(229,9,20,0.1)] ring-2 ring-[hsl(var(--site-primary)/0.2)]"
                  : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary)/0.3)]"
              }`}
            >
              {selectedBorderId === null && (
                <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] inline-flex items-center justify-center">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <p className="font-extrabold text-[hsl(var(--site-fg))] leading-tight">Sem Borda</p>
              <p className="text-[hsl(var(--site-secondary))] font-black mt-1">Grátis</p>
            </button>
            {bordasCategory.items.map((b) => {
              const active = selectedBorderId === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBorderId(b.id)}
                  className={`relative rounded-3xl border p-5 text-left transition-all duration-300 transform ${
                    active
                      ? "border-[hsl(var(--site-primary))] bg-[hsl(var(--site-primary)/0.05)] shadow-[0_10px_30px_hsl(var(--site-primary)/0.1)] ring-2 ring-[hsl(var(--site-primary)/0.2)]"
                      : "border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] hover:border-[hsl(var(--site-primary)/0.3)]"
                  }`}
                >
                  {active && (
                    <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] inline-flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                  <p className="font-extrabold text-[hsl(var(--site-fg))] leading-tight">{b.name}</p>
                  <p className="text-[hsl(var(--site-secondary))] font-black mt-1">+{formatBRL(b.price)}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      


        {/* Step 5 — Summary + add */}
        <div 
          id={`summary-${category.id}`}
          ref={summaryRef}
         className="rounded-[2.5rem] border border-[hsl(var(--site-border))] bg-[hsl(var(--site-card))] p-8 sm:p-10 shadow-[0_20px_60px_hsl(var(--site-bg)/0.3)] relative overflow-hidden"
       >
         {scrollMessage && scrollMessage.includes("pronto") && (
           <div className="absolute top-4 right-8 z-10">
             <span className="text-sm font-bold text-[hsl(var(--site-primary))] animate-pulse">
               {scrollMessage}
             </span>
           </div>
         )}
         <div className="absolute top-0 right-0 p-10 opacity-5">
           <ShoppingBag className="h-32 w-32 text-[hsl(var(--site-primary))]" />
         </div>
          <h4 className="text-2xl font-black mb-6 tracking-tight text-[hsl(var(--site-fg))]">Resumo da sua Pizza</h4>
        {size ? (
          <div className="space-y-4">
            <ul className="text-base text-[hsl(var(--site-muted-fg))] space-y-2">
              <li className="flex justify-between items-center border-b border-[hsl(var(--site-border))] pb-2">
                <span className="font-medium text-[hsl(var(--site-muted-fg))]">Tamanho: <strong className="text-[hsl(var(--site-fg))] font-extrabold">{size.label}</strong></span>
                <span className="font-extrabold text-[hsl(var(--site-fg))]">{formatBRL(size.price)}</span>
              </li>
              <li className="flex flex-col border-b border-[hsl(var(--site-border))] pb-2">
                <span className="font-medium">Sabores:</span>
                <span className="text-[hsl(var(--site-fg))] font-extrabold leading-relaxed">
                  {selectedFlavors.length === 0
                    ? "Nenhum selecionado"
                    : selectedFlavors
                        .map((id) => flavorMap.get(id)?.name)
                        .filter(Boolean)
                        .join(" + ")}
                </span>
              </li>
               {specialExtras > 0 && (
                  <li className="flex justify-between items-center border-b border-[hsl(var(--site-border))] pb-2 text-[hsl(var(--site-primary))]">
                    <span className="font-medium italic">Adicional especial {specialNames.length > 0 && `(${specialNames.join(", ")})`}:</span>
                    <span className="font-extrabold">+{formatBRL(specialExtras)}</span>
                  </li>
                )}
                {selectedBorder && (
                  <li className="flex justify-between items-center border-b border-[hsl(var(--site-border))] pb-2 text-[hsl(var(--site-secondary))]">
                    <span className="font-medium">Adicional: <strong className="font-extrabold">{selectedBorder.name}</strong></span>
                    <span className="font-extrabold">+{formatBRL(selectedBorder.price)}</span>
                  </li>
                )}
            </ul>
          </div>
        ) : (
          <p className="text-base text-[hsl(var(--site-muted-fg))] font-medium">Selecione um tamanho para ver o resumo.</p>
        )}
        
        <div className="flex items-center justify-between gap-6 mt-10 pt-8 border-t-2 border-dashed border-[hsl(var(--site-border))] flex-wrap">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-[hsl(var(--site-muted-fg))] font-bold mb-1">
              Total do Pedido
            </span>
            <span className="text-4xl font-black text-[hsl(var(--site-secondary))]">
              {size ? formatBRL(finalPrice) : "—"}
            </span>
          </div>
            <button
              onClick={(e) => handleAddToCart(false, e)}
              disabled={!canAdd}
              className="site-btn-primary px-10 py-6 rounded-full text-xl flex items-center gap-4 disabled:opacity-30 disabled:scale-100 disabled:shadow-none uppercase tracking-widest active:scale-95 transition-all group"
            >
              <Plus className="h-7 w-7 text-[hsl(var(--site-primary-fg))] group-hover:rotate-90 transition-transform" /> 
              <span>Adicionar ao Pedido</span>
            </button>
        </div>
        {confirm && (
          <div className="mt-6 text-base font-bold text-[hsl(var(--site-success))] bg-[hsl(var(--site-success)/0.1)] border-2 border-[hsl(var(--site-success)/0.2)] rounded-2xl p-4 text-center animate-in zoom-in duration-300">
            ✓ {confirm}
          </div>
        )}
      </div>

    </div>
  );
}


