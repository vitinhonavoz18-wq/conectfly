"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MediaFrame } from "@/components/ui/media-frame";
import { useAuth } from "@/store/auth-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCep, formatCurrency, formatDateTime } from "@/lib/utils";
import { orderStatusLabels, type Order, type OrderStatus } from "@/types/catalog";

export function OrderDetail({ orderId }: { orderId: string }) {
  const supabase = getSupabaseBrowserClient();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null | "missing">(null);

  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;

    supabase
      .from("orders")
      .select("*, items:order_items(*)")
      .eq("id", orderId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (!data) {
          setOrder("missing");
          return;
        }
        const address = data.address as Order["address"];
        setOrder({
          id: data.id as string,
          code: data.code as string,
          status: (data.status as OrderStatus) ?? "aguardando",
          customerName: (data.customer_name as string) ?? "",
          customerEmail: (data.customer_email as string) ?? "",
          customerPhone: (data.customer_phone as string) ?? "",
          shippingMethod: (data.shipping_method as string) ?? "",
          shippingPrice: Number(data.shipping_price ?? 0),
          discount: Number(data.discount ?? 0),
          couponCode: (data.coupon_code as string | null) ?? null,
          subtotal: Number(data.subtotal ?? 0),
          total: Number(data.total ?? 0),
          address: address ?? null,
          createdAt: data.created_at as string,
          items: ((data.items as Record<string, unknown>[]) ?? []).map((item) => ({
            id: item.id as string,
            productId: (item.product_id as string) ?? "",
            productName: (item.product_name as string) ?? "",
            productSlug: (item.product_slug as string) ?? "",
            imageUrl: (item.image_url as string | null) ?? null,
            size: (item.size as string) ?? "",
            color: (item.color as string) ?? "",
            quantity: Number(item.quantity ?? 1),
            unitPrice: Number(item.unit_price ?? 0),
            total: Number(item.total ?? 0),
          })),
        });
      });

    return () => {
      active = false;
    };
  }, [supabase, user, orderId]);

  if (order === null) return <div className="h-64 animate-pulse rounded-card bg-ink-900" />;

  if (order === "missing") {
    return (
      <div className="rounded-card border border-ink-700 bg-ink-900 p-8 text-center">
        <p className="text-sm text-smoke-300">Pedido não encontrado.</p>
        <Link href="/conta/pedidos" className="mt-4 inline-block text-sm text-neon-400 hover:underline">
          Voltar para meus pedidos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/conta/pedidos"
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-smoke-300 hover:text-neon-400"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Meus pedidos
      </Link>

      <div className="rounded-card border border-ink-700 bg-ink-900 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold uppercase text-white">Pedido {order.code}</h2>
            <p className="mt-1 text-xs text-smoke-400">Realizado em {formatDateTime(order.createdAt)}</p>
          </div>
          <Badge tone={order.status === "cancelado" ? "muted" : "neon"}>
            {orderStatusLabels[order.status]}
          </Badge>
        </div>

        <ul className="mt-6 divide-y divide-ink-700 border-y border-ink-700">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 py-4">
              <MediaFrame
                src={item.imageUrl}
                alt={item.productName}
                label=""
                className="aspect-3/4 w-16 shrink-0"
                sizes="64px"
              />
              <div className="flex-1">
                <Link
                  href={`/produto/${item.productSlug}`}
                  className="text-sm font-semibold text-white hover:text-neon-400"
                >
                  {item.productName}
                </Link>
                <p className="mt-1 text-xs text-smoke-400">
                  {item.size} · {item.color} · {item.quantity}x {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <p className="text-sm font-bold text-white">{formatCurrency(item.total)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between text-smoke-300">
            <dt>Produtos</dt>
            <dd>{formatCurrency(order.subtotal)}</dd>
          </div>
          {order.discount > 0 ? (
            <div className="flex justify-between text-neon-400">
              <dt>Desconto{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
              <dd>-{formatCurrency(order.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-smoke-300">
            <dt>Frete ({order.shippingMethod})</dt>
            <dd>{order.shippingPrice === 0 ? "Grátis" : formatCurrency(order.shippingPrice)}</dd>
          </div>
          <div className="flex justify-between border-t border-ink-700 pt-3 text-white">
            <dt className="font-bold uppercase">Total</dt>
            <dd className="text-xl font-black">{formatCurrency(order.total)}</dd>
          </div>
        </dl>
      </div>

      {order.address ? (
        <div className="rounded-card border border-ink-700 bg-ink-900 p-5 sm:p-6">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
            Endereço de entrega
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-smoke-300">
            {order.customerName}
            <br />
            {order.address.street}, {order.address.number}
            {order.address.complement ? ` — ${order.address.complement}` : ""}
            <br />
            {order.address.district} — {order.address.city}/{order.address.state}
            <br />
            CEP {formatCep(order.address.cep)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
