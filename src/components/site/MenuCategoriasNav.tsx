import { useEffect, useRef, useState } from "react";
import { ancoraDaCategoria } from "@/lib/site/ancoraDaCategoria";

export type CategoriaDaNav = { id: string; rotulo: string };

/**
 * A BARRA DE CATEGORIAS que acompanha a rolagem.
 *
 * No modo "rolagem única" o cardápio inteiro fica numa página só. Sem esta
 * barra, quem queria trufas precisava rolar por kits, bolos e copos até
 * achar. Agora as categorias ficam numa faixa presa no topo: um toque leva
 * direto à seção, e a categoria que está na tela fica marcada. É o índice com
 * abas coloridas do cardápio de papel.
 *
 * A barra só navega — não esconde nem filtra produto nenhum. Tirá-la deixa o
 * cardápio exatamente como era.
 *
 * Ela fica logo abaixo da tarja de "loja fechada" quando a tarja aparece
 * (a altura dela chega por `--site-topo-fixo`), para uma não cobrir a outra.
 */
export function MenuCategoriasNav({ categorias }: { categorias: CategoriaDaNav[] }) {
  const [ativa, setAtiva] = useState<string | null>(categorias[0]?.id ?? null);
  const trilhoRef = useRef<HTMLDivElement>(null);

  // Marca a categoria que ocupa o meio da tela enquanto o cliente rola.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const alvos = categorias
      .map((c) => document.getElementById(ancoraDaCategoria(c.id)))
      .filter((el): el is HTMLElement => !!el);
    if (alvos.length === 0) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.find((e) => e.isIntersecting);
        if (visivel) setAtiva(visivel.target.id.replace(/^categoria-/, ""));
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    alvos.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [categorias]);

  // Mantém a aba marcada à vista dentro da faixa, sem mexer na rolagem da página.
  useEffect(() => {
    const trilho = trilhoRef.current;
    const aba = ativa ? trilho?.querySelector<HTMLElement>(`[data-categoria="${ativa}"]`) : null;
    if (!trilho || !aba) return;
    const esquerda = aba.offsetLeft - trilho.clientWidth / 2 + aba.clientWidth / 2;
    trilho.scrollTo({ left: Math.max(0, esquerda) });
  }, [ativa]);

  if (categorias.length < 2) return null;

  const irPara = (id: string) => {
    const el = document.getElementById(ancoraDaCategoria(id));
    if (!el) return;
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
    setAtiva(id);
  };

  return (
    <nav
      aria-label="Categorias do cardápio"
      data-no-zoom
      className="sticky z-30 -mx-4 mb-6 border-b border-[hsl(var(--site-border))] bg-[hsl(var(--site-bg)/0.92)] backdrop-blur-md sm:mb-8"
      style={{ top: "var(--site-topo-fixo, 0px)" }}
    >
      <div
        ref={trilhoRef}
        // As pontas esmaecem para mostrar que a faixa continua de lado —
        // sem isso, a última categoria cortada parece um erro de tela.
        className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2.5 [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-28px),transparent)]"
      >
        {categorias.map((c) => {
          const marcada = ativa === c.id;
          return (
            <a
              key={c.id}
              href={`#${ancoraDaCategoria(c.id)}`}
              data-categoria={c.id}
              aria-current={marcada ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                irPara(c.id);
              }}
              className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--site-primary))] ${
                marcada
                  ? "bg-[hsl(var(--site-primary))] text-[hsl(var(--site-primary-fg))] shadow-sm"
                  : "bg-[hsl(var(--site-card))] text-[hsl(var(--site-fg))] ring-1 ring-inset ring-[hsl(var(--site-border))] hover:ring-[hsl(var(--site-primary)/0.5)]"
              }`}
            >
              {c.rotulo}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
