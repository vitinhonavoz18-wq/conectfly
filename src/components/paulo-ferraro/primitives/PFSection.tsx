import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Superficie = "dark" | "graphite" | "light";

interface PFSectionProps {
  children: ReactNode;
  /** Id usado pelo menu para rolar até aqui. */
  id?: string;
  /** Cor de fundo da seção. Tudo dentro dela se ajusta sozinho. */
  superficie?: Superficie;
  /** Espaçamento vertical reduzido — usado em faixas estreitas. */
  compacta?: boolean;
  className?: string;
  /** Rótulo lido por leitores de tela quando a seção não tem título visível. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * Moldura padrão de todas as seções: largura máxima, respiro vertical e cor
 * de fundo.
 *
 * O detalhe importante é `superficie`. Marcar uma seção como clara não troca
 * a cor de cada texto e cada borda um por um — é como acender a luz de um
 * cômodo: tudo que está lá dentro passa a enxergar a claridade nova e se
 * ajusta junto. Isso evita o problema clássico de "botão branco em fundo
 * branco" quando uma seção muda de cor.
 */
export function PFSection({
  children,
  id,
  superficie = "dark",
  compacta = false,
  className,
  ...rest
}: PFSectionProps) {
  return (
    <section
      id={id}
      data-pf-surface={superficie}
      data-pf-scroll-anchor={id ? "" : undefined}
      className={cn("pf-section", compacta && "pf-section--tight", className)}
      {...rest}
    >
      {children}
    </section>
  );
}
