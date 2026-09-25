"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/store/favorites-context";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  productId,
  productName,
  className,
}: {
  productId: string;
  productName: string;
  className?: string;
}) {
  const { isFavorite, toggle, hydrated } = useFavorites();
  const { notify } = useToast();
  const active = hydrated && isFavorite(productId);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const added = toggle(productId);
        notify(
          added ? `${productName} salvo nos favoritos.` : `${productName} removido dos favoritos.`,
          added ? "success" : "info",
        );
      }}
      aria-pressed={active}
      aria-label={active ? `Remover ${productName} dos favoritos` : `Salvar ${productName} nos favoritos`}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border border-ink-600 bg-ink-950/80 backdrop-blur-sm transition-all hover:border-neon-500 hover:text-neon-400",
        active ? "text-neon-500" : "text-smoke-300",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4 transition-transform", active && "fill-current scale-110")} />
    </button>
  );
}
