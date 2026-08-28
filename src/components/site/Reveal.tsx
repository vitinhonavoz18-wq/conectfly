import type { ElementType, ReactNode } from "react";

/**
 * Um embrulho que hoje não anima nada.
 *
 * POR QUE ELE AINDA EXISTE
 *
 * Ele nasceu para fazer o conteúdo surgir conforme a página rolava. Isso foi
 * desligado porque atrapalhava a rolagem, principalmente no celular. As
 * páginas que ainda o usam continuam funcionando exatamente igual — ele só
 * desenha a tag pedida com a classe pedida.
 *
 * O QUE FOI TIRADO DAQUI, E POR QUE IMPORTA
 *
 * Mesmo sem animar, o componente ainda marcava cada elemento embrulhado com
 * um aviso ao navegador do tipo "prepare-se, isto vai se mexer"
 * (`will-change`). O navegador leva esse aviso a sério: reserva um espaço
 * separado na memória de vídeo para cada elemento assim. É como pedir para o
 * garçom deixar uma mesa reservada para cada cliente que talvez apareça — em
 * uma página com dezenas de blocos, o salão inteiro fica bloqueado à toa.
 *
 * Junto saíram três sistemas de animação por rolagem que ninguém chamava:
 * uma barra de progresso no topo, um efeito de parallax e um medidor de
 * posição de seção. Os três instalavam vigias no evento de rolagem — e um
 * vigia que ninguém consultou continua custando a cada dedada na tela.
 */

interface RevealProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** Mantidas para não quebrar quem já passa estas props; sem efeito. */
  variant?: string;
  delay?: number;
  duration?: number;
  once?: boolean;
  threshold?: number;
}

export function Reveal({ children, className = "", as: Tag = "div" }: RevealProps) {
  const Component = Tag as ElementType;
  return <Component className={className}>{children}</Component>;
}
