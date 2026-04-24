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
          ? "bg-[hsl(var(--site-bg)/0.85)] backdrop-blur-md border-b border-[hsl(var(--site-border))]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={name} className="h-10 w-10 object-contain" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-[hsl(var(--site-primary))]" />
          )}
          <span className="font-bold tracking-tight text-lg">{name}</span>
        </div>
        <button
          onClick={onOpenCart}
          className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--site-primary))] text-white font-medium hover:opacity-90 transition shadow-lg"
        >
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden sm:inline">Pedido</span>
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[hsl(var(--site-secondary))] text-black text-xs font-bold flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}