import { ctaPrincipal, direitoMedico } from "../content";
import { PFButton } from "../primitives/PFButton";
import { PFReveal } from "../primitives/PFReveal";
import { PFSection } from "../primitives/PFSection";

/**
 * DIREITO MÉDICO — a seção mais importante do site.
 *
 * Layout em duas colunas: à esquerda o título fica "grudado" na tela enquanto
 * a pessoa rola os cinco temas à direita. É o mesmo princípio da placa da rua,
 * que continua visível enquanto você caminha pelos números — a pessoa nunca
 * perde de vista em que assunto está.
 *
 * No celular vira uma coluna só, com os temas em lista numerada.
 */
export function PFMedicalLaw() {
  return (
    <PFSection id="direito-medico" superficie="dark" aria-labelledby="pf-medico-titulo">
      {/* Brilho bordô discreto no canto superior — profundidade sem ruído. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          background:
            "radial-gradient(60% 45% at 78% 8%, var(--pf-accent-veil) 0%, transparent 70%)",
        }}
      />

      <div className="pf-container relative grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        {/* Coluna fixa — identidade da seção. */}
        <div className="lg:col-span-5">
          <div className="flex flex-col gap-6 lg:sticky lg:top-[calc(var(--pf-header-h-compact)+3rem)]">
            <PFReveal animacao="fade" indice={0}>
              <span className="pf-eyebrow">{direitoMedico.eyebrow}</span>
            </PFReveal>

            <PFReveal animacao="text-clip" indice={1}>
              <h2
                id="pf-medico-titulo"
                className="pf-h1"
                style={{ fontSize: "clamp(2.5rem, 6.5vw, 4.5rem)" }}
              >
                {direitoMedico.titulo}
              </h2>
            </PFReveal>

            <PFReveal animacao="line" indice={2} className="w-full max-w-[14rem]">
              <div className="pf-rule" />
            </PFReveal>

            <PFReveal animacao="fade-up" indice={3}>
              <p className="pf-lead max-w-[42ch]">{direitoMedico.chamada}</p>
            </PFReveal>

            <PFReveal animacao="fade-up" indice={4}>
              <p className="pf-body max-w-[46ch]">{direitoMedico.introducao}</p>
            </PFReveal>

            <PFReveal animacao="fade-up" indice={5}>
              <div className="flex flex-col gap-5 pt-2">
                <PFButton variante="primary" ancora={ctaPrincipal.ancora}>
                  {ctaPrincipal.rotulo}
                </PFButton>
                <p
                  className="max-w-[44ch] border-l border-[var(--pf-line-gold)] pl-4 text-[var(--pf-fg-subtle)]"
                  style={{ fontSize: "var(--pf-text-xs)", lineHeight: 1.6 }}
                >
                  {direitoMedico.nota}
                </p>
              </div>
            </PFReveal>
          </div>
        </div>

        {/* Coluna dos temas. */}
        <ol className="flex flex-col lg:col-span-7">
          {direitoMedico.temas.map((tema, indice) => (
            <PFReveal
              key={tema.numero}
              as="li"
              animacao="fade-right"
              indice={indice}
              className="pf-topic group relative border-t border-[var(--pf-line)] last:border-b"
            >
              <article className="relative flex gap-5 px-3 py-7 sm:gap-8 sm:px-4 sm:py-9">
                {/* Fio bordô que cresce ao passar o mouse sobre o item. */}
                <span
                  aria-hidden="true"
                  className="absolute -top-px left-0 h-px w-0 bg-[var(--pf-accent)] transition-[width] duration-700 ease-out group-hover:w-full"
                />

                <span
                  aria-hidden="true"
                  className="pf-numeral pf-topic__number shrink-0 text-[var(--pf-accent-text)]"
                  style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", lineHeight: 1.1 }}
                >
                  {tema.numero}
                </span>

                <div className="flex flex-col gap-2.5">
                  <h3 className="pf-h3 pf-topic__title">{tema.titulo}</h3>
                  <p className="pf-body max-w-[56ch]">{tema.descricao}</p>
                </div>
              </article>
            </PFReveal>
          ))}
        </ol>
      </div>
    </PFSection>
  );
}
