import { experiencia } from "../content";
import { PFReveal } from "../primitives/PFReveal";
import { PFSection } from "../primitives/PFSection";
import { PFSectionHeading } from "../primitives/PFSectionHeading";

/**
 * TRAJETÓRIA / EXPERIÊNCIA INSTITUCIONAL.
 *
 * Apresenta a atuação na JARI / SEMOB como trajetória, não como troféu: uma
 * linha vertical com marcos, no formato de um currículo bem diagramado.
 * Nenhum número, prêmio ou título foi acrescentado — só o que foi informado.
 */
export function PFExperience() {
  return (
    <PFSection id="experiencia" superficie="dark" aria-labelledby="pf-experiencia-titulo">
      <div className="pf-grid-texture" aria-hidden="true" />

      <div className="pf-container relative grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <PFSectionHeading
            id="pf-experiencia-titulo"
            eyebrow={experiencia.eyebrow}
            titulo={experiencia.titulo}
            chamada={experiencia.chamada}
          />
        </div>

        <ol className="relative flex flex-col lg:col-span-7">
          {/* Linha vertical contínua que costura os marcos. */}
          <span
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-0 w-px bg-[var(--pf-line)]"
          />

          {experiencia.marcos.map((marco, indice) => (
            <PFReveal
              key={marco.titulo}
              as="li"
              animacao="fade-right"
              indice={indice}
              className="relative pb-10 pl-8 last:pb-0 sm:pl-10"
            >
              {/* Marcador losango — discreto, sem clichê de linha do tempo. */}
              <span
                aria-hidden="true"
                className="absolute top-2 -left-[4.5px] h-2.5 w-2.5 rotate-45 border border-[var(--pf-line-gold)] bg-[var(--pf-bg)]"
              />

              <div className="flex flex-col gap-2">
                <span
                  className="text-[var(--pf-accent-text)]"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "var(--pf-tracking-eyebrow)",
                    textTransform: "uppercase",
                  }}
                >
                  {marco.rotulo}
                </span>
                <h3
                  className="text-[var(--pf-fg)]"
                  style={{
                    fontFamily: "var(--pf-font-display)",
                    fontSize: "clamp(1.35rem, 2.4vw, 1.75rem)",
                    lineHeight: 1.2,
                  }}
                >
                  {marco.titulo}
                </h3>
                <p className="pf-body max-w-[54ch]">{marco.descricao}</p>
              </div>
            </PFReveal>
          ))}
        </ol>
      </div>
    </PFSection>
  );
}
