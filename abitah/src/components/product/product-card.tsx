"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { MediaFrame } from "@/components/ui/media-frame";
import { PriceTag } from "@/components/product/price-tag";
import { FavoriteButton } from "@/components/product/favorite-button";
import { QuickAddDrawer } from "@/components/product/quick-add-drawer";
import { useCart } from "@/store/cart-context";
import { useToast } from "@/components/ui/toast";
import { cn, effectivePrice, unique } from "@/lib/utils";
import type { Product } from "@/types/catalog";

/** Card de vitrine — imagem grande, moldura discreta e ações no hover. */
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
      <article className={cn("group relative flex flex-col", className)}>
        <div className="relative overflow-hidden rounded-[14px] border border-white/6 bg-ink-850 transition-colors duration-300 group-hover:border-white/12">
          <Link
            href={`/produto/${product.slug}`}
            className="block"
            aria-label={`Ver detalhes de ${product.name}`}
          >
            <MediaFrame
              src={primaryImage?.url}
              alt={product.name}
              className="aspect-4/5 w-full rounded-none"
              imageClassName="transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
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
            <span className="absolute inset-0 z-0 md:hidden" aria-hidden />
          </Link>

          <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {product.salePrice ? (
              <span className="rounded bg-neon-500 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#031006]">
                Promoção
              </span>
            ) : null}
            {product.isNew ? (
              <span className="rounded border border-white/12 bg-ink-950/85 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-smoke-100 backdrop-blur-sm">
                Lançamento
              </span>
            ) : null}
            {!inStock ? (
              <span className="rounded bg-ink-700 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-smoke-300">
                Esgotado
              </span>
            ) : null}
          </div>

          <FavoriteButton
            productId={product.id}
            productName={product.name}
            className="absolute right-3 top-3 opacity-0 transition-opacity duration-300 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
          />

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!inStock}
            className="absolute inset-x-3 bottom-3 flex h-11 translate-y-2 items-center justify-center gap-2 rounded-lg bg-neon-500 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#031006] opacity-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-neon-400 focus-visible:translate-y-0 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-smoke-400 group-hover:translate-y-0 group-hover:opacity-100 max-md:translate-y-0 max-md:opacity-100"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden />
            {inStock ? "Adicionar ao carrinho" : "Indisponível"}
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neon-500">
            {product.categoryName}
          </p>

          <h3 className="font-sans text-sm font-semibold leading-snug text-smoke-100">
            <Link href={`/produto/${product.slug}`} className="transition-colors hover:text-neon-400">
              {product.name}
            </Link>
          </h3>

          <PriceTag price={product.price} salePrice={product.salePrice} className="mt-auto pt-1" />

          {colors.length > 1 ? (
            <div className="flex items-center gap-1.5 pt-1">
              {colors.slice(0, 5).map((color) => (
                <span
                  key={color.name}
                  title={color.name}
                  className="h-3 w-3 rounded-full ring-1 ring-white/15"
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
