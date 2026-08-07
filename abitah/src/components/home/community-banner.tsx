import { ButtonLink } from "@/components/ui/button";
import { MediaFrame } from "@/components/ui/media-frame";
import { Reveal } from "@/components/ui/reveal";
import { siteConfig } from "@/config/site";

export function CommunityBanner() {
  return (
    <section className="relative overflow-hidden border-y border-white/7 bg-ink-900">
      <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
        <Reveal>
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-neon-500">
            Nossa comunidade
          </p>
          <h2 className="font-display text-3xl font-bold uppercase leading-[0.98] tracking-wide text-smoke-100 sm:text-4xl lg:text-[3rem]">
            {siteConfig.institutional.communityHeadline}
          </h2>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-smoke-400 sm:text-base">
            {siteConfig.institutional.communityText}
          </p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { title: "Disciplina", text: "Rotina antes da motivação." },
              { title: "Desempenho", text: "Peça testada em treino real." },
              { title: "Pertencimento", text: "Você veste o mesmo time." },
            ].map((pillar) => (
              <li key={pillar.title} className="rounded-[12px] border border-white/6 bg-ink-850 p-5">
                <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-neon-500">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-smoke-400">{pillar.text}</p>
              </li>
            ))}
          </ul>

          <ButtonLink href="/sobre" size="lg" className="mt-9">
            Conhecer nossa história
          </ButtonLink>
        </Reveal>

        <Reveal delay={120} className="grid grid-cols-2 gap-3">
          <MediaFrame
            src={null}
            alt="Treino na academia"
            label="Foto da academia"
            className="aspect-3/4 w-full"
            sizes="(max-width: 1024px) 45vw, 22vw"
          />
          <div className="grid gap-3 pt-8">
            <MediaFrame
              src={null}
              alt="Atleta da comunidade"
              label="Foto do atleta"
              className="aspect-square w-full"
              sizes="(max-width: 1024px) 45vw, 22vw"
            />
            <MediaFrame
              src={null}
              alt="Coleção oficial"
              label="Foto da coleção"
              className="aspect-square w-full"
              sizes="(max-width: 1024px) 45vw, 22vw"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
