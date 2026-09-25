"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Package, ShoppingCart, Tag, Users } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

type Stats = {
  products: number;
  activeProducts: number;
  orders: number;
  pendingOrders: number;
  revenue: number;
  subscribers: number;
  outOfStock: number;
};

export function AdminDashboard() {
  const supabase = getSupabaseBrowserClient();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    async function load() {
      if (!supabase) return;
      const [products, activeProducts, orders, pendingOrders, subscribers, revenueRows, variants] =
        await Promise.all([
          supabase.from("products").select("id", { count: "exact", head: true }),
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true),
          supabase.from("orders").select("id", { count: "exact", head: true }),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("status", "aguardando"),
          supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }),
          supabase.from("orders").select("total").neq("status", "cancelado"),
          supabase.from("product_variants").select("id", { count: "exact", head: true }).eq("stock", 0),
        ]);

      if (!active) return;

      setStats({
        products: products.count ?? 0,
        activeProducts: activeProducts.count ?? 0,
        orders: orders.count ?? 0,
        pendingOrders: pendingOrders.count ?? 0,
        subscribers: subscribers.count ?? 0,
        revenue: (revenueRows.data ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0),
        outOfStock: variants.count ?? 0,
      });
    }

    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  if (!stats) return <div className="h-64 animate-pulse rounded-card bg-ink-900" />;

  const cards = [
    {
      icon: Package,
      label: "Produtos",
      value: String(stats.products),
      hint: `${stats.activeProducts} ativos na loja`,
      href: "/admin/produtos",
    },
    {
      icon: ShoppingCart,
      label: "Pedidos",
      value: String(stats.orders),
      hint: `${stats.pendingOrders} aguardando pagamento`,
      href: "/admin/pedidos",
    },
    {
      icon: Tag,
      label: "Receita registrada",
      value: formatCurrency(stats.revenue),
      hint: "Soma dos pedidos não cancelados",
      href: "/admin/pedidos",
    },
    {
      icon: Users,
      label: "Newsletter",
      value: String(stats.subscribers),
      hint: "Cadastros recebidos",
      href: "/admin/configuracoes",
    },
  ];

  return (
    <div className="space-y-6">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <li key={card.label}>
            <Link
              href={card.href}
              className="flex h-full flex-col gap-3 rounded-card border border-ink-700 bg-ink-900 p-5 transition-all hover:-translate-y-0.5 hover:border-neon-500/45"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-neon-500/25 bg-neon-500/8 text-neon-500">
                <card.icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-smoke-400">{card.label}</p>
                <p className="mt-1 text-2xl font-black text-white">{card.value}</p>
                <p className="mt-1 text-xs text-smoke-400">{card.hint}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {stats.outOfStock > 0 ? (
        <div className="flex items-start gap-3 rounded-card border border-amber-500/40 bg-amber-500/5 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
          <div>
            <h2 className="text-sm font-bold text-white">Atenção ao estoque</h2>
            <p className="mt-1 text-sm text-smoke-300">
              {stats.outOfStock} {stats.outOfStock === 1 ? "variação está" : "variações estão"} com
              estoque zerado.{" "}
              <Link href="/admin/produtos" className="text-neon-400 hover:underline">
                Revisar produtos
              </Link>
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-card border border-ink-700 bg-ink-900 p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
          Primeiros passos
        </h2>
        <ol className="mt-4 space-y-2.5 text-sm text-smoke-300">
          <li>
            1. Cadastre suas categorias reais em{" "}
            <Link href="/admin/categorias" className="text-neon-400 hover:underline">
              Categorias
            </Link>
            .
          </li>
          <li>
            2. Crie os produtos e envie as fotos em{" "}
            <Link href="/admin/produtos" className="text-neon-400 hover:underline">
              Produtos
            </Link>
            . Os itens marcados como “Demonstração” podem ser editados ou excluídos.
          </li>
          <li>
            3. Ajuste os textos da home em{" "}
            <Link href="/admin/banners" className="text-neon-400 hover:underline">
              Banners e vitrines
            </Link>
            .
          </li>
          <li>
            4. Confirme WhatsApp e redes sociais em{" "}
            <Link href="/admin/configuracoes" className="text-neon-400 hover:underline">
              Configurações
            </Link>
            .
          </li>
        </ol>
      </div>
    </div>
  );
}
