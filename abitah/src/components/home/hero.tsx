import { ArrowRight, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { MediaFrame } from "@/components/ui/media-frame";

/**
 * Banner principal. A área de imagem é trocada informando `imageUrl`
 * (via banner cadastrado no painel) — o layout permanece o mesmo.
 */
export function Hero({
  title = "TREINE FORTE. VISTA SUA IDENTIDADE.",
  subtitle = "Roupas e acessórios oficiais para quem leva o treino além dos limites.",
  imageUrl = null,
}: {
  title?: string;
  subtitle?: string;
  imageUrl?: string | null;
}) {
  return (
    <section className="relative overflow-hidden bg-ink-950">
      <div className="absolute inset-0" aria-hidden>
        <div className="absolute -left-40 top-0 h-125 w-125 rounded-full bg-neon-600/12 blur-[130px]" />
        <div className="absolute -right-32 bottom-0 h-100 w-100 rounded-full bg-neon-500/8 blur-[120px]" />
      </div>

      <div className="container-page relative grid items-center gap-10 py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-24">
        <div className="animate-[fade-up_0.7s_cubic-bezier(0.22,1,0.36,1)_both]">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-neon-500/35 bg-neon-500/8 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-neon-400">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Coleção oficial da academia
          </p>

          <h1 className="text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
            {title.split(" ").map((word, index) => (
              <span key={`${word}-${index}`} className={index % 3 === 2 ? "text-neon-500" : ""}>
                {word}{" "}
              </span>
            ))}
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-smoke-300 sm:text-lg">
            {subtitle}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/loja" size="lg" className="group">
              Conhecer coleção
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </ButtonLink>
            <ButtonLink href="/lancamentos" variant="outline" size="lg">
              Ver lançamentos
            </ButtonLink>
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-ink-700 pt-6">
            {[
              { value: "+2.400", label: "Alunos vestindo" },
              { value: "100%", label: "Produção nacional" },
              { value: "4,9", label: "Avaliação média" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-2xl font-extrabold text-neon-500">{stat.value}</dt>
                <dd className="mt-1 text-[11px] uppercase leading-tight tracking-wider text-smoke-400">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <MediaFrame
            src={imageUrl}
            alt="Coleção oficial ABITAH"
            label="Adicionar foto da academia, atleta ou coleção"
            className="aspect-4/5 w-full border border-ink-700 shadow-soft sm:aspect-3/4 lg:aspect-4/5"
            sizes="(max-width: 1024px) 100vw, 45vw"
            priority
          />
          <div className="absolute -bottom-4 -left-4 hidden rounded-card border border-neon-500/30 bg-ink-900/95 px-5 py-4 backdrop-blur-sm sm:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-500">
              Nova coleção
            </p>
            <p className="mt-1 text-sm font-bold text-white">Linha Performance 2026</p>
          </div>
        </div>
      </div>
    </section>
  );
}
