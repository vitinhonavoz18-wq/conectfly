import { useEffect, useRef, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartContext";
import { formatBRL } from "@/lib/site/format";

/**
 * Universal floating cart button. Rendered once at the platform level
 * (see TemplateRenderer) so every current and future template inherits
 * the same behavior. Inherits colors from the active template via the
 * `--site-primary` / `--site-primary-fg` CSS variables.
 */
export function FloatingCartButton() {
  const { items, totalItems, totalPrice, isCartOpen, setCartOpen, validatedTable } = useCart();
  const [pulse, setPulse] = useState(false);
  const prevSignature = useRef<string>("");

  // Lightweight pulse whenever item count or subtotal changes.
  useEffect(() => {
    const sig = `${totalItems}|${totalPrice.toFixed(2)}`;
    if (prevSignature.current && prevSignature.current !== sig) {
      setPulse(true);
      const id = window.setTimeout(() => setPulse(false), 320);
      return () => window.clearTimeout(id);
    }
    prevSignature.current = sig;
  }, [totalItems, totalPrice]);

  if (!items.length || isCartOpen) return null;

  const label = validatedTable
    ? `Abrir carrinho da Mesa ${validatedTable.number}, ${totalItems} ${totalItems === 1 ? "item" : "itens"}, total ${formatBRL(totalPrice)}`
    : `Abrir carrinho, ${totalItems} ${totalItems === 1 ? "item" : "itens"}, total ${formatBRL(totalPrice)}`;

  return (
    <div
      className="fixed z-40 right-4 sm:right-6 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
    >
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        aria-label={label}
        data-floating-action="cart"
        className={[
          "pointer-events-auto group flex items-center gap-3 min-h-[48px] px-4 sm:px-5 py-3",
          "rounded-full border border-white/10",
          "bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))]",
          "shadow-[0_18px_40px_hsl(var(--site-primary)/0.45)]",
          "transition-transform duration-200 will-change-transform",
          "hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--site-primary-fg))] focus-visible:ring-offset-2",
          pulse ? "scale-[1.06]" : "scale-100",
        ].join(" ")}
      >
        <span className="relative flex items-center justify-center h-9 w-9 rounded-full bg-[hsl(var(--site-primary-fg)/0.15)]">
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[hsl(var(--site-primary-fg))] text-[hsl(var(--site-primary))] text-[11px] font-black flex items-center justify-center shadow"
          >
            {totalItems > 99 ? "99+" : totalItems}
          </span>
        </span>
        <span className="flex flex-col items-start leading-tight text-left">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">
            {totalItems === 1 ? "1 item" : `${totalItems} itens`}
          </span>
          <span className="text-sm sm:text-base font-black tabular-nums">
            {formatBRL(totalPrice)}
          </span>
        </span>
      </button>
    </div>
  );
}