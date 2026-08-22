import { CAMINHO_FOTO_SOBRE, fotoSobre } from "../assets";
import { isPendente, perfil, sobre } from "../content";
import { PFPhotoSlot } from "../primitives/PFPhotoSlot";
import { PFPlaceholder } from "../primitives/PFPlaceholder";
import { PFReveal } from "../primitives/PFReveal";
import { PFSection } from "../primitives/PFSection";

/**
 * SOBRE — imagem e narrativa profissional.
 *
 * Primeira seção clara do site. A troca de fundo (preto → off-white) é
 * proposital: funciona como virar a página de uma revista, separando a
 * apresentação de impacto do texto que se lê com calma.
 *
 * A fotografia entra por uma máscara que sobe, e o texto sobe em seguida —
 * duas entradas diferentes, para a seção não parecer uma fileira de blocos
 * fazendo a mesma coisa.
 *
 * Os três pilares (ética, técnica, responsabilidade) vêm da própria
 * apresentação do advogado. Estão em cartões curtos porque, no celular, o
 * texto corrido some do olho: o que é lido de relance é o que fica.
 */
export function PFAbout() {
  return (
    <PFSection id="sobre" superficie="light" aria-labelledby="pf-sobre-titulo">
      <div className="pf-container grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-16">
        {/* Fotografia com moldura deslocada — detalhe editorial. */}
        <div className="lg:col-span-5">
          <PFReveal animacao="mask-up" indice={0}>
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -bottom-4 -left-4 h-full w-full border border-[var(--pf-accent)] opacity-40"
              />
              {/* A proporção 3/4 é a da própria fotografia: assim ela entra
                  inteira, sem nenhum corte na cabeça nem nos braços.

                  O painel é escuro mesmo numa seção clara. A fotografia veio
                  recortada, sem fundo — sobre o off-white, um terno preto
                  recortado pareceria uma figura colada com cola bastão. Sobre o
                  grafite com um leve brilho de bronze, vira o que ela é: um
                  retrato de estúdio, e ainda ecoa a primeira tela do site. */}
              <div className="pf-portrait-panel relative aspect-[3/4] w-full overflow-hidden">
                <PFPhotoSlot
                  src={fotoSobre}
                  alt={sobre.fotoAlt}
                  caminhoEsperado={CAMINHO_FOTO_SOBRE}
                  descricao="Fotografia da seção Sobre"
                  imgClassName="h-full w-full object-cover object-top"
                />
              </div>
            </div>
          </PFReveal>

          {/* Número em destaque, ancorado à moldura da fotografia. */}
          <PFReveal animacao="fade-up" indice={1}>
            <div className="mt-8 flex items-end gap-4 border-t border-[var(--pf-line)] pt-6">
              <span
                className="pf-numeral text-[var(--pf-accent-text)]"
                style={{ fontSize: "clamp(3rem, 7vw, 4.25rem)", lineHeight: 0.85 }}
              >
                {sobre.destaque.valor}
              </span>
              <span className="flex flex-col pb-1">
                <span
                  className="pf-serif text-[var(--pf-fg)]"
                  style={{
                    fontSize: "1.35rem",
                    lineHeight: 1,
                  }}
                >
                  {sobre.destaque.unidade}
                </span>
                <span
                  className="text-[var(--pf-fg-muted)]"
                  style={{ fontSize: "var(--pf-text-xs)" }}
                >
                  {sobre.destaque.rotulo}
                </span>
              </span>
            </div>
          </PFReveal>
        </div>

        {/* Narrativa. */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <PFReveal animacao="fade" indice={0}>
            <span className="pf-eyebrow">{sobre.eyebrow}</span>
          </PFReveal>

          <PFReveal animacao="text-clip" indice={1}>
            <h2 id="pf-sobre-titulo" className="pf-h2 max-w-[24ch]">
              {sobre.titulo}
            </h2>
          </PFReveal>

          <PFReveal animacao="line" indice={2} className="w-full max-w-[16rem]">
            <div className="pf-rule" />
          </PFReveal>

          <div className="flex flex-col gap-5">
            {sobre.paragrafos.map((paragrafo, indice) => (
              <PFReveal key={indice} animacao="fade-up" indice={3 + indice}>
                <p className="pf-body max-w-[60ch]">{paragrafo}</p>
              </PFReveal>
            ))}
          </div>

          {/* Os três pilares. */}
          <ul className="mt-2 grid grid-cols-1 gap-px border border-[var(--pf-line)] bg-[var(--pf-line)] sm:grid-cols-3">
            {sobre.pilares.map((pilar, indice) => (
              <PFReveal
                key={pilar.titulo}
                as="li"
                animacao="fade-up"
                indice={indice}
                className="group flex flex-col gap-2 bg-[var(--pf-bg)] p-5 transition-colors duration-300 hover:bg-[var(--pf-accent-veil)]"
              >
                <span
                  className="text-[var(--pf-accent-text)]"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "var(--pf-tracking-eyebrow)",
                    textTransform: "uppercase",
                  }}
                >
                  {pilar.titulo}
                </span>
                <span
                  className="text-[var(--pf-fg-muted)]"
                  style={{ fontSize: "var(--pf-text-xs)", lineHeight: 1.6 }}
                >
                  {pilar.descricao}
                </span>
              </PFReveal>
            ))}
          </ul>

          <PFReveal animacao="fade" indice={3}>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--pf-line)] pt-6">
              <span
                className="pf-serif text-[var(--pf-fg)]"
                style={{
                  fontSize: "1.25rem",
                  letterSpacing: "0.01em",
                }}
              >
                {sobre.assinatura}
              </span>
              {isPendente(perfil.oab) ? (
                <PFPlaceholder campo="número da OAB" />
              ) : (
                <span
                  className="text-[var(--pf-fg-muted)]"
                  style={{ fontSize: "var(--pf-text-xs)", letterSpacing: "0.08em" }}
                >
                  {perfil.oab}
                </span>
              )}
            </div>
          </PFReveal>
        </div>
      </div>
    </PFSection>
  );
}
