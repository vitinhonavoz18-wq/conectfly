import JSZip from "jszip";
import type { SiteData } from "./types";

/**
 * Generates a standalone Vite + React + Tailwind v3 + TypeScript project zip
 * matching the El Shadai blueprint, with the restaurant data hardcoded.
 * The output is a fully working project the user can `npm install && npm run dev`.
 */
export async function buildProjectZip(data: SiteData): Promise<Blob> {
  const zip = new JSZip();
  const r = data.restaurant;
  const rootName = r.slug || "delivery-site";

  const json = (v: unknown) => JSON.stringify(v, null, 2);

  zip.file(
    "package.json",
    json({
      name: rootName,
      private: true,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
        "lucide-react": "^0.462.0",
      },
      devDependencies: {
        "@types/react": "^18.3.3",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.3.1",
        autoprefixer: "^10.4.19",
        postcss: "^8.4.40",
        tailwindcss: "^3.4.7",
        typescript: "^5.5.4",
        vite: "^5.4.0",
      },
    }),
  );

  zip.file(
    "vite.config.ts",
    `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`,
  );

  zip.file(
    "tsconfig.json",
    json({
      compilerOptions: {
        target: "ES2020",
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
        forceConsistentCasingInFileNames: true,
        noEmit: true,
        isolatedModules: true,
      },
      include: ["src"],
    }),
  );

  zip.file(
    "tailwind.config.ts",
    `import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        site: {
          bg: "hsl(var(--site-bg) / <alpha-value>)",
          fg: "hsl(var(--site-fg) / <alpha-value>)",
          card: "hsl(var(--site-card) / <alpha-value>)",
          border: "hsl(var(--site-border) / <alpha-value>)",
          primary: "hsl(var(--site-primary) / <alpha-value>)",
          secondary: "hsl(var(--site-secondary) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
`,
  );

  zip.file(
    "postcss.config.js",
    `export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
`,
  );

  zip.file(
    "index.html",
    `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(r.name)}</title>
    <meta name="description" content="${escapeHtml(r.description ?? r.name)}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  );

  zip.file(
    "README.md",
    `# ${r.name}

Site de delivery gerado pela plataforma **SiteCreatorFly**.

## Como rodar

\`\`\`bash
npm install
npm run dev
\`\`\`

## Como publicar

1. \`npm run build\`
2. Faça upload da pasta \`dist/\` em qualquer hospedagem estática (Vercel, Netlify, Cloudflare Pages, etc.).
3. Conecte seu domínio próprio.

## Como editar

- **Cardápio:** \`src/data/menuData.ts\`
- **Combos:** \`src/data/comboData.ts\`
- **Informações:** \`src/data/restaurant.ts\`
- **Logo:** substitua \`src/assets/logo.png\` (se aplicável) ou edite a URL em \`restaurant.ts\`
- **Cores:** ajuste \`--site-primary\` e \`--site-secondary\` em \`src/index.css\`
- **WhatsApp:** edite \`whatsapp_number\` em \`restaurant.ts\` (formato 55 + DDD + número)
`,
  );

  zip.file("DOCUMENTACAO.md", buildDocumentacao(data));

  zip.file(
    "start.sh",
    `#!/usr/bin/env bash
# Script de inicialização rápida para o projeto ${r.name}
set -e

echo "📦 Instalando dependências..."
npm install

echo "🚀 Iniciando servidor de desenvolvimento..."
npm run dev
`,
  );

  zip.file(
    ".gitignore",
    `node_modules
dist
.DS_Store
*.log
.env
.env.local
`,
  );

  zip.file(
    "src/main.tsx",
    `import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
  );

  zip.file(
    "src/index.css",
    `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --site-bg: 12 8% 8%;
  --site-fg: 30 20% 96%;
  --site-card: 12 8% 12%;
  --site-border: 12 8% 20%;
  --site-muted-fg: 30 10% 70%;
  --site-primary: ${r.primary_color};
  --site-secondary: ${r.secondary_color};
}

body {
  margin: 0;
  background: hsl(var(--site-bg));
  color: hsl(var(--site-fg));
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.scrollbar-hide { scrollbar-width: none; }
.scrollbar-hide::-webkit-scrollbar { display: none; }

/* Scroll-driven animations */
@keyframes site-hero-enter {
  0% { opacity: 0; transform: translateY(24px) scale(0.98); filter: blur(6px); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
.site-hero-enter > * { animation: site-hero-enter 900ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.site-hero-enter > *:nth-child(1) { animation-delay: 80ms; }
.site-hero-enter > *:nth-child(2) { animation-delay: 220ms; }
.site-hero-enter > *:nth-child(3) { animation-delay: 340ms; }
.site-hero-enter > *:nth-child(4) { animation-delay: 460ms; }
.site-hero-enter > *:nth-child(5) { animation-delay: 580ms; }

@keyframes site-stagger-in {
  0% { opacity: 0; transform: translateY(24px); }
  100% { opacity: 1; transform: translateY(0); }
}
.site-stagger > * { opacity: 0; animation: site-stagger-in 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.site-stagger > *:nth-child(1) { animation-delay: 60ms; }
.site-stagger > *:nth-child(2) { animation-delay: 140ms; }
.site-stagger > *:nth-child(3) { animation-delay: 220ms; }
.site-stagger > *:nth-child(4) { animation-delay: 300ms; }
.site-stagger > *:nth-child(5) { animation-delay: 380ms; }
.site-stagger > *:nth-child(6) { animation-delay: 460ms; }
.site-stagger > *:nth-child(7) { animation-delay: 540ms; }
.site-stagger > *:nth-child(8) { animation-delay: 620ms; }
.site-stagger > *:nth-child(n+9) { animation-delay: 700ms; }

.reveal { opacity: 0; transform: translateY(32px); transition: opacity 700ms cubic-bezier(0.22,1,0.36,1), transform 700ms cubic-bezier(0.22,1,0.36,1); will-change: opacity, transform; }
.reveal.is-visible { opacity: 1; transform: none; }

/* Scroll-driven per-section progress utilities */
.site-section-scroll {
  --section-progress: 0;
  --section-progress-in: 0;
  --section-progress-out: 0;
  --section-progress-center: 0;
}
.site-scroll-fade { opacity: var(--section-progress-in); will-change: opacity; }
.site-scroll-rise {
  transform: translate3d(0, calc((1 - var(--section-progress-in)) * 60px), 0);
  opacity: var(--section-progress-in);
  will-change: transform, opacity;
}
.site-scroll-zoom {
  transform: scale(calc(0.92 + var(--section-progress-in) * 0.08));
  opacity: var(--section-progress-in);
  transform-origin: center;
  will-change: transform, opacity;
}
.site-scroll-blur {
  filter: blur(calc((1 - var(--section-progress-in)) * 8px));
  opacity: calc(0.4 + var(--section-progress-in) * 0.6);
  will-change: filter, opacity;
}
.site-scroll-parallax-bg {
  transform: translate3d(0, calc((var(--section-progress) - 0.5) * -80px), 0) scale(1.08);
  will-change: transform;
}
.site-scroll-slide-left {
  transform: translate3d(calc((1 - var(--section-progress-in)) * -48px), 0, 0);
  opacity: var(--section-progress-in);
  will-change: transform, opacity;
}
.site-scroll-slide-right {
  transform: translate3d(calc((1 - var(--section-progress-in)) * 48px), 0, 0);
  opacity: var(--section-progress-in);
  will-change: transform, opacity;
}
.site-scroll-headline {
  transform: translate3d(0, calc((1 - var(--section-progress-center)) * 16px), 0);
  opacity: calc(0.55 + var(--section-progress-center) * 0.45);
  will-change: transform, opacity;
}

@media (prefers-reduced-motion: reduce) {
  .site-hero-enter > *, .site-stagger > *, .reveal {
    animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; transition: none !important;
  }
  .site-scroll-fade, .site-scroll-rise, .site-scroll-zoom, .site-scroll-blur,
  .site-scroll-parallax-bg, .site-scroll-slide-left, .site-scroll-slide-right, .site-scroll-headline {
    opacity: 1 !important; transform: none !important; filter: none !important;
  }
}
`,
  );

  zip.file(
    "src/data/restaurant.ts",
    `export const restaurant = ${json({
      name: r.name,
      tagline: r.tagline,
      description: r.description,
      whatsapp_number: r.whatsapp_number,
      whatsapp_display: r.whatsapp_display,
      address: r.address,
      hours: r.hours,
      city: r.city,
      logo_url: r.logo_url,
      hero_image_url: r.hero_image_url,
      hero_media_type: r.hero_media_type,
      hero_video_url: r.hero_video_url,
      flycontrol_enabled: !!r.flycontrol_enabled,
      flycontrol_api_url: r.flycontrol_api_url ?? "",
      flycontrol_api_key: "", // Removido por segurança. Use segredos no servidor (Edge Functions).
      flycontrol_base_url: r.flycontrol_base_url ?? "",
      flycontrol_tenant_id: r.flycontrol_tenant_id ?? "",
      whatsapp_enabled: r.whatsapp_enabled !== false,
    })} as const;
`,
  );

  zip.file(
    "src/data/menuData.ts",
    `export interface Size { label: string; price: number }
export interface PizzaSize { label: string; price: number; max_flavors: number }
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  sizes?: Size[];
  is_special?: boolean;
  special_extra?: number;
  image_url?: string;
}
export interface MenuCategory {
  id: string;
  name: string;
  icon?: string;
  image_url?: string;
  is_pizza?: boolean;
  pizza_sizes?: PizzaSize[];
  items: MenuItem[];
}

export const menuCategories: MenuCategory[] = ${json(
      data.categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon ?? undefined,
        image_url: c.image_url ?? undefined,
        is_pizza: c.is_pizza || undefined,
        pizza_sizes: c.pizza_sizes ?? undefined,
        items: c.items.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description ?? "",
          price: i.price,
          sizes: i.sizes ?? undefined,
          is_special: i.is_special || undefined,
          special_extra: i.special_extra || undefined,
          image_url: i.image_url ?? undefined,
        })),
      })),
    )};
