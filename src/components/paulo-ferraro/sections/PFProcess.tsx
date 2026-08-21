import { atendimento } from "../content";
import { PFReveal } from "../primitives/PFReveal";
import { PFSection } from "../primitives/PFSection";
import { PFSectionHeading } from "../primitives/PFSectionHeading";

/**
 * COMO FUNCIONA O ATENDIMENTO.
 *
 * Três etapas: contato, análise inicial e orientação sobre os próximos passos.
 * O texto deixa explícito que o contato não significa contratação nem
 * resultado garantido — exigência ética e, na prática, o que reduz a ansiedade
 * de quem está do outro lado da tela.
 */
export function PFProcess() {
  return (
    <PFSection superficie="light" aria-labelledby="pf-atendimento-titulo">
      <div className="pf-container flex flex-col gap-12">
        <PFSectionHeading
          id="pf-atendimento-titulo"
          eyebrow={atendimento.eyebrow}
          titulo={atendimento.titulo}
          chamada={atendimento.chamada}
          alinhamento="center"
        />

        <ol className="grid grid-cols-1 gap-px border border-[var(--pf-line)] bg-[var(--pf-line)] md:grid-cols-3">
          {atendimento.etapas.map((etapa, indice) => (
            <PFReveal
              key={etapa.numero}
              as="li"
              animacao="fade-up"
              indice={indice}
              className="flex flex-col gap-4 bg-[var(--pf-bg)] p-8 sm:p-10"
            >
              <div className="flex items-baseline gap-3">
                <span
                  className="pf-numeral text-[var(--pf-accent-text)]"
                  style={{ fontSize: "2.25rem", lineHeight: 1 }}
                >
                  {etapa.numero}
                </span>
                <span
                  aria-hidden="true"
                  className="h-px flex-1 bg-[var(--pf-line)]"
                  style={{ transform: "translateY(-0.35rem)" }}
                />
              </div>

              <h3 className="pf-h3">{etapa.titulo}</h3>
              <p className="pf-body" style={{ fontSize: "var(--pf-text-sm)" }}>
                {etapa.descricao}
              </p>
            </PFReveal>
          ))}
        </ol>

        <PFReveal animacao="fade" indice={3}>
          <p
            className="mx-auto max-w-[56ch] text-center text-[var(--pf-fg-subtle)]"
            style={{ fontSize: "var(--pf-text-xs)", lineHeight: 1.7 }}
          >
            {atendimento.nota}
          </p>
        </PFReveal>
      </div>
    </PFSection>
  );
}
