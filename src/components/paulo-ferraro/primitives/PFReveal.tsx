import type { CSSProperties, ElementType, ReactNode } from "react";

/**
 * Tipos de entrada disponíveis.
 *
 * - `fade`      — só surge, sem deslocamento. Para rótulos e detalhes.
 * - `fade-up`   — sobe alguns pixels enquanto surge. O padrão dos textos.
 * - `fade-right`— entra pela esquerda. Para listas laterais.
 * - `line`      — o fio se estende da esquerda para a direita.
 * - `mask-up`   — uma máscara sobe descobrindo a imagem. Para fotografias.
 * - `text-clip` — o título emerge de baixo, como letra saindo do papel.
 * - `zoom`      — aproximação mínima. Para blocos de destaque.
 * - `hero`      — entra pelo relógio da abertura do site, não pela rolagem.
 */
type Animacao =
  "fade" | "fade-up" | "fade-right" | "line" | "mask-up" | "text-clip" | "zoom" | "hero";

interface PFRevealProps {
  children: ReactNode;
  animacao?: Animacao;
  /** Posição na sequência — escalona a entrada dos elementos vizinhos. */
  indice?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

/**
 * Envolve um bloco que deve entrar em cena.
 *
 * O componente não anima nada por conta própria: ele apenas pendura no bloco
 * uma plaquinha dizendo qual movimento receber e em que ordem. Quem faz o
 * movimento é o arquivo de estilos, e quem vira a plaquinha é o vigia da
 * rolagem (`useRevealOnScroll`).
 *
 * A vantagem prática: o movimento roda direto na placa de vídeo, sem passar
 * pelo JavaScript quadro a quadro. É por isso que a página desliza lisa mesmo
 * em celular simples.
 *
 * `data-pf-visible="false"` sai já no HTML enviado pelo servidor, para o bloco
 * não piscar visível antes de entrar. E o site inclui uma regra de segurança
 * que mostra tudo caso o JavaScript não rode.
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
  const entraPelaRolagem = animacao !== "hero";

  return (
    <Componente
      className={className}
      data-pf-reveal={animacao}
      data-pf-visible={entraPelaRolagem ? "false" : undefined}
      style={{ ["--pf-reveal-index" as string]: indice, ...style }}
    >
      {children}
    </Componente>
  );
}
