import { useEffect, type RefObject } from "react";

/** Entradas que escondem o bloco atrás de uma máscara. */
const COM_MASCARA = new Set(["text-clip", "mask-up"]);

/**
 * Acende os blocos do site conforme eles entram na tela.
 *
 * COMO FUNCIONA, SEM TERMO TÉCNICO
 * Cada bloco do site nasce com uma plaquinha invisível dizendo "eu ainda não
 * apareci". Um vigia único fica de olho na tela inteira e, quando um bloco
 * entra no campo de visão, vira a plaquinha para "apareci" — e é o arquivo de
 * estilos que faz o movimento.
 *
 * Por que um vigia só, e não um por bloco: é a diferença entre um porteiro
 * olhando a portaria inteira e contratar um porteiro para cada porta. Mesmo
 * resultado, uma fração do esforço — e o celular não esquenta rolando a
 * página.
 *
 * O navegador avisa o vigia sozinho, no momento certo. Não existe código nosso
 * rodando a cada movimento do dedo na tela.
 *
 * O DETALHE DA MÁSCARA
 * Os blocos que entram por trás de uma máscara (títulos e fotografias) ficam
 * temporariamente com a área de desenho vazia. Para o navegador, um bloco
 * assim nunca "aparece" — é como pedir ao porteiro que avise quando um
 * convidado invisível entrar: ele nunca vai avisar.
 *
 * Por isso, nesses casos o vigia observa a moldura em volta do bloco, que
 * continua visível, e revela o conteúdo quando ela entra. O efeito na tela é
 * o mesmo, e nenhum título fica preso do lado de fora.
 *
 * Quem desligou animações no sistema recebe tudo já revelado, de uma vez: o
 * site nunca esconde conteúdo de quem não quer movimento.
 */
export function useRevealOnScroll(raiz: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const elemento = raiz.current;
    if (!elemento || typeof window === "undefined") return;

    // Os blocos do Hero entram pelo relógio da abertura, não pela rolagem —
    // ficam de fora do vigia.
    const blocos = Array.from(
      elemento.querySelectorAll<HTMLElement>('[data-pf-reveal]:not([data-pf-reveal="hero"])'),
    );

    const revelar = (bloco: HTMLElement) => {
      bloco.dataset.pfVisible = "true";
    };

    const querMenosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (querMenosMovimento || typeof IntersectionObserver === "undefined") {
      blocos.forEach(revelar);
      return;
    }

    // Quem o vigia observa → quais blocos aquilo revela.
    const vigiados = new Map<Element, HTMLElement[]>();

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          vigiados.get(entrada.target)?.forEach(revelar);
          // Uma vez revelado, sempre revelado: ninguém quer ver o texto
          // desaparecer ao rolar de volta.
          observador.unobserve(entrada.target);
          vigiados.delete(entrada.target);
        }
      },
      {
        // Dispara um pouco antes de o bloco encostar na borda de baixo, para
        // a entrada terminar quando ele já estiver confortavelmente visível.
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.08,
      },
    );

    for (const bloco of blocos) {
      // Um bloco já visível quando a página abre (acima da dobra) não espera:
      // aparece junto com o resto.
      const caixa = bloco.getBoundingClientRect();
      if (caixa.top < window.innerHeight * 0.9 && caixa.bottom > 0) {
        revelar(bloco);
        continue;
      }

      const comMascara = COM_MASCARA.has(bloco.dataset.pfReveal ?? "");
      const alvo = comMascara ? (bloco.parentElement ?? bloco) : bloco;

      const jaVigiado = vigiados.get(alvo);
      if (jaVigiado) {
        jaVigiado.push(bloco);
        continue;
      }

      vigiados.set(alvo, [bloco]);
      observador.observe(alvo);
    }

    return () => observador.disconnect();
  }, [raiz]);
}
