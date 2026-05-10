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

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
           ? "bg-[hsl(var(--site-bg)/0.7)] backdrop-blur-2xl border-b border-white/5 shadow-2xl"
           : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
         <div className="flex items-center gap-4 group cursor-pointer">
           {logoUrl ? (
             <img src={logoUrl} alt={name} className="h-11 w-11 object-contain group-hover:scale-110 transition-transform" />
           ) : (
             <div className="h-11 w-11 rounded-xl bg-gradient-fire shadow-glow" />
           )}
           <span className="font-black tracking-tighter text-xl sm:text-2xl group-hover:text-primary transition-colors">{name}</span>
         </div>
         <button
           onClick={onOpenCart}
           className="relative group inline-flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-gradient-fire text-black font-black hover:scale-110 transition-all shadow-glow active:scale-95"
         >
           <ShoppingBag className="h-5 w-5 group-hover:animate-bounce" />
           <span className="hidden sm:inline text-sm uppercase tracking-widest">Meu Carrinho</span>
           {totalItems > 0 && (
             <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1 rounded-full bg-white text-black text-xs font-black flex items-center justify-center shadow-2xl border-2 border-primary">
               {totalItems}
             </span>
           )}
         </button>
      </div>
    </header>
  );
}