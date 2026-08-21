import { cn } from "@/lib/utils";

interface PFPlaceholderProps {
  /** O que falta preencher. Ex.: "telefone", "número da OAB". */
  campo: string;
  /** Ocupa a largura toda, centralizado — para dentro de cartões e molduras. */
  bloco?: boolean;
  className?: string;
}

/**
 * Etiqueta de dado pendente.
 *
 * Enquanto o advogado não enviar um telefone, e-mail, endereço ou o número da
 * OAB, o site mostra esta marca dourada tracejada no lugar da informação. É o
 * equivalente a deixar a linha em branco no formulário com um post-it colado:
 * o site funciona, mas ninguém confunde o espaço vazio com informação real e
 * ninguém esquece de preencher antes de publicar.
 */
export function PFPlaceholder({ campo, bloco = false, className }: PFPlaceholderProps) {
  return (
    <span
      className={cn("pf-placeholder", bloco && "pf-placeholder--block", className)}
      data-pf-placeholder={campo}
      title={`Informação pendente: ${campo}`}
    >
      <span aria-hidden="true">◇</span>A preencher: {campo}
    </span>
  );
}
