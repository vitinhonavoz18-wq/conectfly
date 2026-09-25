"use client";

import Image from "next/image";
import { useState } from "react";
import { Shirt } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Produto flutuante do hero.
 *
 * Espera um PNG/WEBP com fundo transparente em `src` (por padrão
 * /products/hero-product.png). Enquanto o arquivo não existir, renderiza um
 * placeholder com exatamente a mesma proporção — nenhuma imagem externa é
 * usada e o layout não muda quando o arquivo real chegar.
 */
export function ProductFigure({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-square w-full">
      {failed ? (
        <ProductPlaceholder />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="(max-width: 768px) 92vw, (max-width: 1200px) 58vw, 44vw"
          onError={() => setFailed(true)}
          className={cn(
            "object-contain",
            // Sombra profunda + leve luz verde de contorno, como estúdio escuro.
            "[filter:contrast(1.07)_brightness(0.96)_drop-shadow(0_35px_70px_rgba(0,0,0,0.75))_drop-shadow(0_25px_80px_rgba(32,232,63,0.10))]",
          )}
        />
      )}
    </div>
  );
}

function ProductPlaceholder() {
  return (
    <div
      role="img"
      aria-label="Espaço reservado para a foto do produto da coleção ABITAH"
      className="absolute inset-[10%] flex flex-col items-center justify-center gap-4 rounded-[2rem] border border-dashed border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(32,232,63,0.05),transparent_60%)]"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-neon-500/25 bg-neon-500/5 text-neon-500">
        <Shirt className="h-6 w-6" aria-hidden />
      </span>

      <div className="px-6 text-center">
        <p className="font-display text-base font-semibold uppercase tracking-[0.16em] text-smoke-300">
          Foto do produto
        </p>
        <p className="mt-2 hidden text-[11px] leading-relaxed text-smoke-400 sm:block">
          Coloque o arquivo em
          <br />
          <code className="text-neon-400">/public/products/hero-product.png</code>
        </p>
        <p className="mt-3 hidden text-[10px] uppercase tracking-[0.18em] text-smoke-500 sm:block">
          PNG ou WEBP · fundo transparente · 1600×1600
        </p>
      </div>
    </div>
  );
}
