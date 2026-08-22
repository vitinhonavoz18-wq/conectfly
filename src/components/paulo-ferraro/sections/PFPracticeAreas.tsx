import { ArrowUpRight } from "lucide-react";
import { areas, ctaPrincipal } from "../content";
import { PFPracticeAreaCard } from "../primitives/PFPracticeAreaCard";
import { PFReveal } from "../primitives/PFReveal";
import { PFSection } from "../primitives/PFSection";
import { PFSectionHeading } from "../primitives/PFSectionHeading";

/**
 * OUTRAS ÁREAS DE ATUAÇÃO.
 *
 * Cinco cartões em grade de três colunas. A sexta posição, que sobraria vazia,
 * recebe um convite discreto ao contato — em vez de um buraco no layout, um
 * caminho para quem não se encontrou em nenhuma das áreas listadas.
 */
export function PFPracticeAreas() {
  return (
    <PFSection id="areas" superficie="light" aria-labelledby="pf-areas-titulo">
      <div className="pf-container flex flex-col gap-12">
        <PFSectionHeading
          id="pf-areas-titulo"
          eyebrow={areas.eyebrow}
          titulo={areas.titulo}
          chamada={areas.chamada}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {areas.lista.map((area, indice) => (
            <PFReveal key={area.titulo} animacao="zoom" indice={indice} className="h-full">
              <PFPracticeAreaCard area={area} />
            </PFReveal>
          ))}

          <PFReveal animacao="fade-up" indice={areas.lista.length} className="h-full">
            <a
              href={`#${ctaPrincipal.ancora}`}
              className="group flex h-full flex-col justify-between gap-6 border border-dashed border-[var(--pf-line-strong)] p-7 transition-colors duration-500 hover:border-[var(--pf-accent)] hover:bg-[var(--pf-accent-veil)] sm:p-8"
            >
              <span
                className="pf-serif text-[var(--pf-fg)]"
                style={{
                  fontSize: "1.5rem",
                  lineHeight: 1.2,
                }}
              >
                Sua situação não está nesta lista?
              </span>
              <span className="pf-body" style={{ fontSize: "var(--pf-text-sm)" }}>
                Descreva o caso e receba uma orientação sobre qual caminho jurídico se aplica.
              </span>
              <span
                className="flex items-center gap-2 text-[var(--pf-accent-text)]"
                style={{
                  fontSize: "var(--pf-text-xs)",
                  fontWeight: 700,
                  letterSpacing: "var(--pf-tracking-wide)",
                  textTransform: "uppercase",
                }}
              >
                {ctaPrincipal.rotulo}
                <ArrowUpRight
                  size={16}
                  strokeWidth={1.6}
                  aria-hidden="true"
                  className="pf-icon-shift"
                />
              </span>
            </a>
          </PFReveal>
        </div>
      </div>
    </PFSection>
  );
}
