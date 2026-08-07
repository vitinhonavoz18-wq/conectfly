import { Reveal } from "@/components/ui/reveal";
import { siteConfig } from "@/config/site";

/**
 * Números da marca. Ficam abaixo do hero, de propósito: no hero eles
 * disputariam atenção com o produto.
 */
export function BrandStats() {
  return (
    <section className="bg-ink-950">
      <div className="container-page grid gap-8 py-14 lg:grid-cols-[1fr_auto] lg:items-center lg:py-16">
        <Reveal>
          <p className="max-w-xl font-display text-xl font-semibold uppercase leading-tight tracking-wide text-smoke-200 sm:text-2xl">
            Uma marca construída dentro da academia,{" "}
            <span className="text-neon-500">vestida por quem treina de verdade.</span>
          </p>
        </Reveal>

        <Reveal delay={120}>
          <dl className="grid grid-cols-3 gap-8 sm:gap-12">
            {siteConfig.hero.stats.map((stat) => (
              <div key={stat.label}>
                <dt className="font-display text-3xl font-bold text-smoke-100 sm:text-4xl">
                  {stat.value}
                </dt>
                <dd className="mt-1.5 text-[10px] uppercase leading-tight tracking-[0.16em] text-smoke-400">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
