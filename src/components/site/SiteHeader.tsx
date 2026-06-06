import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartContext";

interface Props {
  name: string;
  logoUrl: string | null;
  onOpenCart: () => void;
  showCartButton?: boolean;
}

export function SiteHeader({ name, logoUrl, onOpenCart, showCartButton = true }: Props) {
  const { totalItems } = useCart();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (totalItems > 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [totalItems]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 bg-[hsl(var(--site-header-bg)/0.95)] backdrop-blur-md border-b border-[hsl(var(--site-border))] transition-all duration-300"
    >
      <div className="max-w-6xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-4">
          <div 
            className="flex items-center gap-2 sm:gap-4 group cursor-pointer min-w-0"
            onClick={scrollToTop}
          >
           {logoUrl ? (
             <div className="relative shrink-0">
                <div className="absolute inset-0 bg-white/10 blur-xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity" />
                <img 
                  src={logoUrl} 
                  alt={name} 
                  className="h-10 w-10 sm:h-14 sm:w-14 object-contain group-hover:scale-110 transition-transform relative z-10"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-header-logo')?.classList.remove('hidden');
                  }}
                />
             </div>
           ) : null}
            {(!logoUrl || logoUrl) && (
              <div className={`fallback-header-logo h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-gold shadow-lg border border-white/20 shrink-0 ${logoUrl ? 'hidden' : ''}`} />
            )}
           <span className="font-extrabold tracking-tighter text-lg sm:text-2xl lg:text-3xl text-[hsl(var(--site-header-fg))] transition-colors truncate">{name}</span>
         </div>
          {showCartButton && (
            <button
              onClick={onOpenCart}
              className="relative group site-btn-primary px-4 sm:px-8 py-2.5 sm:py-3 rounded-full hover:scale-105 active:scale-95 uppercase text-[10px] sm:text-xs tracking-widest border border-[hsl(var(--site-border))] flex items-center gap-2 shrink-0 shadow-lg"
            >
             <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 group-hover:animate-bounce" />
             <span className="hidden xs:inline">Meu Pedido</span>
             {totalItems > 0 && (
               <span className={`absolute -top-1.5 -right-1.5 min-w-6 h-6 sm:min-w-7 sm:h-7 px-1 rounded-full bg-[hsl(var(--site-primary-fg))] text-[hsl(var(--site-primary))] text-[10px] sm:text-xs font-black flex items-center justify-center shadow-xl border-2 border-[hsl(var(--site-primary))] transition-transform duration-300 ${isAnimating ? 'scale-125 bg-white' : 'scale-100'}`}>
                 {totalItems}
               </span>
             )}
           </button>
         )}
      </div>
    </header>
  );
}
