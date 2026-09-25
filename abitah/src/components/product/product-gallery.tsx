"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MediaFrame } from "@/components/ui/media-frame";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types/catalog";

export function ProductGallery({
  images,
  productName,
  badges,
}: {
  images: ProductImage[];
  productName: string;
  badges?: { label: string; tone?: "neon" | "dark" | "muted" }[];
}) {
  const [index, setIndex] = useState(0);
  const active = images[index] ?? images[0];

  const go = (delta: number) =>
    setIndex((current) => (current + delta + images.length) % images.length);

  return (
    <div className="flex flex-col gap-3 lg:flex-row-reverse lg:gap-4">
      <div className="relative flex-1">
        <MediaFrame
          src={active?.url}
          alt={active?.alt ?? productName}
          label="Adicionar imagem do produto"
          className="aspect-3/4 w-full border border-ink-700"
          sizes="(max-width: 1024px) 100vw, 45vw"
          priority
        />

        {badges?.length ? (
          <div className="pointer-events-none absolute left-4 top-4 flex flex-col items-start gap-2">
            {badges.map((badge) => (
              <Badge key={badge.label} tone={badge.tone ?? "neon"}>
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Imagem anterior"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink-600 bg-ink-950/80 text-smoke-200 backdrop-blur-sm transition-colors hover:border-neon-500 hover:text-neon-400"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próxima imagem"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink-600 bg-ink-950/80 text-smoke-200 backdrop-blur-sm transition-colors hover:border-neon-500 hover:text-neon-400"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <p className="absolute bottom-3 right-3 rounded-md bg-ink-950/85 px-2 py-1 text-[10px] font-bold text-smoke-200">
              {index + 1}/{images.length}
            </p>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <ul
          aria-label="Miniaturas"
          className="flex gap-2.5 overflow-x-auto pb-1 lg:w-22 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {images.map((image, imageIndex) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(imageIndex)}
                aria-label={`Ver imagem ${imageIndex + 1}`}
                aria-current={imageIndex === index}
                className={cn(
                  "block overflow-hidden rounded-lg border-2 transition-all",
                  imageIndex === index
                    ? "border-neon-500"
                    : "border-ink-700 opacity-70 hover:opacity-100",
                )}
              >
                <MediaFrame
                  src={image.url}
                  alt={image.alt}
                  label=""
                  className="aspect-3/4 w-18 rounded-none"
                  sizes="72px"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
