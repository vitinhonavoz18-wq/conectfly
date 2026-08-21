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
 */
export function PFAbout() {
  return (
    <PFSection id="sobre" superficie="light" aria-labelledby="pf-sobre-titulo">
      <div className="pf-container grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-16">
        {/* Fotografia com moldura deslocada — detalhe editorial. */}
        <PFReveal animacao="fade-up" indice={0} className="lg:col-span-5">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -bottom-4 -left-4 h-full w-full border border-[var(--pf-accent)] opacity-40"
            />
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--pf-surface)]">
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

        {/* Narrativa. */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <PFReveal animacao="fade" indice={1}>
            <span className="pf-eyebrow">{sobre.eyebrow}</span>
          </PFReveal>

          <PFReveal animacao="fade-up" indice={2}>
            <h2 id="pf-sobre-titulo" className="pf-h2 max-w-[24ch]">
              {sobre.titulo}
            </h2>
          </PFReveal>

          <PFReveal animacao="line" indice={3} className="w-full max-w-[16rem]">
            <div className="pf-rule" />
          </PFReveal>

          <div className="flex flex-col gap-5">
            {sobre.paragrafos.map((paragrafo, indice) => (
              <PFReveal key={indice} animacao="fade-up" indice={4 + indice}>
                <p className="pf-body max-w-[60ch]">{paragrafo}</p>
              </PFReveal>
            ))}
          </div>

          <PFReveal animacao="fade" indice={8}>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--pf-line)] pt-6">
              <span
                className="text-[var(--pf-fg)]"
                style={{
                  fontFamily: "var(--pf-font-display)",
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
