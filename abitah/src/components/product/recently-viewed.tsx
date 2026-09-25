"use client";

import { useRecentlyViewed, useTrackRecentlyViewed } from "@/hooks/use-recently-viewed";
import { ClientProductList } from "@/components/product/product-carousel-client";

/** Registra a visita e exibe os produtos vistos recentemente. */
export function RecentlyViewed({ currentSlug }: { currentSlug?: string }) {
  useTrackRecentlyViewed(currentSlug ?? "");
  const { slugs, hydrated } = useRecentlyViewed();

  const list = slugs.filter((slug) => slug !== currentSlug).slice(0, 4);
  if (!hydrated || !list.length) return null;

  return (
    <ClientProductList slugs={list} title="Vistos recentemente" excludeSlug={currentSlug} />
  );
}
