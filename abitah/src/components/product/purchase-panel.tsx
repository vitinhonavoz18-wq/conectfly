"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag, MessageCircle, Truck, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/product/price-tag";
import { VariantPicker } from "@/components/product/variant-picker";
import { FavoriteButton } from "@/components/product/favorite-button";
import { useCart } from "@/store/cart-context";
import { useToast } from "@/components/ui/toast";
import { productWhatsappLink } from "@/lib/whatsapp";
import { effectivePrice, unique } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import type { Product } from "@/types/catalog";

export function PurchasePanel({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const { notify } = useToast();

  const colors = useMemo(
    () =>
      unique(product.variants.map((variant) => variant.color)).map((color) => ({
        name: color,
        hex: product.variants.find((variant) => variant.color === color)?.colorHex ?? "#0A0A0A",
      })),
    [product.variants],
  );

  const [color, setColor] = useState(colors[0]?.name ?? "");
  const [size, setSize] = useState(
    product.variants.length === 1 ? product.variants[0].size : "",
  );
  const [quantity, setQuantity] = useState(1);

  const sizesForColor = useMemo(
    () =>
      product.variants
        .filter((variant) => variant.color === color)
        .map((variant) => ({ size: variant.size, stock: variant.stock })),
    [product.variants, color],
  );

  const selectedVariant = product.variants.find(
    (variant) => variant.color === color && variant.size === size,
  );

  const unitPrice = effectivePrice(product.price, product.salePrice);
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const maxQuantity = selectedVariant?.stock ?? 0;
  const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);

  function addToCart(): boolean {
    if (!selectedVariant) {
      notify("Escolha o tamanho e a cor antes de continuar.", "error");
      return false;
    }
    if (selectedVariant.stock <= 0) {
      notify("Esta variação está esgotada no momento.", "error");
      return false;
    }
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        imageUrl: primaryImage?.url ?? null,
        size: selectedVariant.size,
        color: selectedVariant.color,
        colorHex: selectedVariant.colorHex,
        unitPrice,
        compareAtPrice: product.salePrice ? product.price : null,
        quantity,
        maxQuantity: selectedVariant.stock,
      },
      quantity,
    );
    return true;
  }

  function handleAddToCart() {
    if (addToCart()) notify(`${product.name} adicionado ao carrinho.`);
  }

  function handleBuyNow() {
    if (addToCart()) router.push("/checkout");
  }

  const whatsappHref = productWhatsappLink({
    name: product.name,
    slug: product.slug,
    size: size || "a definir",
    color: color || "a definir",
    quantity,
    unitPrice,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neon-500">
            {product.categoryName}
          </p>
          {product.isBestSeller ? <Badge tone="outline">Mais vendido</Badge> : null}
        </div>

        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-black uppercase leading-tight text-white sm:text-3xl">
            {product.name}
          </h1>
          <FavoriteButton
            productId={product.id}
            productName={product.name}
            className="mt-1 shrink-0"
          />
        </div>

        <p className="mt-3 text-sm leading-relaxed text-smoke-300">{product.shortDescription}</p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-smoke-400">
          SKU: {selectedVariant?.sku ?? product.sku}
        </p>
      </div>

      <PriceTag price={product.price} salePrice={product.salePrice} size="lg" />

      <VariantPicker
        colors={colors}
        selectedColor={color}
        onSelectColor={(value) => {
          setColor(value);
          setSize("");
          setQuantity(1);
        }}
        sizes={sizesForColor}
        selectedSize={size}
        onSelectSize={(value) => {
          setSize(value);
          setQuantity(1);
        }}
        sizeGuideHref={product.sizeGuide.length ? "#tabela-de-medidas" : undefined}
      />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center rounded-lg border border-ink-600">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            aria-label="Diminuir quantidade"
            className="px-3.5 py-3 text-smoke-300 transition-colors hover:text-neon-400"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-10 text-center text-sm font-bold text-white">{quantity}</span>
          <button
            type="button"
            onClick={() =>
              setQuantity((value) => (maxQuantity ? Math.min(maxQuantity, value + 1) : value + 1))
            }
            disabled={Boolean(maxQuantity) && quantity >= maxQuantity}
            aria-label="Aumentar quantidade"
            className="px-3.5 py-3 text-smoke-300 transition-colors hover:text-neon-400 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-smoke-400">
          {selectedVariant ? (
            selectedVariant.stock > 0 ? (
              selectedVariant.stock <= 5 ? (
                <span className="font-semibold text-neon-400">
                  Últimas {selectedVariant.stock} unidades desta grade
                </span>
              ) : (
                <>
                  <span className="font-semibold text-neon-400">Em estoque</span> ·{" "}
                  {selectedVariant.stock} unidades
                </>
              )
            ) : (
              <span className="font-semibold text-red-400">Grade esgotada</span>
            )
          ) : totalStock > 0 ? (
            "Selecione cor e tamanho para ver o estoque"
          ) : (
            <span className="font-semibold text-red-400">Produto esgotado</span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button size="lg" fullWidth onClick={handleAddToCart} disabled={totalStock === 0}>
          <ShoppingBag className="h-4 w-4" aria-hidden />
          Adicionar ao carrinho
        </Button>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" size="lg" onClick={handleBuyNow} disabled={totalStock === 0}>
            Comprar agora
          </Button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-13 items-center justify-center gap-2 rounded-lg bg-[#1FA02F] px-7 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#188427]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Comprar pelo WhatsApp
          </a>
        </div>
      </div>

      <ul className="grid gap-3 rounded-card border border-ink-700 bg-ink-900 p-4 text-xs text-smoke-300">
        <li className="flex items-start gap-2.5">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-neon-500" aria-hidden />
          <span>
            Envio para todo o Brasil. {siteConfig.policies.dispatchTime}.
            {siteConfig.commerce.freeShippingThreshold > 0
              ? ` Frete grátis acima de R$ ${siteConfig.commerce.freeShippingThreshold},00.`
              : ""}
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-neon-500" aria-hidden />
          <span>
            Primeira troca grátis em até {siteConfig.policies.exchangeDays} dias após o recebimento.
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neon-500" aria-hidden />
          <span>Compra segura e atendimento humano pelo WhatsApp.</span>
        </li>
      </ul>
    </div>
  );
}
