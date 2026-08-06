import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MediaFrame } from "@/components/ui/media-frame";
import { Reveal } from "@/components/ui/reveal";
import type { Category } from "@/types/catalog";

export function CategoryCards({ categories }: { categories: Category[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {categories.map((category, index) => (
        <Reveal as="li" key={category.id} delay={Math.min(index, 7) * 55}>
          <Link
            href={`/loja?categoria=${category.slug}`}
            className="group relative block overflow-hidden rounded-card border border-ink-700 transition-all duration-300 hover:border-neon-500/45 hover:shadow-neon"
          >
            <MediaFrame
              src={category.imageUrl}
              alt={category.name}
              label="Adicionar imagem"
              className="aspect-4/5 w-full rounded-none sm:aspect-square"
              imageClassName="transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, 25vw"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
              <div>
                <h3 className="text-sm font-bold uppercase leading-tight tracking-wide text-white">
                  {category.name}
                </h3>
                {category.description ? (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-smoke-300">
                    {category.description}
                  </p>
                ) : null}
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neon-500/40 bg-ink-950/70 text-neon-500 transition-all duration-300 group-hover:bg-neon-500 group-hover:text-ink-950">
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </span>
            </div>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}
