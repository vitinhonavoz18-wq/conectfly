import { useEffect, useState } from "react";

/**
 * Diz qual seção do site está sendo lida neste momento.
 *
 * Serve para acender o item correspondente no menu — o mesmo princípio da
 * placa de rua que muda conforme o quarteirão: a pessoa sempre sabe onde
 * está.
 *
 * Assim como as revelações, usa o aviso do navegador em vez de ficar medindo
 * a rolagem a cada instante. A faixa de leitura considerada é o miolo da tela
 * (dos 25% aos 65% da altura), para o menu não ficar piscando entre duas
 * seções quando as duas aparecem juntas.
 */
export function useActiveSection(ancoras: string[]): string | null {
  const [ativa, setAtiva] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;

    const secoes = ancoras
      .map((ancora) => document.getElementById(ancora))
      .filter((elemento): elemento is HTMLElement => elemento !== null);

    if (secoes.length === 0) return;

    const visiveis = new Set<string>();

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) visiveis.add(entrada.target.id);
          else visiveis.delete(entrada.target.id);
        }
        // Entre as seções visíveis, vale a que aparece primeiro na página.
        const primeira = ancoras.find((ancora) => visiveis.has(ancora));
        setAtiva(primeira ?? null);
      },
      { rootMargin: "-25% 0px -35% 0px", threshold: 0 },
    );

    for (const secao of secoes) observador.observe(secao);
    return () => observador.disconnect();
  }, [ancoras]);

  return ativa;
}
