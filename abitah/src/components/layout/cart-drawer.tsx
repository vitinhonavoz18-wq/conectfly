"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button, ButtonLink } from "@/components/ui/button";
import { MediaFrame } from "@/components/ui/media-frame";
import { useCart } from "@/store/cart-context";
import { formatCurrency } from "@/lib/utils";
import { siteConfig } from "@/config/site";

export function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeItem, subtotal, count } = useCart();
  const remaining = siteConfig.commerce.freeShippingThreshold - subtotal;

  return (
    <Drawer open={isOpen} onClose={closeCart} title={`Carrinho (${count})`}>
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <ShoppingBag className="h-10 w-10 text-smoke-400" aria-hidden />
          <p className="text-sm text-smoke-300">Seu carrinho ainda está vazio.</p>
          <Button onClick={closeCart} variant="outline">
            Continuar comprando
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {siteConfig.commerce.freeShippingThreshold > 0 ? (
            <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
              <p className="text-xs text-smoke-300">
                {remaining > 0 ? (
                  <>
                    Faltam <strong className="text-neon-400">{formatCurrency(remaining)}</strong> para
                    o frete grátis.
                  </>
                ) : (
                  <strong className="text-neon-400">Você conquistou frete grátis!</strong>
                )}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700">
                <div
                  className="h-full rounded-full bg-neon-500 transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (subtotal / siteConfig.commerce.freeShippingThreshold) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          <ul className="divide-y divide-ink-700">
            {items.map((item) => (
              <li key={item.key} className="flex gap-3 py-4">
                <Link href={`/produto/${item.slug}`} onClick={closeCart} className="shrink-0">
                  <MediaFrame
                    src={item.imageUrl}
                    alt={item.name}
                    className="aspect-3/4 w-20"
                    sizes="80px"
                    label="Sem imagem"
                  />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={`/produto/${item.slug}`}
                    onClick={closeCart}
                    className="text-sm font-semibold leading-snug text-white hover:text-neon-400"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-xs text-smoke-400">
                    {item.size} · {item.color}
                  </p>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <div className="flex items-center rounded-lg border border-ink-600">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        aria-label="Diminuir quantidade"
                        className="px-2 py-1.5 text-smoke-300 hover:text-neon-400"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-7 text-center text-xs font-bold text-white">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        disabled={item.quantity >= item.maxQuantity}
                        aria-label="Aumentar quantidade"
                        className="px-2 py-1.5 text-smoke-300 hover:text-neon-400 disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <span className="text-sm font-bold text-white">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  aria-label={`Remover ${item.name}`}
                  className="self-start p-1 text-smoke-400 transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 ? (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-smoke-300">Subtotal</span>
            <span className="text-lg font-extrabold text-white">{formatCurrency(subtotal)}</span>
          </div>
          <p className="text-xs text-smoke-400">Frete e cupom calculados no checkout.</p>
          <ButtonLink href="/checkout" onClick={closeCart} fullWidth size="lg">
            Finalizar pedido
          </ButtonLink>
          <ButtonLink href="/carrinho" onClick={closeCart} variant="outline" fullWidth>
            Ver carrinho completo
          </ButtonLink>
        </div>
      ) : null}
    </Drawer>
  );
}
