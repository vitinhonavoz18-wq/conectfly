"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { ProductFigure } from "@/components/home/hero/product-figure";
import { siteConfig } from "@/config/site";

/**
 * Hero editorial da ABITAH.
 *
 * Camadas (do fundo para a frente):
 *   1. fundo escuro + brilhos ambiente + grão
 *   2. tipografia gigante ABITAH (elemento gráfico)
 *   8. "TREINE" — passa ATRÁS do produto
 *  12. produto flutuante (PNG/WEBP transparente)
 *  15. "FORTE." — passa NA FRENTE do produto
 *  16. assinatura manuscrita
 *  25. conteúdo de apoio: selo, título, CTA e card da coleção
 *
 * Cada camada separa POSIÇÃO (utilitários do Tailwind) de MOVIMENTO (parallax
 * e animações em wrappers internos): misturar os dois no mesmo elemento faz um
 * transform sobrescrever o outro.
 *
 * No celular a composição é outra — a tipografia editorial fica abaixo do
 * produto, em fluxo, para não cobrir a peça nem o CTA.
 */
export function Hero() {
  const shellRef = useRef<HTMLDivElement>(null);

  // Parallax por mouse: escreve variáveis CSS, sem re-renderizar o React.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const fine = window.matchMedia("(pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || calm.matches) return;

    let frame = 0;
    const onMove = (event: MouseEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = shell.getBoundingClientRect();
        shell.style.setProperty("--mx", ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3));
        shell.style.setProperty("--my", ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3));
      });
    };
    const onLeave = () => {
      shell.style.setProperty("--mx", "0");
      shell.style.setProperty("--my", "0");
    };

    shell.addEventListener("mousemove", onMove);
    shell.addEventListener("mouseleave", onLeave);
    return () => {
      shell.removeEventListener("mousemove", onMove);
      shell.removeEventListener("mouseleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const { hero } = siteConfig;

  return (
    <section className="px-3 pb-6 pt-3 sm:px-4 lg:px-6 lg:pb-10">
      <div
        ref={shellRef}
        className="hero-shell hero-vignette relative mx-auto flex h-[88svh] min-h-[640px] w-full max-w-[1540px] flex-col overflow-hidden rounded-[28px] border border-white/5 md:h-[800px] md:rounded-[36px] lg:h-[84vh] lg:min-h-[780px] lg:max-h-[920px] lg:rounded-[48px]"
      >
        {/* ---------------- ambiente ---------------- */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute -left-[10%] top-[38%] h-[30%] w-[32%] rounded-full bg-neon-600/8 blur-[160px]" />
          <div className="absolute -bottom-[8%] right-[6%] h-[26%] w-[28%] rounded-full bg-neon-500/6 blur-[170px]" />
          <div className="noise-overlay absolute inset-0" />
        </div>

        {/* ---------------- tipografia gigante (todas as telas) ---------------- */}
        <div
          aria-hidden
          className="absolute left-1/2 top-[15%] z-[2] w-[98%] -translate-x-1/2 lg:top-[20%]"
        >
          <div className="parallax-layer [transform:translate3d(calc(var(--mx,0)*-4px),calc(var(--my,0)*-4px),0)]">
            <p className="poster-type animate-[poster-in_1.1s_cubic-bezier(0.22,1,0.36,1)_both] whitespace-nowrap text-center text-[26vw] opacity-[0.82] lg:text-[clamp(160px,19vw,320px)]">
              ABITAH
            </p>
          </div>
        </div>

        {/* ================= COMPOSIÇÃO DESKTOP ================= */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
          <div className="absolute left-[5%] top-[28%] z-[8] lg:left-[5.5%] lg:top-[41%]">
            <div className="parallax-layer [transform:translate3d(calc(var(--mx,0)*7px),calc(var(--my,0)*7px),0)]">
              <span className="script-type block [--tilt:-3deg] animate-[slide-in-left_0.9s_cubic-bezier(0.22,1,0.36,1)_0.35s_both] text-[7vw] leading-none text-neon-500 lg:text-[clamp(50px,5.4vw,96px)]">
                TREINE
              </span>
            </div>
          </div>

          <div className="absolute right-[5%] top-[60%] z-[15] lg:top-[44%]">
            <div className="parallax-layer [transform:translate3d(calc(var(--mx,0)*7px),calc(var(--my,0)*7px),0)]">
              <span className="script-type block [--tilt:2deg] animate-[slide-in-right_0.9s_cubic-bezier(0.22,1,0.36,1)_0.45s_both] text-[7vw] leading-none text-neon-500 lg:text-[clamp(50px,5.4vw,96px)]">
                FORTE.
              </span>
            </div>
          </div>

          <div className="absolute left-[6%] top-[60%] z-[16] hidden lg:block">
            <div className="parallax-layer [transform:translate3d(calc(var(--mx,0)*5px),calc(var(--my,0)*5px),0)]">
              <span className="script-type block [--tilt:-1deg] animate-[slide-in-left_0.9s_cubic-bezier(0.22,1,0.36,1)_0.55s_both] text-[3.4vw] leading-none text-smoke-100 lg:text-[clamp(22px,2vw,34px)]">
                Vista sua identidade.
              </span>
            </div>
          </div>
        </div>

        {/* produto — posicionado no palco (desktop) e no fluxo (mobile) */}
        <div
          aria-hidden
          className="absolute left-1/2 top-[44%] z-[12] hidden w-[56%] max-w-[670px] -translate-x-1/2 -translate-y-1/2 md:block lg:left-[53%] lg:top-[52%] lg:w-[42%]"
        >
          <div className="parallax-layer [transform:translate3d(calc(var(--mx,0)*10px),calc(var(--my,0)*10px),0)]">
            <div className="animate-[product-reveal_1.1s_cubic-bezier(0.22,1,0.36,1)_0.15s_both]">
              <div className="animate-product-float">
                <ProductFigure
                  src={hero.productImage}
                  alt={`Peça em destaque da ${siteConfig.name} — ${hero.collection.name}`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ================= CONTEÚDO ================= */}
        <div className="relative z-25 flex h-full flex-col p-6 sm:p-8 lg:justify-between lg:p-14">
          <div className="animate-[fade-up_0.7s_cubic-bezier(0.22,1,0.36,1)_0.25s_both]">
            <p className="inline-flex items-center gap-2 rounded-full border border-neon-500/45 bg-neon-500/6 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-neon-500">
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {hero.eyebrow}
            </p>
          </div>

          {/* palco do celular: produto + tipografia editorial em fluxo */}
          <div className="flex flex-1 flex-col justify-center md:hidden">
            <div className="relative mx-auto w-[74%] max-w-[320px]">
              <div className="animate-[product-reveal_1.1s_cubic-bezier(0.22,1,0.36,1)_0.15s_both]">
                <div className="animate-product-float">
                  <ProductFigure
                    src={hero.productImage}
                    alt={`Peça em destaque da ${siteConfig.name} — ${hero.collection.name}`}
                  />
                </div>
              </div>
            </div>

            <div className="-mt-2 flex flex-col">
              <span className="script-type block [--tilt:-3deg] animate-[slide-in-left_0.9s_cubic-bezier(0.22,1,0.36,1)_0.35s_both] self-start text-[13vw] leading-[0.95] text-neon-500">
                TREINE
              </span>
              <span className="script-type block [--tilt:2deg] animate-[slide-in-right_0.9s_cubic-bezier(0.22,1,0.36,1)_0.45s_both] self-end text-[13vw] leading-[0.95] text-neon-500">
                FORTE.
              </span>
            </div>
          </div>

          {/* base: assinatura (mobile), título, descrição e ações */}
          <div className="mt-auto flex items-end justify-between gap-8 pb-2 lg:pb-0">
            <div className="w-full max-w-[19rem] animate-[fade-up_0.7s_cubic-bezier(0.22,1,0.36,1)_0.55s_both] lg:max-w-[18rem]">
              <span className="script-type mb-4 block [--tilt:-1deg] text-[6vw] leading-none text-smoke-100 sm:text-[30px] lg:hidden">
                Vista sua identidade.
              </span>

              <h1 className="font-display text-[1.45rem] font-bold uppercase leading-[1.05] tracking-wide text-smoke-100 sm:text-[1.6rem]">
                {hero.title}
              </h1>
              <p className="mt-3 text-[13px] leading-relaxed text-white/50">{hero.description}</p>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  href="/loja"
                  className="group inline-flex h-12 items-center gap-3 rounded-[9px] bg-neon-500 px-6 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#031006] shadow-[0_10px_32px_rgba(32,232,63,0.20)] transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-neon-400 hover:shadow-[0_15px_38px_rgba(32,232,63,0.28)]"
                >
                  Conhecer coleção
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>

                <Link
                  href="/lancamentos"
                  className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55 underline-offset-[6px] transition-colors hover:text-white hover:underline"
                >
                  Ver lançamentos
                </Link>
              </div>
            </div>

            {/* card da coleção — apenas no desktop, para não competir com o produto */}
            <aside className="hidden w-[195px] animate-[fade-up_0.7s_cubic-bezier(0.22,1,0.36,1)_0.65s_both] rounded-[18px] border border-neon-500/18 bg-[rgba(14,20,16,0.74)] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.42)] backdrop-blur-[20px] lg:block">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-neon-500">
                {hero.collection.eyebrow}
              </p>
              <p className="mt-2 font-display text-[1.45rem] font-semibold uppercase leading-[1.05] text-smoke-100">
                {hero.collection.name}
              </p>
              <p className="mt-3 text-[11px] leading-[1.45] text-white/42">
                {hero.collection.description}
              </p>
              <Link
                href={hero.collection.href}
                className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-smoke-200 transition-colors hover:text-neon-400"
              >
                Ver coleção
                <ArrowUpRight className="h-4 w-4 text-neon-500" aria-hidden />
              </Link>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