`,
  );

  zip.file(
    "src/data/comboData.ts",
    `export interface ComboItem {
  id: string;
  name: string;
  items: string[];
  price: number;
  badge?: string;
}
export interface ComboGroup {
  id: string;
  title: string;
  combos: ComboItem[];
}

export const comboGroups: ComboGroup[] = ${json(
      data.comboGroups.map((g) => ({
        id: g.id,
        title: g.title,
        combos: g.combos.map((c) => ({
          id: c.id,
          name: c.name,
          items: c.items,
          price: c.price,
          badge: c.badge ?? undefined,
        })),
      })),
    )};
`,
  );

  zip.file(
    "src/data/deliveryZones.ts",
    `export interface DeliveryZone { id: string; neighborhood: string; fee: number }
export const deliveryZones: DeliveryZone[] = ${json(
      (data.deliveryZones ?? []).map((z) => ({
        id: z.id,
        neighborhood: z.neighborhood,
        fee: Number(z.fee) || 0,
      })),
    )};
`,
  );

  // App + components
  zip.file("src/App.tsx", APP_TSX);
  zip.file("src/lib/format.ts", FORMAT_TS);
  zip.file("src/context/CartContext.tsx", CART_CTX);
  zip.file("src/components/Header.tsx", HEADER_TSX);
  zip.file("src/components/Hero.tsx", HERO_TSX);
  zip.file("src/components/MenuItemCard.tsx", MENU_CARD_TSX);
  zip.file("src/components/MenuSection.tsx", MENU_SECTION_TSX);
  zip.file("src/components/ComboSection.tsx", COMBO_SECTION_TSX);
  zip.file("src/components/CartDrawer.tsx", CART_DRAWER_TSX);
  zip.file("src/components/Footer.tsx", FOOTER_TSX);
  zip.file("src/components/Reveal.tsx", REVEAL_TSX);

  return zip.generateAsync({ type: "blob" });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ===========  Static template files (string constants)  =========== */

const APP_TSX = `import { useState } from "react";
import { CartProvider } from "./context/CartContext";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { ComboSection } from "./components/ComboSection";
import { MenuSection } from "./components/MenuSection";
import { CartDrawer } from "./components/CartDrawer";
import { Footer } from "./components/Footer";
import { Reveal, ScrollProgress, SectionScroll } from "./components/Reveal";

