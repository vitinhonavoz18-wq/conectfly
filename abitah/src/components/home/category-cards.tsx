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
            className="group relative block overflow-hidden rounded-[14px] border border-white/6 transition-colors duration-300 hover:border-white/14"
          >
            <MediaFrame
              src={category.imageUrl}
              alt={category.name}
              label="Adicionar imagem"
              className="aspect-4/5 w-full rounded-none"
              imageClassName="transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
              sizes="(max-width: 640px) 50vw, 25vw"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
              <div>
                <h3 className="font-display text-base font-bold uppercase leading-tight tracking-wide text-smoke-100">
                  {category.name}
                </h3>
                {category.description ? (
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-white/45">
                    {category.description}
                  </p>
                ) : null}
              </div>
              <ArrowUpRight
                className="h-5 w-5 shrink-0 text-neon-500 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden
              />
            </div>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}
