import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartContext";

interface Props {
  name: string;
  logoUrl: string | null;
  onOpenCart: () => void;
}

export function SiteHeader({ name, logoUrl, onOpenCart }: Props) {
  const { totalItems } = useCart();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
           ? "bg-[hsl(var(--site-bg)/0.7)] backdrop-blur-2xl border-b border-white/5 shadow-2xl"
           : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-4 group cursor-pointer"
            onClick={scrollToTop}
          >
           {logoUrl ? (
             <img 
               src={logoUrl} 
               alt={name} 
               className="h-11 w-11 object-contain group-hover:scale-110 transition-transform drop-shadow-lg"
               onError={(e) => {
                 (e.target as HTMLImageElement).style.display = 'none';
                 (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-header-logo')?.classList.remove('hidden');
               }}
             />
           ) : null}
           {(!logoUrl || logoUrl) && (
             <div className={`fallback-header-logo h-11 w-11 rounded-xl bg-gradient-bronze shadow-glow border border-primary/20 ${logoUrl ? 'hidden' : ''}`} />
           )}
             <div className="h-11 w-11 rounded-xl bg-gradient-bronze shadow-glow border border-primary/20" />
           )}
           <span className="font-black tracking-tighter text-xl sm:text-2xl group-hover:text-primary transition-colors">{name}</span>
         </div>
         <button
           onClick={onOpenCart}
           className="relative group inline-flex items-center gap-3 px-8 py-3 rounded-2xl bg-gradient-bronze text-primary-foreground font-black hover:scale-110 transition-all shadow-glow active:scale-95 shadow-2xl uppercase text-xs tracking-[0.2em]"
         >
           <ShoppingBag className="h-5 w-5 group-hover:animate-bounce" />
           <span className="hidden sm:inline">Meu Pedido</span>
           {totalItems > 0 && (
             <span className="absolute -top-3 -right-3 min-w-7 h-7 px-1 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center shadow-2xl border-2 border-primary animate-pulse">
               {totalItems}
             </span>
           )}
         </button>
      </div>
    </header>
  );
}