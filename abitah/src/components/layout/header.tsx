"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { LogoLink } from "@/components/brand/logo";
import { mainNav } from "@/config/navigation";
import { useCart } from "@/store/cart-context";
import { useAuth } from "@/store/auth-context";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { count, openCart, hydrated } = useCart();
  const { user, authEnabled } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Fecha os painéis ao navegar (ajuste de estado durante o render — padrão
  // recomendado pelo React em vez de um efeito).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `/loja?busca=${encodeURIComponent(term)}` : "/loja");
    setSearchOpen(false);
    setMenuOpen(false);
  }

  const accountHref = authEnabled ? (user ? "/conta/perfil" : "/conta/entrar") : "/conta";

  return (
    <header
      className={cn(
        "sticky top-0 z-60 w-full border-b transition-all duration-300",
        scrolled
          ? "border-ink-700 bg-ink-950/92 backdrop-blur-md"
          : "border-transparent bg-ink-950",
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-3 lg:h-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            className="-ml-2 rounded-md p-2 text-smoke-200 transition-colors hover:text-neon-400 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          <LogoLink width={200} height={46} priority className="h-8 lg:h-10" />
        </div>

        <nav aria-label="Navegação principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {mainNav.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.split("?")[0]);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "relative rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors",
                      active ? "text-neon-400" : "text-smoke-200 hover:text-white",
                    )}
                  >
                    {item.label}
                    <span
                      className={cn(
                        "absolute inset-x-3 -bottom-0.5 h-0.5 origin-left rounded-full bg-neon-500 transition-transform duration-300",
                        active ? "scale-x-100" : "scale-x-0",
                      )}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-0.5">
          <form onSubmit={submitSearch} className="hidden xl:block">
            <label htmlFor="header-search" className="sr-only">
              Buscar produtos
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-smoke-400"
                aria-hidden
              />
              <input
                id="header-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar produtos"
                className="h-10 w-48 rounded-lg border border-ink-600 bg-ink-900 pl-9 pr-3 text-sm text-white placeholder:text-smoke-400 transition-all focus:w-60 focus:border-neon-500 focus:outline-none"
              />
            </div>
          </form>

          <button
            type="button"
            onClick={() => setSearchOpen((value) => !value)}
            aria-label="Buscar"
            aria-expanded={searchOpen}
            className="rounded-md p-2.5 text-smoke-200 transition-colors hover:text-neon-400 xl:hidden"
          >
            <Search className="h-5 w-5" />
          </button>

          <Link
            href={accountHref}
            aria-label="Minha conta"
            className="rounded-md p-2.5 text-smoke-200 transition-colors hover:text-neon-400"
          >
            <User className="h-5 w-5" />
          </Link>

          <button
            type="button"
            onClick={openCart}
            aria-label={`Carrinho com ${count} ${count === 1 ? "item" : "itens"}`}
            className="relative rounded-md p-2.5 text-smoke-200 transition-colors hover:text-neon-400"
          >
            <ShoppingBag className="h-5 w-5" />
            {hydrated && count > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-neon-500 px-1 text-[10px] font-bold text-ink-950">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Busca mobile */}
      {searchOpen ? (
        <div className="border-t border-ink-700 bg-ink-900 px-4 py-3 xl:hidden">
          <form onSubmit={submitSearch} className="container-page flex gap-2 px-0">
            <label htmlFor="mobile-search" className="sr-only">
              Buscar produtos
            </label>
            <input
              id="mobile-search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="O que você procura?"
              className="h-11 flex-1 rounded-lg border border-ink-600 bg-ink-850 px-3.5 text-sm text-white placeholder:text-smoke-400 focus:border-neon-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-neon-500 px-4 text-xs font-bold uppercase text-ink-950"
            >
              Buscar
            </button>
          </form>
        </div>
      ) : null}

      {/* Menu lateral mobile */}
      <div
        className={cn(
          "fixed inset-0 z-70 lg:hidden",
          menuOpen ? "visible" : "invisible pointer-events-none",
        )}
        aria-hidden={!menuOpen}
      >
        <div
          onClick={() => setMenuOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/70 transition-opacity duration-300",
            menuOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <nav
          aria-label="Menu"
          className={cn(
            "absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col border-r border-ink-700 bg-ink-900 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            menuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
            <LogoLink width={170} height={39} className="h-7" />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
              className="rounded-md p-1.5 text-smoke-300 hover:text-neon-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <ul className="flex-1 overflow-y-auto px-3 py-4">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between rounded-lg px-3 py-3.5 text-sm font-bold uppercase tracking-wide text-smoke-100 transition-colors hover:bg-white/5 hover:text-neon-400"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-ink-700 p-4">
            <Link
              href={accountHref}
              className="flex items-center gap-2 rounded-lg bg-ink-800 px-4 py-3 text-sm font-semibold text-smoke-100 hover:text-neon-400"
            >
              <User className="h-4 w-4" />
              {user ? "Minha conta" : "Entrar / Criar conta"}
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
