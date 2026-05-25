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
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header
       className="fixed top-0 left-0 right-0 z-40 bg-[hsl(var(--site-primary))] backdrop-blur-2xl border-b border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.15)]"
    >
      <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div 
            className="flex items-center gap-4 group cursor-pointer"
            onClick={scrollToTop}
          >
           {logoUrl ? (
             <div className="relative">
                <div className="absolute inset-0 bg-white/20 blur-xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity" />
                <img 
                  src={logoUrl} 
                  alt={name} 
                  className="h-14 w-14 object-contain group-hover:scale-110 transition-transform relative z-10"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-header-logo')?.classList.remove('hidden');
                  }}
                />
             </div>
           ) : null}
            {(!logoUrl || logoUrl) && (
              <div className={`fallback-header-logo h-12 w-12 rounded-xl bg-gradient-gold shadow-lg border border-white/20 ${logoUrl ? 'hidden' : ''}`} />
            )}
           <span className="font-extrabold tracking-tighter text-2xl sm:text-3xl text-white group-hover:text-amber-200 transition-colors">{name}</span>
         </div>
         {showCartButton && (
           <button
             onClick={onOpenCart}
             className="relative group inline-flex items-center gap-3 px-6 sm:px-8 py-3 rounded-full bg-gradient-gold text-white font-extrabold hover:scale-105 transition-all shadow-[0_8px_25px_rgba(217,164,65,0.35)] active:scale-95 uppercase text-xs tracking-widest border border-white/20"
           >
             <ShoppingBag className="h-5 w-5 group-hover:animate-bounce" />
             <span className="hidden sm:inline">Meu Pedido</span>
             {totalItems > 0 && (
               <span className="absolute -top-2 -right-2 min-w-7 h-7 px-1 rounded-full bg-white text-red-600 text-xs font-black flex items-center justify-center shadow-xl border-2 border-amber-400 animate-in zoom-in duration-300">
                 {totalItems}
               </span>
             )}
           </button>
         )}
      </div>
    </header>
  );
}