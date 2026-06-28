import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartContext";
import { SiteBrandLogo } from "./SiteBrandLogo";

interface Props {
  name: string;
  logoUrl: string | null;
  onOpenCart: () => void;
  showCartButton?: boolean;
}

export function SiteHeader({ name, logoUrl, onOpenCart, showCartButton = true }: Props) {
  const { totalItems } = useCart();
  const [isAnimating, setIsAnimating] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (totalItems > 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [totalItems]);

  // Collapse the stacked brand header into a slim bar on scroll so the
  // page content (categories, products) stays close to the top once the
  // user is browsing. Threshold = 64px (one tap below the fold).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setCollapsed(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header
      data-collapsed={collapsed ? "true" : "false"}
      className={[
        "fixed top-0 left-0 right-0 z-40 backdrop-blur-md border-b transition-all duration-300",
        collapsed
          ? "bg-[hsl(var(--site-header-bg)/0.95)] border-[hsl(var(--site-border))]"
          : "bg-[hsl(var(--site-header-bg)/0.6)] border-transparent",
      ].join(" ")}
    >
      {/* Expanded (default) — stacked brand block: LOGO on top, then name + cart row. */}
      <div
        className={[
          "max-w-6xl mx-auto px-4 transition-all duration-300",
          collapsed
            ? "h-16 sm:h-20 flex items-center justify-between gap-4"
            : "py-4 sm:py-6 flex flex-col items-center gap-3 sm:gap-4",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={scrollToTop}
          aria-label={`Voltar ao topo — ${name}`}
          className={[
            "group flex items-center gap-3 min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--site-primary))] rounded-xl",
            collapsed ? "flex-row" : "flex-col text-center",
          ].join(" ")}
        >
          <SiteBrandLogo
            name={name}
            logoUrl={logoUrl}
            variant={collapsed ? "compact" : "header"}
            priority
            className="group-hover:scale-[1.03] transition-transform"
          />
          <span
            className={[
              "font-extrabold tracking-tight text-[hsl(var(--site-header-fg))] truncate max-w-[80vw]",
              collapsed
                ? "text-base sm:text-xl lg:text-2xl"
                : "text-xl sm:text-3xl md:text-4xl",
            ].join(" ")}
          >
            {name}
          </span>
        </button>

        {showCartButton && (
          <button
            onClick={onOpenCart}
            aria-label={`Abrir carrinho${totalItems ? `, ${totalItems} ${totalItems === 1 ? "item" : "itens"}` : ""}`}
            className={[
              "relative group site-btn-primary rounded-full hover:scale-105 active:scale-95",
              "uppercase tracking-widest border border-[hsl(var(--site-border))] flex items-center gap-2 shadow-lg",
              collapsed
                ? "absolute right-4 top-1/2 -translate-y-1/2 px-4 sm:px-6 py-2 text-[10px] sm:text-xs"
                : "px-5 sm:px-7 py-2.5 text-[11px] sm:text-xs",
            ].join(" ")}
          >
            <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 group-hover:animate-bounce" aria-hidden="true" />
            <span>Meu Pedido</span>
            {totalItems > 0 && (
              <span
                aria-hidden="true"
                className={[
                  "absolute -top-1.5 -right-1.5 min-w-6 h-6 sm:min-w-7 sm:h-7 px-1 rounded-full",
                  "bg-[hsl(var(--site-primary-fg))] text-[hsl(var(--site-primary))]",
                  "text-[10px] sm:text-xs font-black flex items-center justify-center shadow-xl",
                  "border-2 border-[hsl(var(--site-primary))] transition-transform duration-300",
                  isAnimating ? "scale-125" : "scale-100",
                ].join(" ")}
              >
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
