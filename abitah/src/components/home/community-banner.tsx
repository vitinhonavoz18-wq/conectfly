import { ButtonLink } from "@/components/ui/button";
import { MediaFrame } from "@/components/ui/media-frame";
import { Reveal } from "@/components/ui/reveal";
import { siteConfig } from "@/config/site";

export function CommunityBanner() {
  return (
    <section className="relative overflow-hidden border-y border-ink-700 bg-ink-900">
      <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
        <Reveal>
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.28em] text-neon-500">
            Nossa comunidade
          </p>
          <h2 className="text-3xl font-black uppercase leading-[1.05] text-white sm:text-4xl lg:text-[2.75rem]">
            {siteConfig.institutional.communityHeadline}
          </h2>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-smoke-300 sm:text-base">
            {siteConfig.institutional.communityText}
          </p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { title: "Disciplina", text: "Rotina antes da motivação." },
              { title: "Desempenho", text: "Peça testada em treino real." },
              { title: "Pertencimento", text: "Você veste o mesmo time." },
            ].map((pillar) => (
              <li key={pillar.title} className="rounded-lg border border-ink-700 bg-ink-850 p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-neon-500">
                  {pillar.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-smoke-300">{pillar.text}</p>
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
