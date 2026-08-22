import { ctaInstitucional, ctaPrincipal, ctaSecundario } from "../content";
import { PFButton } from "../primitives/PFButton";
import { PFReveal } from "../primitives/PFReveal";
import { PFSection } from "../primitives/PFSection";

/**
 * CTA INSTITUCIONAL — o bloco forte antes do contato.
 *
 * Convida à conversa sem prometer nada: fala em "análise" e "entender o que
 * pode ser feito", nunca em ganhar a causa. É o convite para entrar e sentar,
 * não o vendedor puxando pelo braço na porta da loja.
 */
export function PFCta() {
  return (
    <PFSection superficie="dark" aria-labelledby="pf-cta-titulo" className="overflow-hidden">
      {/* Fundo bordô profundo, dissolvido nas bordas. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 120% at 50% 100%, oklch(0.3 0.1 17 / 55%) 0%, transparent 68%)",
        }}
      />
      <div className="pf-grid-texture" aria-hidden="true" />

      <div className="pf-container pf-container--narrow relative flex flex-col items-center gap-8 text-center">
        <PFReveal animacao="fade" indice={0}>
          <span className="pf-eyebrow pf-eyebrow--plain">{ctaInstitucional.eyebrow}</span>
        </PFReveal>

        <PFReveal animacao="text-clip" indice={1}>
          <h2 id="pf-cta-titulo" className="pf-h2 mx-auto max-w-[20ch]">
            {ctaInstitucional.titulo}
          </h2>
        </PFReveal>

        <PFReveal animacao="fade-up" indice={2}>
          <p className="pf-lead mx-auto max-w-[54ch]">{ctaInstitucional.descricao}</p>
        </PFReveal>

        <PFReveal animacao="fade-up" indice={3} className="w-full">
          <div className="flex w-full flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
            <PFButton variante="primary" ancora={ctaPrincipal.ancora}>
              {ctaPrincipal.rotulo}
            </PFButton>
            <PFButton variante="outline" ancora={ctaSecundario.ancora}>
              {ctaSecundario.rotulo}
            </PFButton>
          </div>
        </PFReveal>
      </div>
    </PFSection>
  );
}
