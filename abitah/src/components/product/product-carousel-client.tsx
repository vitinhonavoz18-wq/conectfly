"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/types/catalog";

/**
 * Vitrine alimentada no cliente a partir de uma lista de slugs/ids
 * guardada no navegador (vistos recentemente, favoritos).
 */
export function ClientProductList({
  slugs,
  ids,
  title,
  emptyMessage,
  excludeSlug,
  columnsClass = "grid-cols-2 lg:grid-cols-4",
}: {
  slugs?: string[];
  ids?: string[];
  title?: string;
  emptyMessage?: string;
  excludeSlug?: string;
  columnsClass?: string;
}) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const key = (slugs ?? ids ?? []).join(",");

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const param = slugs ? `slugs=${encodeURIComponent(key)}` : `ids=${encodeURIComponent(key)}`;

    fetch(`/api/produtos?${param}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { products: [] }))
      .then((data: { products: Product[] }) => setProducts(data.products ?? []))
      .catch(() => setProducts([]));

    return () => controller.abort();
  }, [key, slugs]);

  const resolved = key ? products : [];
  const visible = (resolved ?? []).filter((product) => product.slug !== excludeSlug);

  if (resolved === null) {
    return (
      <ul className={`grid gap-4 ${columnsClass}`} aria-hidden>
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="aspect-3/4 animate-pulse rounded-card bg-ink-850" />
        ))}
      </ul>
    );
  }

  if (!visible.length) {
    return emptyMessage ? (
      <p className="rounded-card border border-dashed border-ink-600 bg-ink-900 px-6 py-10 text-center text-sm text-smoke-300">
        {emptyMessage}
      </p>
    ) : null;
  }

  return (
    <>
      {title ? (
        <h2 className="section-rule mb-6 text-xl font-extrabold uppercase text-white">{title}</h2>
      ) : null}
      <ul className={`grid gap-4 sm:gap-5 ${columnsClass}`}>
        {visible.map((product) => (
          <li key={product.id} className="h-full">
            <ProductCard product={product} className="h-full" />
          </li>
        ))}
      </ul>
    </>
  );
}
