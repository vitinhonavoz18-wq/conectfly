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

/**
 * SiteHeader — bloco superior em fluxo (não-fixo) com altura controlada.
 *
 * - Altura fixa: mobile 200px / desktop 260px (não cresce com a logo).
 * - Logo contida (object-contain) com altura 100-140 mobile / 120-170 desktop.
 * - Empilhamento centralizado: LOGO → NOME → BOTÃO "MEU PEDIDO".
 * - overflow:hidden garante que nada invada o banner abaixo.
 */
export function SiteHeader({ name, logoUrl, onOpenCart, showCartButton = true }: Props) {
  const { totalItems } = useCart();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (totalItems > 0) {
      setIsAnimating(true);
      const t = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(t);
    }
  }, [totalItems]);

  return (
    <header
      className={[
        "relative w-full z-30 overflow-hidden",
        "bg-[hsl(var(--site-header-bg))] border-b border-[hsl(var(--site-border))]",
        // Altura fixa do container — não escala com a logo.
        "h-[200px] sm:h-[230px] lg:h-[260px]",
      ].join(" ")}
    >
      <div className="h-full max-w-6xl mx-auto px-4 flex flex-col items-center justify-center gap-2 sm:gap-3 text-center">
        {/* LOGO — contida, nunca invade o container */}
        <SiteBrandLogo
          name={name}
          logoUrl={logoUrl}
          variant="header"
          priority
        />

        {/* NOME do estabelecimento */}
        <h1 className="font-extrabold tracking-tight text-[hsl(var(--site-header-fg))] truncate max-w-[90vw] text-lg sm:text-xl lg:text-2xl leading-tight">
          {name}
        </h1>

        {/* BOTÃO Meu Pedido */}
        {showCartButton && (
          <button
            onClick={onOpenCart}
            aria-label={`Abrir carrinho${totalItems ? `, ${totalItems} ${totalItems === 1 ? "item" : "itens"}` : ""}`}
            className="relative group site-btn-primary rounded-full hover:scale-105 active:scale-95 uppercase tracking-widest border border-[hsl(var(--site-border))] flex items-center gap-2 shadow-lg px-4 sm:px-5 py-2 text-[10px] sm:text-xs"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            <span>Meu Pedido</span>
            {totalItems > 0 && (
              <span
                aria-hidden="true"
                className={[
                  "absolute -top-1.5 -right-1.5 min-w-5 h-5 sm:min-w-6 sm:h-6 px-1 rounded-full",
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
