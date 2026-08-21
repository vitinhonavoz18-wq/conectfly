import { ArrowDown } from "lucide-react";
import { CAMINHO_FOTO_HERO, fotoHero } from "../assets";
import { ctaPrincipal, ctaSecundario, hero, perfil } from "../content";
import { PFButton } from "../primitives/PFButton";
import { PFPhotoSlot } from "../primitives/PFPhotoSlot";
import { PFReveal } from "../primitives/PFReveal";

/**
 * HERO — a primeira tela.
 *
 * A fotografia é a protagonista. Tudo que está atrás dela (o halo de luz, o
 * arco, a grade) é montado em camadas separadas e empilhadas, como as folhas
 * de acetato de um desenho animado: na FASE 2 dá para mover o halo em uma
 * velocidade, a foto em outra e a grade em uma terceira, sem tocar em nenhum
 * texto.
 *
 * No celular a composição é outra — não é o desktop espremido. A foto ocupa o
 * alto da tela e o texto sobe por cima da altura do peito, com um véu escuro
 * garantindo a leitura. O rosto nunca é coberto.
 */
export function PFHero() {
  return (
    <section
      id="inicio"
      data-pf-scroll-anchor=""
      className="pf-hero"
      aria-labelledby="pf-hero-nome"
    >
      {/* Camada 1 — textura de grade arquitetônica, quase imperceptível. */}
      <div className="pf-hero__backdrop" data-pf-hero-layer="grid" aria-hidden="true">
        <div className="pf-grid-texture" />
      </div>

      {/* Camada 2 — véu superior, para o cabeçalho continuar legível. */}
      <div
        className="pf-hero__backdrop"
        data-pf-hero-layer="veil"
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
            <PFReveal animacao="fade" indice={0}>
              <span className="pf-eyebrow">{hero.identificacao}</span>
            </PFReveal>

            <PFReveal animacao="fade-up" indice={1}>
              <h1 id="pf-hero-nome" className="pf-display uppercase">
                {hero.nome}
              </h1>
            </PFReveal>

            <PFReveal animacao="line" indice={2} className="w-full max-w-[22rem]">
              <div className="pf-rule" />
            </PFReveal>

            <PFReveal animacao="fade-up" indice={3}>
              <p
                className="max-w-[28ch] text-[var(--pf-fg)]"
                style={{
                  fontFamily: "var(--pf-font-display)",
                  fontSize: "clamp(1.25rem, 3.2vw, 1.75rem)",
                  lineHeight: 1.25,
                }}
              >
                {hero.headline}
              </p>
            </PFReveal>

            {/* Destaque principal — Direito Médico. */}
            <PFReveal animacao="fade-up" indice={4}>
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
                  Especialista em
                </span>
                <span
                  className="text-[var(--pf-fg)]"
                  style={{
                    fontFamily: "var(--pf-font-display)",
                    fontSize: "clamp(1.75rem, 4.5vw, 2.5rem)",
                    lineHeight: 1,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {hero.destaque}
                </span>
              </div>
            </PFReveal>

            <PFReveal animacao="fade-up" indice={5}>
              <p className="pf-body max-w-[46ch]">{hero.descricao}</p>
            </PFReveal>

            <PFReveal animacao="fade-up" indice={6} className="w-full">
              <div className="flex w-full flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <PFButton variante="primary" ancora={ctaPrincipal.ancora}>
                  {ctaPrincipal.rotulo}
                </PFButton>
                <PFButton variante="outline" ancora={ctaSecundario.ancora}>
                  {ctaSecundario.rotulo}
                </PFButton>
              </div>
            </PFReveal>

            <PFReveal animacao="fade" indice={7} className="hidden md:block">
              <a
                href={`#${ctaSecundario.ancora}`}
                className="pf-btn pf-btn--ghost mt-4"
                aria-label="Rolar para as próximas seções"
              >
                <ArrowDown size={16} strokeWidth={1.4} aria-hidden="true" />
                {perfil.anosAtuacao} anos de atuação
              </a>
            </PFReveal>
          </div>
        </div>

        {/* ---------------------------------------------------------------
         * LADO FOTOGRÁFICO — camadas empilhadas
         * ------------------------------------------------------------- */}
        <div className="pf-hero__stage">
          <div className="pf-hero__halo" data-pf-hero-layer="halo" aria-hidden="true" />
          <div className="pf-hero__arc" data-pf-hero-layer="arc" aria-hidden="true" />

          <PFPhotoSlot
            src={fotoHero}
            alt={hero.fotoAlt}
            caminhoEsperado={CAMINHO_FOTO_HERO}
            descricao="Fotografia principal do advogado"
            imgClassName="pf-hero__photo"
            className={fotoHero ? undefined : "relative z-[1] max-h-full"}
            prioridade
          />

          <div className="pf-hero__floor" data-pf-hero-layer="floor" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
