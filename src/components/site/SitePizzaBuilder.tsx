import { useMemo, useState, useEffect } from "react";
import { Check, Plus, Sparkles, Info, ImageIcon, ShoppingBag } from "lucide-react";
import type { MenuCategoryRow, MenuItemRow, PizzaSize, RestaurantRow } from "@/lib/site/types";
import { formatBRL } from "@/lib/site/format";
import { useCart } from "./CartContext";

interface Props {
  category: MenuCategoryRow & { items: MenuItemRow[] };
  restaurant?: RestaurantRow;
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

  const flavorMap = useMemo(() => {
    const m = new Map<string, MenuItemRow>();
    category.items.forEach((it) => m.set(it.id, it));
    return m;
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
      return [...cur, id];
    });
  };

  const handleSelectSize = (i: number) => {
    setSizeIdx(i);
    const newMax = sizes[i].max_flavors;
    setSelectedFlavors((cur) => cur.slice(0, newMax));
  };

  const handleAddToCart = (openCart = false) => {
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
    if (openCart) setCartOpen(true);
    setTimeout(() => setConfirm(null), 2200);
  };

  if (sizes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--site-border))] p-6 text-center text-[hsl(var(--site-muted-fg))]">
        Nenhum tamanho cadastrado para esta categoria.
      </div>
    );
  }

  // Monitor scroll to show floating button only when summary is not visible
  const [summaryVisible, setSummaryVisible] = useState(true);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setSummaryVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    const summaryEl = document.getElementById(`summary-${category.id}`);
    if (summaryEl) observer.observe(summaryEl);
    return () => observer.disconnect();
  }, [category.id]);

  const showFloating = canAdd && !summaryVisible;

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {category.items.map((it) => {
              const checked = selectedFlavors.includes(it.id);
              const disabled = !checked && selectedFlavors.length >= maxFlavors;
              return (
                 <button
                   key={it.id}
                   onClick={() => toggleFlavor(it.id)}
                   disabled={!size || disabled}
                   className={`relative text-left rounded-2xl border p-4 transition-all duration-300 flex items-start gap-4 overflow-hidden group ${
                     checked
                       ? "border-[hsl(var(--site-primary))] bg-gradient-to-br from-[hsl(var(--site-primary)/0.15)] to-transparent"
                       : "border-white/5 bg-white/5 hover:border-white/20"
                   } ${disabled ? "opacity-30 cursor-not-allowed" : "hover:scale-[1.01]"}`}
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
                    className={`mt-0.5 h-5 w-5 shrink-0 rounded border flex items-center justify-center ${
                      checked
                        ? "bg-[hsl(var(--site-primary))] border-[hsl(var(--site-primary))] text-white"
                        : "border-[hsl(var(--site-border))]"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold leading-tight">{it.name}</p>
                      {it.is_special && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
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
                </button>
              );
            })}
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
             onClick={handleAddToCart}
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

      {/* Floating Checkout Button */}
      <div 
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-md transition-all duration-500 transform ${
          showFloating ? "translate-y-0 opacity-100 scale-100" : "translate-y-20 opacity-0 scale-90 pointer-events-none"
        }`}
      >
        <button
          onClick={() => handleAddToCart(true)}
          className="btn-premium w-full py-5 rounded-2xl flex items-center justify-between px-8 shadow-[0_20px_50px_rgba(255,90,0,0.4)] border border-primary/30 group active:scale-95 transition-transform"
        >
          <div className="flex flex-col items-start">
            <span className="text-[10px] uppercase tracking-widest text-primary-foreground/70 font-black">Finalizar Pizza</span>
            <span className="text-xl font-black text-primary-foreground tracking-tighter">{formatBRL(finalPrice)}</span>
          </div>
          <div className="flex items-center gap-3 bg-white/20 px-4 py-2 rounded-xl group-hover:bg-white/30 transition-colors">
            <span className="font-bold text-sm uppercase tracking-tight">Finalizar</span>
            <Plus className="h-5 w-5" />
          </div>
        </button>
      </div>
    </div>
  );
}
