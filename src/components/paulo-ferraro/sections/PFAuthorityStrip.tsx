import { credenciais } from "../content";
import { PFReveal } from "../primitives/PFReveal";
import { PFSection } from "../primitives/PFSection";

/**
 * Faixa de credenciais.
 *
 * Fatos objetivos, sem número inflado e sem promessa: tempo de atuação, área
 * de destaque, quantidade de áreas atendidas e a atuação institucional.
 *
 * Fica logo abaixo do Hero porque é ali que a pessoa decide se continua ou
 * fecha a página — é a vitrine antes da porta, não o cardápio inteiro.
 */
export function PFAuthorityStrip() {
  return (
    <PFSection
      superficie="graphite"
      compacta
      aria-label="Credenciais profissionais"
      className="border-y border-[var(--pf-line)]"
    >
      <div className="pf-container">
        <dl className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4">
          {credenciais.map((item, indice) => (
            <PFReveal
              key={item.valor}
              animacao="zoom"
              indice={indice}
              className="flex flex-col gap-2 border-t border-[var(--pf-line)] py-6 first:border-t-0 sm:border-t-0 sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-0 lg:py-2"
            >
              <dt
                className="text-[var(--pf-fg)]"
                style={{
                  fontFamily: "var(--pf-font-display)",
                  fontSize: "clamp(1.5rem, 2.6vw, 2rem)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.01em",
                }}
              >
                {item.valor}
              </dt>
              <dd
                className="text-[var(--pf-fg-muted)]"
                style={{ fontSize: "var(--pf-text-xs)", lineHeight: 1.5 }}
              >
                {item.rotulo}
              </dd>
            </PFReveal>
          ))}
        </dl>
      </div>
    </PFSection>
  );
}
