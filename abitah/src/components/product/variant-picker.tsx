"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function VariantPicker({
  colors,
  selectedColor,
  onSelectColor,
  sizes,
  selectedSize,
  onSelectSize,
  sizeGuideHref,
}: {
  colors: { name: string; hex: string }[];
  selectedColor: string;
  onSelectColor: (color: string) => void;
  sizes: { size: string; stock: number }[];
  selectedSize: string;
  onSelectSize: (size: string) => void;
  sizeGuideHref?: string;
}) {
  return (
    <div className="space-y-5">
      {colors.length > 0 ? (
        <fieldset>
          <legend className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-smoke-300">
            Cor: <span className="text-white">{selectedColor}</span>
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {colors.map((color) => {
              const active = color.name === selectedColor;
              return (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => onSelectColor(color.name)}
                  aria-pressed={active}
                  aria-label={`Cor ${color.name}`}
                  title={color.name}
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                    active ? "border-neon-500 scale-105" : "border-ink-600 hover:border-smoke-400",
                  )}
                >
                  <span
                    className="h-6 w-6 rounded-full ring-1 ring-white/10"
                    style={{ backgroundColor: color.hex }}
                  />
                  {active ? (
                    <Check
                      className="absolute h-3.5 w-3.5 text-white mix-blend-difference"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {sizes.length > 0 ? (
        <fieldset>
          <legend className="mb-2.5 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-smoke-300">
            <span>
              Tamanho{selectedSize ? <span className="text-white">: {selectedSize}</span> : null}
            </span>
            {sizeGuideHref ? (
              <a
                href={sizeGuideHref}
                className="normal-case tracking-normal text-neon-400 underline-offset-4 hover:underline"
              >
                Tabela de medidas
              </a>
            ) : null}
          </legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map(({ size, stock }) => {
              const disabled = stock <= 0;
              const active = size === selectedSize;
              return (
                <button
                  key={size}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectSize(size)}
                  aria-pressed={active}
                  className={cn(
                    "min-w-13 rounded-lg border px-3.5 py-2.5 text-xs font-bold uppercase tracking-wide transition-all",
                    active
                      ? "border-neon-500 bg-neon-500 text-ink-950"
                      : "border-ink-600 text-smoke-200 hover:border-neon-500 hover:text-neon-400",
                    disabled &&
                      "cursor-not-allowed border-ink-700 text-smoke-400/50 line-through hover:border-ink-700 hover:text-smoke-400/50",
                  )}
                  title={disabled ? "Indisponível no momento" : undefined}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
