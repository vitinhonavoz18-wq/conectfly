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

export function App() {
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <CartProvider>
      <Header onOpenCart={() => setCartOpen(true)} />
      <main>
        <Hero />
        <ComboSection />
        <MenuSection />
      </main>
      <Footer />
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
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-16">
      {restaurant.hero_media_type === "video" && restaurant.hero_video_url
        ? <video src={restaurant.hero_video_url} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
        : restaurant.hero_image_url && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: \`url(\${restaurant.hero_image_url})\` }} />}
      <div className="absolute inset-0 bg-gradient-to-b from-site-bg/70 via-site-bg/85 to-site-bg" />
      <div className="relative z-10 text-center px-4 py-20">
        {restaurant.logo_url
          ? <img src={restaurant.logo_url} alt={restaurant.name} className="mx-auto mb-6 h-48 sm:h-64 md:h-80 w-auto object-contain drop-shadow-2xl" />
          : <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6">{restaurant.name}</h1>}
        {restaurant.tagline && <p className="text-xl sm:text-2xl font-semibold text-site-secondary mb-3">{restaurant.tagline}</p>}
        {restaurant.description && <p className="max-w-xl mx-auto text-site-fg/70">{restaurant.description}</p>}
        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          <a href="#combos" className="px-6 py-3 rounded-full bg-site-secondary text-black font-bold hover:opacity-90">Ver combos</a>
          <a href="#cardapio" className="px-6 py-3 rounded-full border border-site-border font-bold hover:bg-site-card">Cardápio</a>
        </div>
      </div>
    </section>
  );
}
`;

const MENU_CARD_TSX = `import { useState } from "react";
import { Plus } from "lucide-react";
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
    <div className="rounded-xl border border-site-border bg-site-card p-5 flex flex-col gap-3 hover:border-site-primary transition">
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
  );
}
`;

const MENU_SECTION_TSX = `import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { menuCategories } from "../data/menuData";
import { MenuItemCard } from "./MenuItemCard";

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {menuCategories.map((c) => (
              <button key={c.id} onClick={() => setAct(c.id)} className="group relative aspect-square rounded-2xl overflow-hidden border border-site-border bg-site-card hover:border-site-primary transition shadow-lg">
                {c.image_url
                  ? <img src={c.image_url} alt={c.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  : <div className="absolute inset-0 flex items-center justify-center text-site-fg/40"><ImageIcon className="h-10 w-10" /></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 text-left">
                  <h3 className="text-white font-black text-base sm:text-lg leading-tight drop-shadow">{c.icon ? \`\${c.icon} \` : ""}{c.name}</h3>
                  <p className="text-white/80 text-xs mt-0.5">{c.items.length} {c.items.length === 1 ? "item" : "itens"}</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cur.items.map((it) => <MenuItemCard key={it.id} item={it} />)}
            </div>
          </>
        )}
      </div>
    </section>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "../context/CartContext";
import { formatBRL, formatPhoneMask } from "../lib/format";
import { restaurant } from "../data/restaurant";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, updateQty, removeLine, totalPrice, clear } = useCart();
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(""); const [error, setError] = useState("");

  const finish = () => {
    setError("");
    if (items.length === 0) return setError("Seu carrinho está vazio");
    if (!name.trim() || !phone.trim() || !address.trim()) return setError("Preencha nome, telefone e localização");
    const lines = items.map((l) => {
      const sz = l.sizeLabel ? \` (\${l.sizeLabel})\` : "";
      const desc = l.description ? \`\\n_\${l.description}_\` : "";
      return \`- \${l.quantity}x \${l.name}\${sz} — \${formatBRL(l.unitPrice * l.quantity)}\${desc}\`;
    });
    const msg = \`Olá, gostaria de fazer um pedido!\\n\\n*Nome:* \${name}\\n*Telefone:* \${phone}\\n*Localização:* \${address}\\n\\n*Pedido:*\\n\${lines.join("\\n")}\\n\\n*Total: \${formatBRL(totalPrice)}*\`;
    window.open(\`https://wa.me/\${restaurant.whatsapp_number}?text=\${encodeURIComponent(msg)}\`, "_blank");
    clear(); setName(""); setPhone(""); setAddress(""); onClose();
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
                  {l.description && <p className="text-xs text-site-fg/60 mt-1">{l.description}</p>}
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
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Endereço completo / localização" rows={2} className="w-full px-3 py-2 rounded-lg bg-site-card border border-site-border focus:outline-none focus:border-site-primary resize-none" />
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">{error}</p>}
          <div className="flex justify-between items-center">
            <span className="text-site-fg/60">Total</span>
            <span className="text-xl font-black text-site-secondary">{formatBRL(totalPrice)}</span>
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