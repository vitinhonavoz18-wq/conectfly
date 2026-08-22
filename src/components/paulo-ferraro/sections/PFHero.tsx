import { ArrowDown } from "lucide-react";
import { CAMINHO_FOTO_HERO, fotoHero } from "../assets";
import { ctaPrincipal, ctaSecundario, hero, perfil } from "../content";
import { PFButton } from "../primitives/PFButton";
import { PFPhotoSlot } from "../primitives/PFPhotoSlot";
import { PFReveal } from "../primitives/PFReveal";

/**
 * HERO — a primeira tela.
 *
 * A abertura funciona como a de um filme, e nesta ordem:
 *
 *   1. a luz da sala — o fundo e a grade surgem;
 *   2. o halo de luz floresce atrás da silhueta;
 *   3. o arco arquitetônico se levanta;
 *   4. o advogado é revelado de baixo para cima por uma máscara que sobe,
 *      enquanto a imagem se assenta e o desfoque inicial se dissolve — como
 *      uma lente encontrando o foco;
 *   5. os letreiros entram em sequência: rótulo, nome, frase, destaque,
 *      descrição, botões.
 *
 * Tudo termina em cerca de 1,5 segundo. É rápido de propósito: animação longa
 * em página institucional cansa mais do que impressiona.
 *
 * Cada camada mora numa "casca" separada (`pf-hero__layer`). A casca faz o
 * parallax, o conteúdo faz a entrada. Duas mãos, dois trabalhos — assim um
 * movimento nunca apaga o outro.
 *
 * No celular a composição é própria, não o desktop espremido: a fotografia
 * ocupa o alto da tela e o texto sobe por cima da altura do peito, com um véu
 * escuro garantindo a leitura. O rosto nunca é coberto.
 */
export function PFHero() {
  return (
    <section
      id="inicio"
      data-pf-scroll-anchor=""
      className="pf-hero"
      aria-labelledby="pf-hero-nome"
    >
      {/* Camada 1 — grade arquitetônica, quase imperceptível. */}
      <div className="pf-hero__layer pf-hero__layer--grid" aria-hidden="true">
        <div className="pf-hero__backdrop">
          <div className="pf-grid-texture" />
        </div>
      </div>

      {/* Camada 2 — véu superior, para o cabeçalho continuar legível. */}
      <div
        className="pf-hero__backdrop"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to bottom, oklch(0.125 0.004 285 / 85%) 0%, transparent 28%)",
        }}
      />

      <div className="pf-hero__inner">
        {/* ---------------------------------------------------------------
         * LADO TEXTUAL
         * ------------------------------------------------------------- */}
        <div className="pf-hero__copy">
          {/* Véu que protege a leitura do texto sobre a foto no celular. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute md:hidden"
            style={{
              insetInline: "calc(var(--pf-gutter) * -1)",
              top: "-6rem",
              bottom: 0,
              background:
                "linear-gradient(to top, var(--pf-bg) 58%, oklch(0.125 0.004 285 / 92%) 80%, transparent 100%)",
            }}
          />

          <div className="relative flex flex-col items-start gap-6">
            <PFReveal animacao="hero" indice={0}>
              <span className="pf-eyebrow">{hero.identificacao}</span>
            </PFReveal>

            <PFReveal animacao="hero" indice={1}>
              <h1 id="pf-hero-nome" className="pf-display uppercase">
                {hero.nome}
              </h1>
            </PFReveal>

            <PFReveal animacao="hero" indice={2} className="w-full max-w-[22rem]">
              <div className="pf-rule" />
            </PFReveal>

            <PFReveal animacao="hero" indice={3}>
              <p
                className="pf-serif max-w-[28ch] text-[var(--pf-fg)]"
                style={{
                  fontSize: "clamp(1.25rem, 3.2vw, 1.75rem)",
                  lineHeight: 1.25,
                }}
              >
                {hero.headline}
              </p>
            </PFReveal>

            {/* Destaque principal — Direito Médico. */}
            <PFReveal animacao="hero" indice={4}>
              <div className="flex flex-col gap-2 border-l-2 border-[var(--pf-accent)] pl-4">
                <span
                  className="text-[var(--pf-fg)]"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "var(--pf-tracking-eyebrow)",
                    textTransform: "uppercase",
                  }}
                >
                  {hero.rotuloDestaque}
                </span>
                <span
                  className="pf-serif text-[var(--pf-fg)]"
                  style={{
                    fontSize: "clamp(1.75rem, 4.5vw, 2.5rem)",
                    lineHeight: 1,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {hero.destaque}
                </span>
              </div>
            </PFReveal>

            <PFReveal animacao="hero" indice={5}>
              <p className="pf-body max-w-[46ch]">{hero.descricao}</p>
            </PFReveal>

            <PFReveal animacao="hero" indice={6} className="w-full">
              <div className="flex w-full flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <PFButton variante="primary" ancora={ctaPrincipal.ancora}>
                  {ctaPrincipal.rotulo}
                </PFButton>
                <PFButton variante="outline" ancora={ctaSecundario.ancora}>
                  {ctaSecundario.rotulo}
                </PFButton>
              </div>
            </PFReveal>

            <PFReveal animacao="hero" indice={7} className="hidden md:block">
              <PFButton
                variante="ghost"
                ancora="sobre"
                className="mt-4"
                aria-label="Continuar para a apresentação do advogado"
              >
                <ArrowDown size={16} strokeWidth={1.4} aria-hidden="true" data-pf-arrow="" />
                {perfil.anosAtuacao} anos de atuação
              </PFButton>
            </PFReveal>
          </div>
        </div>

        {/* ---------------------------------------------------------------
         * LADO FOTOGRÁFICO — camadas empilhadas
         * ------------------------------------------------------------- */}
        <div className="pf-hero__stage">
          <div className="pf-hero__layer pf-hero__layer--halo" aria-hidden="true">
            <div className="pf-hero__halo" />
          </div>

          <div className="pf-hero__layer pf-hero__layer--arc" aria-hidden="true">
            <div className="pf-hero__arc" />
          </div>

          <div className="pf-hero__layer pf-hero__layer--photo">
            <PFPhotoSlot
              src={fotoHero}
              alt={hero.fotoAlt}
              caminhoEsperado={CAMINHO_FOTO_HERO}
              descricao="Fotografia principal do advogado"
              imgClassName="pf-hero__photo"
              className={fotoHero ? undefined : "pf-hero__photo-fallback max-h-full"}
              prioridade
            />
          </div>

          <div className="pf-hero__floor" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
