"use client";

import { useMemo, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button, ButtonLink } from "@/components/ui/button";
import { MediaFrame } from "@/components/ui/media-frame";
import { PriceTag } from "@/components/product/price-tag";
import { VariantPicker } from "@/components/product/variant-picker";
import { useCart } from "@/store/cart-context";
import { useToast } from "@/components/ui/toast";
import { effectivePrice, unique } from "@/lib/utils";
import type { Product } from "@/types/catalog";

/** Seleção rápida de tamanho/cor a partir de um card da vitrine. */
export function QuickAddDrawer({
  product,
  open,
  onClose,
}: {
  product: Product;
  open: boolean;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const { notify } = useToast();

  const colors = useMemo(
    () =>
      unique(product.variants.map((v) => v.color)).map((color) => ({
        name: color,
        hex: product.variants.find((v) => v.color === color)?.colorHex ?? "#0A0A0A",
      })),
    [product.variants],
  );

  const [color, setColor] = useState(colors[0]?.name ?? "");
  const [size, setSize] = useState<string>("");

  const sizesForColor = useMemo(
    () =>
      product.variants
        .filter((variant) => variant.color === color)
        .map((variant) => ({ size: variant.size, stock: variant.stock })),
    [product.variants, color],
  );

  const selectedVariant = product.variants.find((v) => v.color === color && v.size === size);
  const unitPrice = effectivePrice(product.price, product.salePrice);
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];

  function handleAdd() {
    if (!selectedVariant) {
      notify("Escolha o tamanho para continuar.", "error");
      return;
    }
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: primaryImage?.url ?? null,
      size: selectedVariant.size,
      color: selectedVariant.color,
      colorHex: selectedVariant.colorHex,
      unitPrice,
      compareAtPrice: product.salePrice ? product.price : null,
      quantity: 1,
      maxQuantity: selectedVariant.stock,
    });
    notify(`${product.name} adicionado ao carrinho.`);
    onClose();
  }

  return (
    <Drawer open={open} onClose={onClose} title="Adicionar ao carrinho" side="bottom">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex gap-4">
          <MediaFrame
            src={primaryImage?.url}
            alt={product.name}
            className="aspect-3/4 w-24 shrink-0"
            sizes="96px"
            label="Sem imagem"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-neon-500">
              {product.categoryName}
            </p>
            <h3 className="mt-1 truncate text-base font-bold text-white">{product.name}</h3>
            <PriceTag
              price={product.price}
              salePrice={product.salePrice}
              className="mt-2"
              showInstallments={false}
            />
          </div>
        </div>

        <div className="mt-6">
          <VariantPicker
            colors={colors}
            selectedColor={color}
            onSelectColor={(value) => {
              setColor(value);
              setSize("");
            }}
            sizes={sizesForColor}
            selectedSize={size}
            onSelectSize={setSize}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button onClick={handleAdd} fullWidth size="lg" disabled={!selectedVariant}>
            Adicionar ao carrinho
          </Button>
          <ButtonLink
            href={`/produto/${product.slug}`}
            variant="outline"
            size="lg"
            fullWidth
            onClick={onClose}
          >
            Ver detalhes
          </ButtonLink>
        </div>
      </div>
    </Drawer>
  );
}
