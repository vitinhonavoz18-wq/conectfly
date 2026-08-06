import { PackageSearch } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/catalog";

export function ProductGrid({
  products,
  className,
  columnsClass = "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  animate = true,
  emptyMessage = "Nenhum produto encontrado com os filtros selecionados.",
  priorityCount = 0,
}: {
  products: Product[];
  className?: string;
  columnsClass?: string;
  animate?: boolean;
  emptyMessage?: string;
  priorityCount?: number;
}) {
  if (!products.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-ink-600 bg-ink-900 px-6 py-16 text-center">
        <PackageSearch className="h-8 w-8 text-smoke-400" aria-hidden />
        <p className="text-sm text-smoke-300">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className={cn("grid gap-4 sm:gap-5", columnsClass, className)}>
      {products.map((product, index) =>
        animate ? (
          <Reveal as="li" key={product.id} delay={Math.min(index, 7) * 55} className="h-full">
            <ProductCard product={product} className="h-full" priority={index < priorityCount} />
          </Reveal>
        ) : (
          <li key={product.id} className="h-full">
            <ProductCard product={product} className="h-full" priority={index < priorityCount} />
          </li>
        ),
      )}
    </ul>
  );
}
