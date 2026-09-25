"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/store/auth-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { orderStatusLabels, type OrderStatus } from "@/types/catalog";

type OrderRow = {
  id: string;
  code: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  itemCount: number;
};

export function OrdersList() {
  const supabase = getSupabaseBrowserClient();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;

    supabase
      .from("orders")
      .select("id, code, status, total, created_at, order_items(count)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        setOrders(
          (data ?? []).map((row) => ({
            id: row.id as string,
            code: row.code as string,
            status: (row.status as OrderStatus) ?? "aguardando",
            total: Number(row.total ?? 0),
            createdAt: row.created_at as string,
            itemCount: Number(
              (row.order_items as { count: number }[] | undefined)?.[0]?.count ?? 0,
            ),
          })),
        );
      });

    return () => {
      active = false;
    };
  }, [supabase, user]);

  if (orders === null) {
    return <div className="h-40 animate-pulse rounded-card bg-ink-900" />;
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-ink-600 bg-ink-900 px-6 py-14 text-center">
        <Package className="h-9 w-9 text-smoke-400" aria-hidden />
        <p className="text-sm text-smoke-300">Você ainda não fez nenhum pedido.</p>
        <ButtonLink href="/loja">Começar a comprar</ButtonLink>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={`/conta/pedidos/${order.id}`}
            className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-ink-700 bg-ink-900 p-5 transition-colors hover:border-neon-500/45"
          >
            <div>
              <p className="text-sm font-bold text-white">Pedido {order.code}</p>
              <p className="mt-1 text-xs text-smoke-400">
                {formatDate(order.createdAt)} · {order.itemCount}{" "}
                {order.itemCount === 1 ? "item" : "itens"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge tone={order.status === "cancelado" ? "muted" : "outline"}>
                {orderStatusLabels[order.status]}
              </Badge>
              <span className="text-base font-extrabold text-white">
                {formatCurrency(order.total)}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
