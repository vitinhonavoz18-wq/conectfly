import type { CSSProperties, ElementType, ReactNode } from "react";

interface PFRevealProps {
  children: ReactNode;
  /** Nome do movimento que a FASE 2 vai aplicar aqui. */
  animacao?: "fade-up" | "fade" | "line" | "portrait" | "stagger";
  /** Posição na sequência — usada para escalonar a entrada dos elementos. */
  indice?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

/**
 * Marcador de "elemento que vai ser animado".
 *
 * NESTA FASE ELE NÃO ANIMA NADA. Ele apenas envolve o conteúdo e deixa
 * gravado no HTML qual movimento aquele bloco deve receber e em que ordem.
 *
 * É como numerar as caixas antes da mudança: nada se move ainda, mas quando o
 * caminhão chegar (FASE 2) já se sabe o que entra primeiro e o que entra
 * depois. Sem isso, a fase de animação teria de mexer em todas as seções de
 * novo, uma por uma, com risco de quebrar o que já está pronto.
 */
export function PFReveal({
  children,
  animacao = "fade-up",
  indice = 0,
  as: Tag = "div",
  className,
  style,
}: PFRevealProps) {
  const Componente = Tag as ElementType;

  return (
    <Componente
      className={className}
      data-pf-reveal={animacao}
      data-pf-reveal-index={indice}
      style={{ ["--pf-reveal-index" as string]: indice, ...style }}
    >
      {children}
    </Componente>
  );
}
