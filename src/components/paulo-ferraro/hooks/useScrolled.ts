import { useEffect, useState } from "react";

/**
 * Informa se a página já saiu do topo.
 *
 * É o que faz o cabeçalho trocar de roupa: no topo ele é transparente e
 * integrado à foto; depois de rolar, encolhe e ganha o fundo de vidro fosco
 * para o texto continuar legível sobre qualquer seção.
 *
 * A leitura é feita em `requestAnimationFrame` — em vez de recalcular a cada
 * pixel rolado, o navegador avisa uma vez por quadro. É a diferença entre
 * conferir o estoque a cada item vendido e conferir uma vez por rodada: o
 * resultado é o mesmo e o celular não esquenta.
 */
export function useScrolled(limite = 24): boolean {
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let quadro = 0;

    const medir = () => {
      setRolou(window.scrollY > limite);
      quadro = 0;
    };

    const aoRolar = () => {
      if (quadro) return;
      quadro = window.requestAnimationFrame(medir);
    };

    medir();
    window.addEventListener("scroll", aoRolar, { passive: true });

    return () => {
      window.removeEventListener("scroll", aoRolar);
      if (quadro) window.cancelAnimationFrame(quadro);
    };
  }, [limite]);

  return rolou;
}
