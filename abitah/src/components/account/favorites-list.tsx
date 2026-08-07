"use client";

import { Heart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ClientProductList } from "@/components/product/product-carousel-client";
import { useFavorites } from "@/store/favorites-context";

export function FavoritesList() {
  const { ids, hydrated } = useFavorites();

  if (!hydrated) return <div className="h-64 animate-pulse rounded-card bg-ink-900" />;

  if (!ids.length) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-ink-600 bg-ink-900 px-6 py-14 text-center">
        <Heart className="h-9 w-9 text-smoke-400" aria-hidden />
        <p className="text-sm text-smoke-300">
          Você ainda não salvou nenhuma peça. Toque no coração dos produtos que quiser guardar.
        </p>
        <ButtonLink href="/loja">Explorar a loja</ButtonLink>
      </div>
    );
  }

  return (
    <ClientProductList
      ids={ids}
      columnsClass="grid-cols-2 xl:grid-cols-3"
      emptyMessage="Os produtos favoritados não estão mais disponíveis."
    />
  );
}
