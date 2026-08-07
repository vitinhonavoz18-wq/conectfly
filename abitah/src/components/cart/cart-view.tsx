"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, ShoppingBag, Tag, Trash2, Truck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { MediaFrame } from "@/components/ui/media-frame";
import { useCart } from "@/store/cart-context";
import { useToast } from "@/components/ui/toast";
import { lookupCep } from "@/services/viacep";
import { formatCep, formatCurrency } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import type { ShippingOptionId } from "@/types/cart";

const shippingOptions: ShippingOptionId[] = ["standard", "express", "pickup"];

export function CartView() {
  const {
    items,
    hydrated,
    subtotal,
    discount,
    shippingPrice,
    total,
    coupon,
    applyCoupon,
    updateQuantity,
    removeItem,
    shippingOption,
    setShippingOption,
  } = useCart();
  const { notify } = useToast();

  const [couponCode, setCouponCode] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [cep, setCep] = useState("");
  const [cepInfo, setCepInfo] = useState<string | null>(null);
  const [cepError, setCepError] = useState<string | null>(null);
  const [checkingCep, setCheckingCep] = useState(false);

  async function handleCoupon(event: React.FormEvent) {
    event.preventDefault();
    if (!couponCode.trim()) return;
    setCheckingCoupon(true);
    try {
      const response = await fetch("/api/cupom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, subtotal }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        coupon?: { code: string; discount: number; description: string };
      };

      if (!response.ok || !data.coupon) {
        notify(data.error ?? "Cupom inválido", "error");
        return;
      }

      applyCoupon(data.coupon);
      setCouponCode("");
      notify(`Cupom ${data.coupon.code} aplicado.`);
    } catch {
      notify("Não foi possível validar o cupom agora.", "error");
    } finally {
      setCheckingCoupon(false);
    }
  }

  async function handleCep(event: React.FormEvent) {
    event.preventDefault();
    setCheckingCep(true);
    setCepError(null);
    setCepInfo(null);

    const result = await lookupCep(cep);
    if (!result.ok) {
      setCepError(result.error);
    } else {
      setCepInfo(
        `${result.address.city}/${result.address.state}${
          result.address.district ? ` — ${result.address.district}` : ""
        }`,
      );
    }
    setCheckingCep(false);
  }

  if (!hydrated) {
    return (
      <div className="container-page py-20">
        <div className="h-40 animate-pulse rounded-card bg-ink-900" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="container-page py-20">
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-card border border-ink-700 bg-ink-900 px-6 py-14 text-center">
          <ShoppingBag className="h-12 w-12 text-smoke-400" aria-hidden />
          <div>
            <h2 className="text-lg font-extrabold uppercase text-white">Seu carrinho está vazio</h2>
            <p className="mt-2 text-sm text-smoke-300">
              Explore a coleção e escolha as peças que vão treinar com você.
            </p>
          </div>
          <ButtonLink href="/loja" size="lg">
            Continuar comprando
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_380px] lg:py-14">
      <section aria-label="Itens do carrinho">
        <ul className="divide-y divide-ink-700 rounded-card border border-ink-700 bg-ink-900">
          {items.map((item) => (
            <li key={item.key} className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
              <Link href={`/produto/${item.slug}`} className="shrink-0">
                <MediaFrame
                  src={item.imageUrl}
                  alt={item.name}
                  label="Sem imagem"
                  className="aspect-3/4 w-24 sm:w-28"
                  sizes="112px"
                />
              </Link>

              <div className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/produto/${item.slug}`}
                      className="text-sm font-bold text-white hover:text-neon-400"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1.5 flex items-center gap-2 text-xs text-smoke-400">
                      <span>Tamanho: {item.size}</span>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-3 w-3 rounded-full ring-1 ring-white/15"
                          style={{ backgroundColor: item.colorHex }}
                        />
                        {item.color}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-smoke-400">
                      Valor unitário:{" "}
                      <span className="text-smoke-200">{formatCurrency(item.unitPrice)}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    aria-label={`Remover ${item.name} do carrinho`}
                    className="p-1 text-smoke-400 transition-colors hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-lg border border-ink-600">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.key, item.quantity - 1)}
                      aria-label="Diminuir quantidade"
                      className="px-3 py-2 text-smoke-300 transition-colors hover:text-neon-400"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-8 text-center text-sm font-bold text-white">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.key, item.quantity + 1)}
                      disabled={item.quantity >= item.maxQuantity}
                      aria-label="Aumentar quantidade"
                      className="px-3 py-2 text-smoke-300 transition-colors hover:text-neon-400 disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="text-base font-extrabold text-white">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <form onSubmit={handleCoupon} className="rounded-card border border-ink-700 bg-ink-900 p-4">
            <Label htmlFor="cupom" className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-neon-500" aria-hidden />
              Cupom de desconto
            </Label>
            <div className="flex gap-2">
              <Input
                id="cupom"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="Digite o código"
                autoComplete="off"
              />
              <Button type="submit" size="md" disabled={checkingCoupon}>
                {checkingCoupon ? "..." : "Aplicar"}
              </Button>
            </div>
            {coupon ? (
              <p className="mt-2 flex items-center justify-between gap-2 text-xs text-neon-400">
                <span>
                  {coupon.code} — {coupon.description}
                </span>
                <button
                  type="button"
                  onClick={() => applyCoupon(null)}
                  className="text-smoke-400 underline-offset-2 hover:text-red-400 hover:underline"
                >
                  remover
                </button>
              </p>
            ) : null}
          </form>

          <form onSubmit={handleCep} className="rounded-card border border-ink-700 bg-ink-900 p-4">
            <Label htmlFor="cep-estimativa" className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5 text-neon-500" aria-hidden />
              Estimativa de frete
            </Label>
            <div className="flex gap-2">
              <Input
                id="cep-estimativa"
                value={cep}
                onChange={(event) => setCep(formatCep(event.target.value))}
                placeholder="00000-000"
                inputMode="numeric"
                autoComplete="postal-code"
              />
              <Button type="submit" size="md" variant="outline" disabled={checkingCep}>
                {checkingCep ? "..." : "Calcular"}
              </Button>
            </div>
            {cepInfo ? <p className="mt-2 text-xs text-smoke-300">Entrega para {cepInfo}</p> : null}
            {cepError ? <p className="mt-2 text-xs text-red-400">{cepError}</p> : null}
          </form>
        </div>
      </section>

      <aside aria-label="Resumo do pedido">
        <div className="sticky top-24 rounded-card border border-ink-700 bg-ink-900 p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">
            Resumo do pedido
          </h2>

          <fieldset className="mt-5">
            <legend className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-smoke-300">
              Forma de entrega
            </legend>
            <div className="space-y-2">
              {shippingOptions.map((option) => {
                const config = siteConfig.commerce.shipping[option];
                const isFree =
                  option === "pickup" ||
                  (siteConfig.commerce.freeShippingThreshold > 0 &&
                    subtotal - discount >= siteConfig.commerce.freeShippingThreshold);
                return (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      shippingOption === option
                        ? "border-neon-500 bg-neon-500/5"
                        : "border-ink-600 hover:border-smoke-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="frete"
                      value={option}
                      checked={shippingOption === option}
                      onChange={() => setShippingOption(option)}
                      className="mt-1 accent-[#29E23D]"
                    />
                    <span className="flex-1">
                      <span className="flex items-center justify-between gap-2 text-xs font-bold text-white">
                        {config.label}
                        <span className={isFree ? "text-neon-400" : ""}>
                          {isFree ? "Grátis" : formatCurrency(config.price)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-smoke-400">{config.eta}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <dl className="mt-5 space-y-2.5 border-t border-ink-700 pt-5 text-sm">
            <div className="flex justify-between text-smoke-300">
              <dt>Produtos</dt>
              <dd>{formatCurrency(subtotal)}</dd>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between text-neon-400">
                <dt>Desconto{coupon ? ` (${coupon.code})` : ""}</dt>
                <dd>-{formatCurrency(discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-smoke-300">
              <dt>Frete</dt>
              <dd>{shippingPrice === 0 ? "Grátis" : formatCurrency(shippingPrice)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-ink-700 pt-3 text-white">
              <dt className="text-sm font-bold uppercase">Total</dt>
              <dd className="text-2xl font-black">{formatCurrency(total)}</dd>
            </div>
          </dl>

          <div className="mt-6 space-y-3">
            <ButtonLink href="/checkout" size="lg" fullWidth>
              Finalizar pedido
            </ButtonLink>
            <ButtonLink href="/loja" variant="outline" fullWidth>
              Continuar comprando
            </ButtonLink>
          </div>
        </div>
      </aside>
    </div>
  );
}
