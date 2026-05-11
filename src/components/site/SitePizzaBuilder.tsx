import { useMemo, useState, useEffect } from "react";
import { Check, Plus, Sparkles, Info, ImageIcon, ShoppingBag, Flame } from "lucide-react";
import type { MenuCategoryRow, MenuItemRow, PizzaSize, RestaurantRow } from "@/lib/site/types";
import { formatBRL } from "@/lib/site/format";
import { useCart } from "./CartContext";

interface Props {
  category: MenuCategoryRow & { items: MenuItemRow[] };
  restaurant?: RestaurantRow;
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
      {(restaurant?.show_item_images ?? true) && (
        it.image_url ? (
          <img
            src={it.image_url}
            alt={it.name}
            loading="lazy"
            className="h-20 w-20 rounded-lg object-cover shrink-0 border border-[hsl(var(--site-border))]"
          />
        ) : (
          <div className="h-20 w-20 rounded-lg shrink-0 border border-dashed border-[hsl(var(--site-border))] bg-black/20 flex items-center justify-center text-[hsl(var(--site-muted-fg))]">
            <ImageIcon className="h-6 w-6 opacity-40" />
          </div>
        )
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

export function SitePizzaBuilder({ category, restaurant }: Props) {
  const sizes: PizzaSize[] = category.pizza_sizes ?? [];
  const { addLine, setCartOpen } = useCart();
  const [sizeIdx, setSizeIdx] = useState<number | null>(sizes.length > 0 ? 0 : null);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);

  const size = sizeIdx !== null ? sizes[sizeIdx] : null;
  const maxFlavors = size?.max_flavors ?? 0;
  const remaining = Math.max(0, maxFlavors - selectedFlavors.length);
  const canAdd = !!size && selectedFlavors.length > 0;

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
  const finalPrice = (size?.price ?? 0) + specialExtras;
  const specialNames = selectedItems.filter((it) => it.is_special).map((it) => it.name);

  const toggleFlavor = (id: string) => {
    setSelectedFlavors((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= maxFlavors) return cur;
      const next = [...cur, id];
      
      if (next.length === maxFlavors) {
        setTimeout(() => {
          const beveragesSection = document.getElementById("bebidas");
          if (beveragesSection) {
            beveragesSection.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 600);
      }
      
      return next;
    });
  };

  const handleSelectSize = (i: number) => {
    setSizeIdx(i);
    const newMax = sizes[i].max_flavors;
    setSelectedFlavors((cur) => cur.slice(0, newMax));
  };

  const handleAddToCart = (shouldOpenCart = false) => {
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
    addLine({
      itemId: `pizza-${category.id}-${size.label}-${selectedFlavors.join("_")}`,
      name: `Pizza ${size.label}`,
      description: descParts.join(" • "),
      unitPrice: finalPrice,
      sizeLabel: size.label,
      flavors: flavorNames,
      specialFlavors: specialNames,
      extras: specialExtras,
    });
    setConfirm(`Pizza ${size.label} adicionada ao carrinho!`);
    setSelectedFlavors([]);
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

      {/* Step 3 — Summary + add */}
       <div 
         id={`summary-${category.id}`}
         className="rounded-[2rem] border border-white/10 bg-black/40 backdrop-blur-md p-8 shadow-2xl relative overflow-hidden"
       >
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
             onClick={() => handleAddToCart()}
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
