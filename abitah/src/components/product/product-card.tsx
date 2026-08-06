"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MediaFrame } from "@/components/ui/media-frame";
import { PriceTag } from "@/components/product/price-tag";
import { FavoriteButton } from "@/components/product/favorite-button";
import { QuickAddDrawer } from "@/components/product/quick-add-drawer";
import { useCart } from "@/store/cart-context";
import { useToast } from "@/components/ui/toast";
import { cn, effectivePrice, unique } from "@/lib/utils";
import type { Product } from "@/types/catalog";

export function ProductCard({
  product,
  className,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
  priority = false,
}: {
  product: Product;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const { addItem } = useCart();
  const { notify } = useToast();
  const [quickOpen, setQuickOpen] = useState(false);

  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
  const hoverImage = product.images.find((image) => image.id !== primaryImage?.id);

  const colors = useMemo(
    () =>
      unique(product.variants.map((v) => v.color)).map((color) => ({
        name: color,
        hex: product.variants.find((v) => v.color === color)?.colorHex ?? "#0A0A0A",
      })),
    [product.variants],
  );

  const inStock = product.variants.some((variant) => variant.stock > 0);
  const singleVariant = product.variants.length === 1 ? product.variants[0] : null;

  function handleAddToCart() {
    if (!inStock) return;
    if (singleVariant) {
      addItem({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        imageUrl: primaryImage?.url ?? null,
        size: singleVariant.size,
        color: singleVariant.color,
        colorHex: singleVariant.colorHex,
        unitPrice: effectivePrice(product.price, product.salePrice),
        compareAtPrice: product.salePrice ? product.price : null,
        quantity: 1,
        maxQuantity: singleVariant.stock,
      });
      notify(`${product.name} adicionado ao carrinho.`);
      return;
    }
    setQuickOpen(true);
  }

  return (
    <>
      <article
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-card border border-ink-700 bg-ink-900 transition-all duration-300 hover:-translate-y-1 hover:border-neon-500/45 hover:shadow-neon",
          className,
        )}
      >
        <div className="relative">
          <Link
            href={`/produto/${product.slug}`}
            className="block"
            aria-label={`Ver detalhes de ${product.name}`}
          >
            <MediaFrame
              src={primaryImage?.url}
              alt={product.name}
              className="aspect-3/4 w-full rounded-none"
              imageClassName="transition-transform duration-700 group-hover:scale-105"
              sizes={sizes}
              priority={priority}
            />
            {hoverImage?.url ? (
              <MediaFrame
                src={hoverImage.url}
                alt={`${product.name} — segunda imagem`}
                className="absolute inset-0 rounded-none opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                sizes={sizes}
              />
            ) : null}
          </Link>

          <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {product.salePrice ? <Badge tone="neon">Promoção</Badge> : null}
            {product.isNew ? <Badge tone="dark">Lançamento</Badge> : null}
            {!inStock ? <Badge tone="muted">Esgotado</Badge> : null}
          </div>

          <FavoriteButton
            productId={product.id}
            productName={product.name}
            className="absolute right-3 top-3"
          />

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!inStock}
            className="absolute inset-x-3 bottom-3 flex h-11 translate-y-3 items-center justify-center gap-2 rounded-lg bg-neon-500 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-950 opacity-0 transition-all duration-300 hover:bg-neon-400 focus-visible:translate-y-0 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:bg-ink-600 disabled:text-smoke-400 group-hover:translate-y-0 group-hover:opacity-100 max-md:translate-y-0 max-md:opacity-100"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden />
            {inStock ? "Adicionar ao carrinho" : "Indisponível"}
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neon-500">
            {product.categoryName}
          </p>

          <h3 className="text-sm font-bold leading-snug text-white">
            <Link href={`/produto/${product.slug}`} className="hover:text-neon-400">
              <span className="absolute inset-0 z-0 md:hidden" aria-hidden />
              {product.name}
            </Link>
          </h3>

          <PriceTag price={product.price} salePrice={product.salePrice} className="mt-auto" />

          {colors.length > 1 ? (
            <div className="flex items-center gap-1.5 pt-1">
              {colors.slice(0, 5).map((color) => (
                <span
                  key={color.name}
                  title={color.name}
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-white/15"
                  style={{ backgroundColor: color.hex }}
                />
              ))}
              {colors.length > 5 ? (
                <span className="text-[10px] text-smoke-400">+{colors.length - 5}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>

      {quickOpen ? (
        <QuickAddDrawer product={product} open={quickOpen} onClose={() => setQuickOpen(false)} />
      ) : null}
    </>
  );
}