export function App() {
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <CartProvider>
      <ScrollProgress />
      <Header onOpenCart={() => setCartOpen(true)} />
      <main>
        <SectionScroll className="site-hero-section"><Hero /></SectionScroll>
        <SectionScroll>
          <Reveal><div className="site-scroll-rise"><ComboSection /></div></Reveal>
        </SectionScroll>
        <SectionScroll>
          <Reveal delay={80}><div className="site-scroll-rise"><MenuSection /></div></Reveal>
        </SectionScroll>
      </main>
      <Reveal><Footer /></Reveal>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </CartProvider>
  );
}
`;

const FORMAT_TS = `export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function formatPhoneMask(v: string): string {
  const d = v.replace(/\\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return \`(\${d.slice(0, 2)}) \${d.slice(2)}\`;
  return \`(\${d.slice(0, 2)}) \${d.slice(2, 7)}-\${d.slice(7)}\`;
}
`;

const CART_CTX = `import { createContext, useContext, useMemo, useState, ReactNode } from "react";

export interface CartLine {
  itemId: string;
  name: string;
  description: string;
  unitPrice: number;
  quantity: number;
  sizeLabel?: string;
  flavors?: string[];
}

interface Ctx {
  items: CartLine[];
  addLine: (line: Omit<CartLine, "quantity">, qty?: number) => void;
  updateQty: (id: string, sizeLabel: string | undefined, qty: number) => void;
  removeLine: (id: string, sizeLabel?: string) => void;
  clear: () => void;
  totalItems: number;
  totalPrice: number;
}

const C = createContext<Ctx | null>(null);
const k = (id: string, s?: string) => \`\${id}-\${s ?? ""}\`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const addLine: Ctx["addLine"] = (line, qty = 1) => {
    setItems((cur) => {
      const i = cur.findIndex((l) => k(l.itemId, l.sizeLabel) === k(line.itemId, line.sizeLabel));
      if (i >= 0) { const c = [...cur]; c[i] = { ...c[i], quantity: c[i].quantity + qty }; return c; }
      return [...cur, { ...line, quantity: qty }];
    });
  };
  const updateQty: Ctx["updateQty"] = (id, s, q) => {
    setItems((c) => q <= 0 ? c.filter((l) => k(l.itemId, l.sizeLabel) !== k(id, s)) : c.map((l) => k(l.itemId, l.sizeLabel) === k(id, s) ? { ...l, quantity: q } : l));
  };
  const removeLine: Ctx["removeLine"] = (id, s) => setItems((c) => c.filter((l) => k(l.itemId, l.sizeLabel) !== k(id, s)));
  const value = useMemo<Ctx>(() => ({
    items, addLine, updateQty, removeLine, clear: () => setItems([]),
    totalItems: items.reduce((s, l) => s + l.quantity, 0),
    totalPrice: items.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
  }), [items]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useCart() { const v = useContext(C); if (!v) throw new Error("useCart"); return v; }
`;

const HEADER_TSX = `import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { restaurant } from "../data/restaurant";
import { useCart } from "../context/CartContext";

export function Header({ onOpenCart }: { onOpenCart: () => void }) {
  const { totalItems } = useCart();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 50);
    f(); window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <header className={\`fixed top-0 left-0 right-0 z-40 transition-all \${scrolled ? "bg-site-bg/85 backdrop-blur-md border-b border-site-border" : "bg-transparent"}\`}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {restaurant.logo_url && <img src={restaurant.logo_url} alt={restaurant.name} className="h-10 w-10 object-contain" />}
          <span className="font-bold tracking-tight text-lg">{restaurant.name}</span>
        </div>
        <button onClick={onOpenCart} className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-site-primary text-white font-medium hover:opacity-90 shadow-lg">
          <ShoppingBag className="h-4 w-4" /><span className="hidden sm:inline">Pedido</span>
          {totalItems > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-site-secondary text-black text-xs font-bold flex items-center justify-center">{totalItems}</span>}
        </button>
      </div>
    </header>
  );
}
`;

const HERO_TSX = `import { restaurant } from "../data/restaurant";

export function Hero() {
  return (
    <div className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 site-scroll-parallax-bg">
        {restaurant.hero_media_type === "video" && restaurant.hero_video_url
          ? <video src={restaurant.hero_video_url} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
          : restaurant.hero_image_url && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: \`url(\${restaurant.hero_image_url})\` }} />}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-site-bg/70 via-site-bg/85 to-site-bg" />
      <div className="relative z-10 text-center px-4 py-20 site-hero-enter">
        {restaurant.logo_url
          ? <img src={restaurant.logo_url} alt={restaurant.name} className="mx-auto mb-6 h-48 sm:h-64 md:h-80 w-auto object-contain drop-shadow-2xl" />
          : <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6">{restaurant.name}</h1>}
        {restaurant.tagline && <p className="text-xl sm:text-2xl font-semibold text-site-secondary mb-3">{restaurant.tagline}</p>}
        {restaurant.description && <p className="max-w-xl mx-auto text-site-fg/70">{restaurant.description}</p>}
        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          <a href="#combos" className="px-6 py-3 rounded-full bg-site-secondary text-black font-bold transition transform hover:-translate-y-0.5 hover:shadow-lg hover:opacity-95">Ver combos</a>
          <a href="#cardapio" className="px-6 py-3 rounded-full border border-site-border font-bold transition transform hover:-translate-y-0.5 hover:bg-site-card">Cardápio</a>
        </div>
      </div>
    </div>
  );
}
`;

const REVEAL_TSX = `import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  threshold?: number;
  className?: string;
}

export function Reveal({ children, delay = 0, threshold = 0.15, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setVisible(true); return; }
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(e.target); } });
    }, { threshold, rootMargin: "0px 0px -10% 0px" });
    obs.observe(node);
    return () => obs.disconnect();
  }, [threshold]);
  return (
    <div ref={ref} className={\`reveal \${visible ? "is-visible" : ""} \${className}\`} style={{ transitionDelay: \`\${delay}ms\` }}>
      {children}
    </div>
  );
}

export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const h = document.documentElement;
      const max = (h.scrollHeight - h.clientHeight) || 1;
      setP(Math.min(100, Math.max(0, (h.scrollTop / max) * 100)));
      raf = 0;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div aria-hidden style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 60, pointerEvents: "none" }}>
      <div style={{ height: "100%", width: \`\${p}%\`, background: "hsl(var(--site-primary))", boxShadow: "0 0 8px hsl(var(--site-primary))", transition: "width 75ms ease-out" }} />
    </div>
  );
}

/**
 * Per-section scroll progress (0 → 1) exposed as CSS variables so children
 * can drive synchronized animations without extra JS:
 *   --section-progress, --section-progress-in, --section-progress-out, --section-progress-center
 */
export function useSectionProgress() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      node.style.setProperty("--section-progress", "0.5");
      node.style.setProperty("--section-progress-in", "1");
      node.style.setProperty("--section-progress-out", "0");
      node.style.setProperty("--section-progress-center", "1");
      return;
    }
    let raf = 0;
    let visible = false;
    const update = () => {
      raf = 0;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = rect.height + vh;
      const traveled = vh - rect.top;
      const raw = Math.min(1, Math.max(0, traveled / total));
      const inPhase = Math.min(1, Math.max(0, (vh - rect.top) / vh));
      const outPhase = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));
      const sectionCenter = rect.top + rect.height / 2;
      const dist = Math.abs(sectionCenter - vh / 2) / (vh / 2 + rect.height / 2);
      const center = Math.max(0, 1 - dist);
      node.style.setProperty("--section-progress", raw.toFixed(4));
      node.style.setProperty("--section-progress-in", inPhase.toFixed(4));
      node.style.setProperty("--section-progress-out", outPhase.toFixed(4));
      node.style.setProperty("--section-progress-center", center.toFixed(4));
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { visible = e.isIntersecting; if (visible) schedule(); });
    }, { rootMargin: "20% 0px 20% 0px" });
    io.observe(node);
    const onScroll = () => { if (visible) schedule(); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}

export function SectionScroll({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useSectionProgress();
  return (
    <section ref={ref as any} className={\`site-section-scroll \${className}\`}>
      {children}
    </section>
  );
}
`;

const MENU_CARD_TSX = `import { useState } from "react";
import { Plus, ImageIcon } from "lucide-react";
import type { MenuItem, Size } from "../data/menuData";
import { formatBRL } from "../lib/format";
import { useCart } from "../context/CartContext";

export function MenuItemCard({ item }: { item: MenuItem }) {
  const { addLine } = useCart();
  const sizes: Size[] = item.sizes ?? [];
  const [sel, setSel] = useState<Size | null>(sizes[0] ?? null);
  const price = sel ? sel.price : item.price;
  const consult = !sel && item.price === 0;
  return (
    <div className="rounded-xl border border-site-border bg-site-card flex flex-col gap-3 hover:border-site-primary transition overflow-hidden shadow-lg group">
      {item.image_url ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-black/30">
          <img src={item.image_url} alt={item.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      ) : (
        <div className="relative aspect-[4/3] flex items-center justify-center bg-site-card text-site-fg/40">
          <ImageIcon className="h-10 w-10 opacity-40" />
        </div>
      )}
      <div className="p-5 pt-2 flex flex-col gap-3 flex-1">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-lg leading-tight">{item.name}</h3>
        <span className="text-site-secondary font-bold whitespace-nowrap">{consult ? "Consultar" : formatBRL(price)}</span>
      </div>
      {item.description && <p className="text-sm text-site-fg/70">{item.description}</p>}
      {sizes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => (
            <button key={s.label} onClick={() => setSel(s)} className={\`px-3 py-1 text-sm rounded-full border transition \${sel?.label === s.label ? "bg-site-primary border-site-primary text-white" : "border-site-border hover:border-site-primary"}\`}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => addLine({ itemId: item.id, name: item.name, description: item.description, unitPrice: price, sizeLabel: sel?.label })} disabled={consult}
        className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-site-primary text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
        <Plus className="h-4 w-4" /> Adicionar
      </button>
      </div>
    </div>
  );
}
`;

const MENU_SECTION_TSX = `import { useState } from "react";
import { ImageIcon, Check, Plus, Sparkles, Info } from "lucide-react";
import { menuCategories, type MenuCategory } from "../data/menuData";
import { MenuItemCard } from "./MenuItemCard";
import { formatBRL } from "../lib/format";
import { useCart } from "../context/CartContext";

export function MenuSection() {
  const [act, setAct] = useState<string | null>(null);
  if (menuCategories.length === 0) return null;
  const cur = act ? menuCategories.find((c) => c.id === act) ?? null : null;
  return (
    <section id="cardapio" className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Cardápio</h2>
          <p className="text-site-fg/70 mt-2">{cur ? "Escolha seus pratos favoritos" : "Toque em uma categoria para ver os produtos"}</p>
        </div>
        {!cur ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 site-stagger">
            {menuCategories.map((c) => (
              <button key={c.id} onClick={() => setAct(c.id)} className="group relative aspect-square rounded-2xl overflow-hidden border border-site-border bg-site-card hover:border-site-primary transition shadow-lg">
                {c.image_url
                  ? <img src={c.image_url} alt={c.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  : <div className="absolute inset-0 flex items-center justify-center text-site-fg/40"><ImageIcon className="h-10 w-10" /></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 text-left">
                  <h3 className="text-white font-black text-base sm:text-lg leading-tight drop-shadow">{c.icon ? \`\${c.icon} \` : ""}{c.name}</h3>
                  <p className="text-white/80 text-xs mt-0.5">{c.is_pizza ? \`\${c.items.length} \${c.items.length === 1 ? "sabor" : "sabores"}\` : \`\${c.items.length} \${c.items.length === 1 ? "item" : "itens"}\`}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <button onClick={() => setAct(null)} className="px-4 py-2 rounded-full text-sm font-semibold bg-site-card border border-site-border hover:border-site-primary">← Categorias</button>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 min-w-0">
                {menuCategories.map((c) => (
                  <button key={c.id} onClick={() => setAct(c.id)} className={\`px-5 py-2 rounded-full whitespace-nowrap font-semibold text-sm transition \${act === c.id ? "bg-site-primary text-white" : "bg-site-card border border-site-border hover:border-site-primary"}\`}>
                    {c.icon ? \`\${c.icon} \` : ""}{c.name}
                  </button>
                ))}
              </div>
            </div>
            {cur.image_url && (
              <div className="relative h-40 sm:h-56 rounded-2xl overflow-hidden mb-6 border border-site-border">
                <img src={cur.image_url} alt={cur.name} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <h3 className="absolute bottom-4 left-4 text-3xl font-black text-white drop-shadow">{cur.icon ? \`\${cur.icon} \` : ""}{cur.name}</h3>
              </div>
            )}
            {cur.is_pizza && cur.pizza_sizes && cur.pizza_sizes.length > 0 ? (
              <PizzaBuilder category={cur} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 site-stagger">
                {cur.items.map((it) => <MenuItemCard key={it.id} item={it} />)}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function PizzaBuilder({ category }: { category: MenuCategory }) {
  const sizes = category.pizza_sizes ?? [];
  const { addLine } = useCart();
  const [sizeIdx, setSizeIdx] = useState<number | null>(sizes.length > 0 ? 0 : null);
  const [flavorIds, setFlavorIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const size = sizeIdx !== null ? sizes[sizeIdx] : null;
  const max = size?.max_flavors ?? 0;
  const remaining = Math.max(0, max - flavorIds.length);
  const flavorMap = new Map(category.items.map((i) => [i.id, i] as const));
  const selectedItems = flavorIds.map((id) => flavorMap.get(id)).filter(Boolean) as typeof category.items;
  const specialExtras = selectedItems.filter((it) => it.is_special).reduce((s, it) => s + (Number(it.special_extra) || 0), 0);
  const finalPrice = (size?.price ?? 0) + specialExtras;
  const specialNames = selectedItems.filter((it) => it.is_special).map((it) => it.name);
  const selectSize = (i: number) => { setSizeIdx(i); setFlavorIds((c) => c.slice(0, sizes[i].max_flavors)); };
  const toggle = (id: string) => setFlavorIds((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length >= max ? c : [...c, id]);
  const add = () => {
    if (!size || flavorIds.length === 0) return;
    const names = flavorIds.map((id) => flavorMap.get(id)?.name).filter(Boolean) as string[];
    const descParts = [names.length === 1 ? \`Sabor: \${names[0]}\` : \`Sabores: \${names.join(" + ")}\`];
    if (specialNames.length > 0) descParts.push(\`Especiais (+\${formatBRL(specialExtras)}): \${specialNames.join(", ")}\`);
    addLine({
      itemId: \`pizza-\${category.id}-\${size.label}-\${flavorIds.join("_")}\`,
      name: \`Pizza \${size.label}\`,
      description: descParts.join(" • "),
      unitPrice: finalPrice,
      sizeLabel: size.label,
      flavors: names,
      specialFlavors: specialNames,
      extras: specialExtras,
    });
    setConfirm(\`Pizza \${size.label} adicionada!\`);
    setFlavorIds([]);
    setTimeout(() => setConfirm(null), 2200);
  };
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h4 className="text-lg font-bold">1. Escolha o tamanho</h4>
          <span className="text-xs text-site-fg/60">preço definido pelo tamanho</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sizes.map((s, i) => {
            const a = sizeIdx === i;
            return (
              <button key={i} onClick={() => selectSize(i)} className={\`relative rounded-xl border p-3 text-left transition \${a ? "border-site-primary bg-site-primary/10 shadow-lg" : "border-site-border bg-site-card hover:border-site-primary"}\`}>
                {a && <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-site-primary text-white inline-flex items-center justify-center"><Check className="h-3 w-3" /></span>}
                <p className="font-bold leading-tight">{s.label}</p>
                <p className="text-site-secondary font-bold mt-1">{formatBRL(s.price)}</p>
                <p className="text-[11px] text-site-fg/60 mt-0.5">até {s.max_flavors} {s.max_flavors === 1 ? "sabor" : "sabores"}</p>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-start gap-2 text-xs sm:text-sm rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 p-3">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Ao selecionar <strong>sabores especiais</strong>, o valor final da pizza poderá ser alterado.</span>
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-lg font-bold">2. Escolha os sabores</h4>
          {size && <span className="text-xs px-2 py-1 rounded-full bg-site-card border border-site-border">{flavorIds.length}/{max} selecionados{remaining > 0 ? \` · \${remaining} restante\${remaining > 1 ? "s" : ""}\` : ""}</span>}
        </div>
        {category.items.length === 0 ? <p className="text-sm text-site-fg/60">Nenhum sabor cadastrado.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {category.items.map((it) => {
              const c = flavorIds.includes(it.id);
              const d = !c && flavorIds.length >= max;
              return (
                <button key={it.id} onClick={() => toggle(it.id)} disabled={!size || d} className={\`text-left rounded-xl border p-3 transition flex items-start gap-3 \${c ? "border-site-primary bg-site-primary/10" : "border-site-border bg-site-card hover:border-site-primary"} \${d ? "opacity-40 cursor-not-allowed" : ""}\`}>
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} loading="lazy" className="h-20 w-20 rounded-lg object-cover shrink-0 border border-site-border" />
                  ) : (
                    <div className="h-20 w-20 rounded-lg shrink-0 border border-dashed border-site-border bg-black/20 flex items-center justify-center text-site-fg/40">
                      <ImageIcon className="h-6 w-6 opacity-40" />
                    </div>
                  )}
                  <div className={\`mt-0.5 h-5 w-5 shrink-0 rounded border flex items-center justify-center \${c ? "bg-site-primary border-site-primary text-white" : "border-site-border"}\`}>
                    {c && <Check className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold leading-tight">{it.name}</p>
                      {it.is_special && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"><Sparkles className="h-3 w-3" /> Especial{it.special_extra ? \` +\${formatBRL(it.special_extra)}\` : ""}</span>}
                    </div>
                    {it.description && <p className="text-xs text-site-fg/60 mt-1">{it.description}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-site-border bg-site-card p-4">
        <h4 className="text-lg font-bold mb-2">3. Resumo</h4>
        {size ? (
          <ul className="text-sm text-site-fg/70 space-y-1">
            <li><strong>Tamanho:</strong> {size.label} — {formatBRL(size.price)}</li>
            <li><strong>Sabores:</strong> {flavorIds.length === 0 ? "nenhum selecionado" : flavorIds.map((id) => flavorMap.get(id)?.name).filter(Boolean).join(" + ")}</li>
            {specialExtras > 0 && <li><strong className="text-amber-300">Adicional especial:</strong> +{formatBRL(specialExtras)}{specialNames.length > 0 ? \` (\${specialNames.join(", ")})\` : ""}</li>}
          </ul>
        ) : <p className="text-sm text-site-fg/60">Selecione um tamanho.</p>}
        <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
          <div className="flex flex-col"><span className="text-[10px] uppercase tracking-wide text-site-fg/60">Total</span><span className="text-2xl font-black text-site-secondary">{size ? formatBRL(finalPrice) : "—"}</span></div>
          <button onClick={add} disabled={!size || flavorIds.length === 0} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-site-primary text-white font-bold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus className="h-4 w-4" /> Adicionar pizza
          </button>
        </div>
        {confirm && <p className="mt-3 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">✓ {confirm}</p>}
      </div>
    </div>
  );
}
`;

const COMBO_SECTION_TSX = `import { useState } from "react";
import { Plus } from "lucide-react";
import { comboGroups } from "../data/comboData";
import { formatBRL } from "../lib/format";
import { useCart } from "../context/CartContext";

export function ComboSection() {
  const { addLine } = useCart();
  const [act, setAct] = useState(comboGroups[0]?.id ?? "");
  if (comboGroups.length === 0) return null;
  const cur = comboGroups.find((g) => g.id === act) ?? comboGroups[0];
  return (
    <section id="combos" className="py-16 px-4 bg-gradient-to-b from-site-bg via-site-secondary/5 to-site-bg">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 rounded-full bg-site-secondary text-black text-xs font-bold mb-3">PROMOÇÕES</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Combos especiais</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-8 justify-start sm:justify-center">
          {comboGroups.map((g) => (
            <button key={g.id} onClick={() => setAct(g.id)} className={\`px-5 py-2 rounded-full whitespace-nowrap font-semibold text-sm transition \${act === g.id ? "bg-site-secondary text-black" : "bg-site-card border border-site-border hover:border-site-secondary"}\`}>
              {g.title}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 site-stagger">
          {cur.combos.map((c) => (
            <div key={c.id} className="rounded-xl border border-site-secondary/40 bg-site-card p-5 flex flex-col gap-3 relative">
              {c.badge && <span className="absolute -top-2 right-4 px-2 py-1 rounded-full bg-site-secondary text-black text-xs font-bold">{c.badge}</span>}
              <h3 className="font-bold text-lg">{c.name}</h3>
              <ul className="text-sm text-site-fg/70 space-y-1">
                {c.items.map((l, i) => <li key={i}>• {l}</li>)}
              </ul>
              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="text-2xl font-black text-site-secondary">{formatBRL(c.price)}</span>
                <button onClick={() => addLine({ itemId: c.id, name: c.name, description: c.items.join(" + "), unitPrice: c.price })}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-site-primary text-white font-semibold hover:opacity-90">
                  <Plus className="h-4 w-4" /> Adicionar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`;

const CART_DRAWER_TSX = `import { useState } from "react";
import { X, Minus, Plus, Trash2, MapPin } from "lucide-react";
import { useCart } from "../context/CartContext";
import { formatBRL, formatPhoneMask } from "../lib/format";
import { restaurant } from "../data/restaurant";
import { deliveryZones } from "../data/deliveryZones";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, updateQty, removeLine, totalPrice, clear } = useCart();
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(""); const [zoneId, setZoneId] = useState("");
  const [error, setError] = useState("");
  const selectedZone = deliveryZones.find((z) => z.id === zoneId) || null;
  const deliveryFee = selectedZone ? selectedZone.fee : 0;
  const grandTotal = totalPrice + deliveryFee;
  const hasZones = deliveryZones.length > 0;

  const finish = () => {
    setError("");
    if (items.length === 0) return setError("Seu carrinho está vazio");
    if (!name.trim() || !phone.trim() || !address.trim()) return setError("Preencha nome, telefone e endereço");
    if (hasZones && !selectedZone) return setError("Selecione o bairro para calcular a taxa de entrega");
    const sendFly = async () => {
      const base = (restaurant.flycontrol_base_url || "").replace(/\\/+$/, "");
      const url = base ? base + "/api/orders" : restaurant.flycontrol_api_url;
      if (!restaurant.flycontrol_enabled || !url) return;
      // IMPORTANTE: A API Key deve ser injetada via servidor/proxy para não ficar exposta.
      const apiKey = "INFORME_SUA_CHAVE_AQUI"; 
      if (!apiKey || apiKey === "INFORME_SUA_CHAVE_AQUI") return;

      const payload = {
        order_id: (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : "ord_" + Date.now(),
        customer: { name, phone },
        address: { street: address, number: "", neighborhood: selectedZone ? selectedZone.neighborhood : "" },
        delivery_fee: deliveryFee,
        items: items.map((l) => ({
          name: l.name + (l.sizeLabel ? \` (\${l.sizeLabel})\` : ""),
          quantity: l.quantity,
          price: l.unitPrice,
          notes: l.flavors && l.flavors.length > 0 ? \`Sabores: \${l.flavors.join(" + ")}\` : (l.description || undefined),
        })),
        total: totalPrice + deliveryFee,
        payment_method: null,
        change_for: null,
        notes: "",
        created_at: new Date().toISOString(),
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, Authorization: \`Bearer \${apiKey}\` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Falha ao enviar pedido para o painel.");
    };
    const lines = items.map((l) => {
      const sz = l.sizeLabel ? \` (\${l.sizeLabel})\` : "";
      const flavorLine = l.flavors && l.flavors.length > 0
        ? \`\\n   Sabores: \${l.flavors.join(" + ")}\`
        : l.description ? \`\\n_\${l.description}_\` : "";
      return \`- \${l.quantity}x \${l.name}\${sz} — \${formatBRL(l.unitPrice * l.quantity)}\${flavorLine}\`;
    });
    const locationBlock = selectedZone
      ? \`*Bairro:* \${selectedZone.neighborhood}\\n*Endereço:* \${address}\\n\`
      : \`*Localização:* \${address}\\n\`;
    const feeLine = selectedZone
      ? \`*Subtotal:* \${formatBRL(totalPrice)}\\n*Taxa de entrega (\${selectedZone.neighborhood}):* \${formatBRL(deliveryFee)}\\n\`
      : "";
    const msg = \`Olá, gostaria de fazer um pedido!\\n\\n*Nome:* \${name}\\n*Telefone:* \${phone}\\n\${locationBlock}\\n*Pedido:*\\n\${lines.join("\\n")}\\n\\n\${feeLine}*Total: \${formatBRL(grandTotal)}*\`;
    // Envia para FLYCONTROL antes do WhatsApp; falhas NÃO bloqueiam o fluxo
    sendFly().catch((e) => { console.error("[FLYCONTROL]", e); }).finally(() => {
      if (restaurant.whatsapp_enabled !== false && restaurant.whatsapp_number) {
        window.open(\`https://wa.me/\${restaurant.whatsapp_number}?text=\${encodeURIComponent(msg)}\`, "_blank");
      }
      clear(); setName(""); setPhone(""); setAddress(""); setZoneId(""); onClose();
    });
  };

  return (
    <>
      <div className={\`fixed inset-0 bg-black/60 z-50 transition-opacity \${open ? "opacity-100" : "opacity-0 pointer-events-none"}\`} onClick={onClose} />
      <aside className={\`fixed top-0 right-0 bottom-0 w-full max-w-md z-50 bg-site-bg border-l border-site-border shadow-2xl flex flex-col transition-transform \${open ? "translate-x-0" : "translate-x-full"}\`}>
        <div className="flex items-center justify-between p-4 border-b border-site-border">
          <h2 className="font-bold text-lg">Seu pedido</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-site-card"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? <p className="text-center text-site-fg/60 py-12">Carrinho vazio.</p> : items.map((l) => (
            <div key={\`\${l.itemId}-\${l.sizeLabel ?? ""}\`} className="rounded-lg border border-site-border bg-site-card p-3">
              <div className="flex justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold">{l.name}{l.sizeLabel ? \` (\${l.sizeLabel})\` : ""}</p>
                  {l.flavors && l.flavors.length > 0
                    ? <p className="text-xs text-site-fg/60 mt-1">Sabores: {l.flavors.join(" + ")}</p>
                    : l.description ? <p className="text-xs text-site-fg/60 mt-1">{l.description}</p> : null}
                </div>
                <button onClick={() => removeLine(l.itemId, l.sizeLabel)} className="p-1 text-site-fg/60 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(l.itemId, l.sizeLabel, l.quantity - 1)} className="h-7 w-7 rounded-full border border-site-border inline-flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                  <span className="w-6 text-center font-semibold">{l.quantity}</span>
                  <button onClick={() => updateQty(l.itemId, l.sizeLabel, l.quantity + 1)} className="h-7 w-7 rounded-full border border-site-border inline-flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                </div>
                <span className="font-bold text-site-secondary">{formatBRL(l.unitPrice * l.quantity)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-site-border space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="w-full px-3 py-2 rounded-lg bg-site-card border border-site-border focus:outline-none focus:border-site-primary" />
          <input value={phone} onChange={(e) => setPhone(formatPhoneMask(e.target.value))} placeholder="(00) 00000-0000" inputMode="numeric" className="w-full px-3 py-2 rounded-lg bg-site-card border border-site-border focus:outline-none focus:border-site-primary" />
          {hasZones && (
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-site-fg/60" />
              <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg bg-site-card border border-site-border focus:outline-none focus:border-site-primary appearance-none">
                <option value="">Selecione seu bairro *</option>
                {deliveryZones.map((z) => (
                  <option key={z.id} value={z.id}>{z.neighborhood} — {formatBRL(z.fee)}</option>
                ))}
              </select>
            </div>
          )}
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, complemento..." rows={2} className="w-full px-3 py-2 rounded-lg bg-site-card border border-site-border focus:outline-none focus:border-site-primary resize-none" />
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">{error}</p>}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-site-fg/60"><span>Subtotal</span><span>{formatBRL(totalPrice)}</span></div>
            {hasZones && <div className="flex justify-between text-site-fg/60"><span>Taxa de entrega{selectedZone ? \` (\${selectedZone.neighborhood})\` : ""}</span><span>{selectedZone ? formatBRL(deliveryFee) : "—"}</span></div>}
            <div className="flex justify-between pt-1 border-t border-site-border"><span className="text-site-fg/60">Total</span><span className="text-xl font-black text-site-secondary">{formatBRL(grandTotal)}</span></div>
          </div>
          <button onClick={finish} className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition">Finalizar pedido</button>
        </div>
      </aside>
    </>
  );
}
`;

const FOOTER_TSX = `import { Phone, Clock, MapPin } from "lucide-react";
import { restaurant } from "../data/restaurant";

export function Footer() {
  return (
    <footer className="border-t border-site-border bg-site-card px-4 py-12 mt-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center sm:text-left">
        {restaurant.whatsapp_display && (
          <div><Phone className="h-6 w-6 mx-auto sm:mx-0 mb-2 text-site-primary" /><h4 className="font-bold mb-1">WhatsApp</h4><p className="text-site-fg/70">{restaurant.whatsapp_display}</p></div>
        )}
        {restaurant.hours && (
          <div><Clock className="h-6 w-6 mx-auto sm:mx-0 mb-2 text-site-primary" /><h4 className="font-bold mb-1">Horário</h4><p className="text-site-fg/70 whitespace-pre-line">{restaurant.hours}</p></div>
        )}
        {(restaurant.address || restaurant.city) && (
          <div><MapPin className="h-6 w-6 mx-auto sm:mx-0 mb-2 text-site-primary" /><h4 className="font-bold mb-1">Localização</h4>{restaurant.address && <p className="text-site-fg/70">{restaurant.address}</p>}{restaurant.city && <p className="text-site-fg/70">{restaurant.city}</p>}</div>
        )}
      </div>
      <div className="text-center text-xs text-site-fg/50 mt-8 pt-6 border-t border-site-border">© {new Date().getFullYear()} {restaurant.name}. Todos os direitos reservados.</div>
    </footer>
  );
}
`;

/* ===========  DOCUMENTACAO.md generator  =========== */

function buildDocumentacao(data: SiteData): string {
  const r = data.restaurant;
  const totalItems = data.categories.reduce((s, c) => s + c.items.length, 0);
  const totalCombos = data.comboGroups.reduce((s, g) => s + g.combos.length, 0);
  const pizzaCats = data.categories.filter((c) => c.is_pizza).length;

  const categoriesList = data.categories.length === 0
    ? "_Nenhuma categoria cadastrada._"
    : data.categories
        .map(
          (c) =>
            `- **${c.icon ? c.icon + " " : ""}${c.name}**${c.is_pizza ? " 🍕 _(categoria de pizza)_" : ""} — ${c.items.length} ${c.items.length === 1 ? "item" : "itens"}${c.image_url ? " · com imagem" : ""}`,
        )
        .join("\n");

  const combosList = data.comboGroups.length === 0
    ? "_Nenhum combo cadastrado._"
    : data.comboGroups
        .map((g) => `- **${g.title}** — ${g.combos.length} ${g.combos.length === 1 ? "combo" : "combos"}`)
        .join("\n");

  return `# 📘 DOCUMENTAÇÃO — ${r.name}

> Documentação técnica completa do projeto exportado pela plataforma **SiteCreatorFly**.
> Esta versão é **100% estática (frontend-only)** e funciona sem servidor backend dedicado:
> os pedidos são enviados diretamente para o WhatsApp do restaurante.

---

## 1. 🎯 Visão geral do projeto

**${r.name}** é um site de delivery completo, gerado dinamicamente a partir das
configurações feitas no painel da plataforma SiteCreatorFly. O cliente final
navega pelo cardápio, monta seu pedido (incluindo pizzas com múltiplos sabores)
e finaliza enviando uma mensagem pré-formatada via WhatsApp.

- **Nome:** ${r.name}
${r.tagline ? `- **Tagline:** ${r.tagline}\n` : ""}${r.description ? `- **Descrição:** ${r.description}\n` : ""}- **WhatsApp:** ${r.whatsapp_display || r.whatsapp_number || "—"}
- **Endereço:** ${r.address || "—"}${r.city ? " · " + r.city : ""}
- **Categorias do cardápio:** ${data.categories.length}${pizzaCats > 0 ? ` (${pizzaCats} de pizza)` : ""}
- **Itens cadastrados:** ${totalItems}
- **Grupos de combos:** ${data.comboGroups.length} (${totalCombos} combos no total)

---

## 2. 🛠️ Tecnologias utilizadas

### Frontend
| Tecnologia | Versão | Função |
|------------|--------|--------|
| **React** | 18.3 | Biblioteca de UI |
| **TypeScript** | 5.5 | Tipagem estática |
| **Vite** | 5.4 | Build tool / dev server |
| **Tailwind CSS** | 3.4 | Estilização utility-first |
| **lucide-react** | 0.462 | Ícones |

### Backend
Este pacote é **frontend-only**. Toda a "lógica de backend" (recebimento de
pedidos) é delegada ao **WhatsApp** via deep link \`https://wa.me/\`.
Os dados do cardápio ficam embutidos no código (\`src/data/*.ts\`) e podem ser
editados diretamente — não há banco de dados externo necessário para rodar.

> 💡 Caso queira adicionar um backend completo (pagamentos, persistência de
> pedidos, painel admin), recomendamos integrar **Supabase**, **Firebase** ou
> uma API Node.js/Express. Veja a seção **8. Pontos de customização**.

---

## 3. 📁 Estrutura de pastas (árvore)

\`\`\`
${r.slug || "delivery-site"}/
├── DOCUMENTACAO.md           ← este arquivo
├── README.md                 ← guia rápido de uso
├── start.sh                  ← script de inicialização (npm install + dev)
├── package.json              ← dependências e scripts npm
├── tsconfig.json             ← configuração do TypeScript
├── vite.config.ts            ← configuração do Vite
├── tailwind.config.ts        ← tema e tokens do Tailwind
├── postcss.config.js         ← pipeline PostCSS (Tailwind + autoprefixer)
├── index.html                ← HTML raiz (entry point do Vite)
├── .gitignore
└── src/
    ├── main.tsx              ← bootstrap do React
    ├── App.tsx               ← composição das seções principais
    ├── index.css             ← estilos globais + variáveis de tema
    ├── data/
    │   ├── restaurant.ts     ← dados do restaurante (nome, contato, hero)
    │   ├── menuData.ts       ← categorias e itens do cardápio
    │   └── comboData.ts      ← grupos de combos promocionais
    ├── lib/
    │   └── format.ts         ← utilitários (BRL, máscara de telefone)
    ├── context/
    │   └── CartContext.tsx   ← estado global do carrinho (React Context)
    └── components/
        ├── Header.tsx        ← cabeçalho fixo com botão do carrinho
        ├── Hero.tsx          ← seção principal (logo, título, CTA)
        ├── ComboSection.tsx  ← combos promocionais com tabs
        ├── MenuSection.tsx   ← cardápio + montador de pizza
        ├── MenuItemCard.tsx  ← card individual de item do cardápio
        ├── CartDrawer.tsx    ← drawer lateral do carrinho + checkout
        └── Footer.tsx        ← rodapé com contato e endereço
\`\`\`

---

## 4. 📂 Explicação de cada arquivo principal

### Configuração
- **\`package.json\`** — define dependências (\`react\`, \`react-dom\`,
  \`lucide-react\`) e scripts (\`dev\`, \`build\`, \`preview\`).
- **\`vite.config.ts\`** — habilita o plugin oficial do React.
- **\`tailwind.config.ts\`** — registra os tokens de cor \`site-bg\`,
  \`site-fg\`, \`site-card\`, \`site-border\`, \`site-primary\`, \`site-secondary\`,
  todos baseados em CSS variables.
- **\`tsconfig.json\`** — TypeScript em modo estrito + JSX automático.
- **\`index.html\`** — contém o \`<div id="root">\` onde o React monta a app.

### Dados (\`src/data/\`)
Toda a personalização do site fica concentrada aqui — edite estes arquivos
para alterar conteúdo sem mexer em componentes:
- **\`restaurant.ts\`** — nome, tagline, descrição, WhatsApp, endereço,
  horários, logo e mídia do hero (imagem ou vídeo).
- **\`menuData.ts\`** — array de categorias. Cada categoria pode ser uma
  categoria normal **ou** uma categoria de pizza (\`is_pizza: true\`).
  Pizzas têm tamanhos (\`pizza_sizes\`) com preço fixo e número máximo de
  sabores. Itens podem ser marcados como \`is_special\` com \`special_extra\`
  (acréscimo no preço final da pizza).
- **\`comboData.ts\`** — grupos de combos promocionais com badge opcional
  (ex: "MAIS VENDIDO").

### Componentes (\`src/components/\`)
- **\`Header.tsx\`** — fixed top, fica transparente até o scroll passar de
  50px; mostra o badge com a quantidade de itens no carrinho.
- **\`Hero.tsx\`** — banner principal com suporte a imagem **ou** vídeo de
  fundo (controlado por \`hero_media_type\` em \`restaurant.ts\`).
- **\`MenuSection.tsx\`** — primeiro mostra um grid de categorias (com
  imagem); ao clicar, faz drill-down para os itens. Para categorias de
  pizza renderiza o componente interno **\`PizzaBuilder\`**.
- **\`PizzaBuilder\`** (dentro de \`MenuSection.tsx\`) — fluxo em 3 passos:
  (1) escolher tamanho, (2) selecionar sabores respeitando o limite,
  (3) ver resumo + total dinâmico (incluindo acréscimo de sabores especiais).
- **\`ComboSection.tsx\`** — combos agrupados por tabs.
- **\`CartDrawer.tsx\`** — drawer lateral com lista, controle de quantidade
  e formulário de checkout (nome, telefone, endereço) que dispara o WhatsApp.
- **\`Footer.tsx\`** — informações de contato.

### Estado (\`src/context/CartContext.tsx\`)
Carrinho global via React Context. Cada \`CartLine\` guarda \`itemId\`,
\`name\`, \`unitPrice\`, \`quantity\` e opcionalmente \`sizeLabel\`, \`flavors\`
e \`specialFlavors\` (para pizzas). A chave de unicidade combina
\`itemId + sizeLabel\`.

---

## 5. 🔄 Fluxo da aplicação

\`\`\`
┌─────────────┐   browse    ┌─────────────────┐   add    ┌──────────────┐
│  Hero/Menu  │ ──────────► │  MenuItemCard / │ ───────► │ CartContext  │
│  (escolha)  │             │  PizzaBuilder   │          │  (estado)    │
└─────────────┘             └─────────────────┘          └──────┬───────┘
                                                                │ open
                                                                ▼
                                                         ┌──────────────┐
                                                         │ CartDrawer   │
                                                         │ (checkout)   │
                                                         └──────┬───────┘
                                                                │ submit
                                                                ▼
                                                       ┌────────────────┐
                                                       │ wa.me/<number> │
                                                       │ (WhatsApp)     │
                                                       └────────────────┘
\`\`\`

1. O usuário entra no site → \`Hero\` é renderizado.
2. Navega até combos ou cardápio → componentes leem de \`menuData.ts\` /
   \`comboData.ts\`.
3. Ao clicar em "Adicionar", o item entra no \`CartContext\`.
4. O \`Header\` reflete a quantidade total em tempo real.
5. O usuário abre o \`CartDrawer\`, preenche dados e clica em "Finalizar
   pedido".
6. O drawer monta uma mensagem markdown e abre uma nova aba para
   \`https://wa.me/${r.whatsapp_number || "<numero>"}?text=...\`

---

## 6. 🌐 Rotas e endpoints

Este projeto **não expõe rotas HTTP próprias** — é uma SPA (Single Page
Application) servida estaticamente. A única rota é \`/\` (\`index.html\`).

**Único "endpoint externo" usado:**

| Método | URL | Função |
|--------|-----|--------|
| GET | \`https://wa.me/<numero>?text=<mensagem>\` | Abre o WhatsApp com a mensagem do pedido pré-preenchida |

---

## 7. 🚀 Como rodar o projeto localmente

### Pré-requisitos
- **Node.js** 18 ou superior — https://nodejs.org
- **npm** (vem com o Node) ou **yarn** / **pnpm** / **bun**

### Passo a passo

\`\`\`bash
# 1. Descompacte o ZIP e entre na pasta
cd ${r.slug || "delivery-site"}

# 2. Instale as dependências
npm install

# 3. Rode o servidor de desenvolvimento
npm run dev

# 4. Abra no navegador
# → http://localhost:5173
\`\`\`

### Atalho (Linux/macOS)
\`\`\`bash
chmod +x start.sh
./start.sh
\`\`\`

### Build de produção

\`\`\`bash
npm run build      # gera a pasta dist/
npm run preview    # serve dist/ localmente para testar
\`\`\`

### Deploy
Faça upload da pasta \`dist/\` em qualquer hospedagem estática:
**Vercel**, **Netlify**, **Cloudflare Pages**, **GitHub Pages**,
**Firebase Hosting** ou um servidor Nginx/Apache simples.

---

## 8. 📦 Dependências

### Runtime
- \`react\` ^18.3.1
- \`react-dom\` ^18.3.1
- \`lucide-react\` ^0.462.0 — ícones SVG

### Desenvolvimento
- \`vite\` ^5.4.0 + \`@vitejs/plugin-react\` ^4.3.1
- \`typescript\` ^5.5.4
- \`tailwindcss\` ^3.4.7 + \`postcss\` ^8.4.40 + \`autoprefixer\` ^10.4.19
- \`@types/react\`, \`@types/react-dom\`

---

## 9. 🎨 Pontos de customização

| O que mudar | Onde editar |
|-------------|-------------|
| Nome / contato / endereço | \`src/data/restaurant.ts\` |
| Logo / imagem do hero / vídeo | campos \`logo_url\`, \`hero_image_url\`, \`hero_video_url\`, \`hero_media_type\` em \`restaurant.ts\` |
| Adicionar / remover categoria | \`src/data/menuData.ts\` (array \`menuCategories\`) |
| Adicionar / remover item | dentro de \`items\` de cada categoria em \`menuData.ts\` |
| Configurar pizza | \`is_pizza: true\` + \`pizza_sizes: [{ label, price, max_flavors }]\` |
| Marcar sabor especial | \`is_special: true, special_extra: <valor>\` no item |
| Combos promocionais | \`src/data/comboData.ts\` |
| Cores primária/secundária | variáveis \`--site-primary\` e \`--site-secondary\` em \`src/index.css\` (formato HSL: \`H S% L%\`) |
| Fonte | propriedade \`font-family\` em \`body\` no \`src/index.css\` |
| Número do WhatsApp | \`whatsapp_number\` em \`restaurant.ts\` (formato: \`5511999999999\`) |
| Texto da mensagem | função \`finish()\` em \`src/components/CartDrawer.tsx\` |

### Adicionar um backend de verdade
Se precisar persistir pedidos, integrar pagamento ou ter um painel admin:

1. Crie endpoints em **Supabase Edge Functions**, **Firebase Functions** ou
   uma API Node/Express.
2. Substitua a função \`finish()\` no \`CartDrawer.tsx\` por um \`fetch(POST)\`
   para sua API antes (ou no lugar) do redirect para o WhatsApp.
3. Para pagamentos online, integre **Stripe**, **Mercado Pago** ou **Pix**.

---

## 10. 📋 Conteúdo atual cadastrado

### Categorias (${data.categories.length})
${categoriesList}

### Combos (${data.comboGroups.length} grupos)
${combosList}

---

## 11. ✅ Checklist pós-exportação

- [ ] Rodei \`npm install\` sem erros
- [ ] Rodei \`npm run dev\` e o site abriu em \`http://localhost:5173\`
- [ ] Conferi o número do WhatsApp em \`src/data/restaurant.ts\`
- [ ] Testei adicionar um item ao carrinho
- [ ] Testei finalizar um pedido (abre o WhatsApp)
- [ ] Rodei \`npm run build\` e fiz deploy da pasta \`dist/\`

---

_Documentação gerada automaticamente em ${new Date().toISOString().slice(0, 10)} pela plataforma **SiteCreatorFly**._
`;
}