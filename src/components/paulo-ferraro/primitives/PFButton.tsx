import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { scrollToAnchor } from "../navigation";

type Variante = "primary" | "outline" | "ghost";
type Tamanho = "md" | "sm";

interface PFButtonProps {
  children: ReactNode;
  variante?: Variante;
  tamanho?: Tamanho;
  /** Rola suavemente até a seção com este id (ex.: "contato"). */
  ancora?: string;
  /** Link externo — WhatsApp, tel:, mailto:, Instagram. */
  href?: string;
  /** Quando verdadeiro, o botão aparece mas não é clicável (dado ainda pendente). */
  desabilitado?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  "aria-label"?: string;
}

/**
 * Botão único do site. Vira link quando recebe `href` ou `ancora`, e vira
 * botão comum quando recebe apenas `onClick` — assim o HTML fica correto para
 * leitores de tela e para o teclado, sem precisar de dois componentes.
 */
export function PFButton({
  children,
  variante = "primary",
  tamanho = "md",
  ancora,
  href,
  desabilitado = false,
  className,
  style,
  onClick,
  ...rest
}: PFButtonProps) {
  const classes = cn(
    "pf-btn",
    variante === "primary" && "pf-btn--primary",
    variante === "outline" && "pf-btn--outline",
    variante === "ghost" && "pf-btn--ghost",
    tamanho === "sm" && "pf-btn--sm",
    className,
  );

  if (desabilitado) {
    return (
      <span
        className={classes}
        style={style}
        data-pf-disabled="true"
        aria-disabled="true"
        {...rest}
      >
        {children}
      </span>
    );
  }

  if (ancora) {
    return (
      <a
        href={`#${ancora}`}
        className={classes}
        style={style}
        onClick={(evento) => {
          evento.preventDefault();
          onClick?.();
          // A rolagem espera o próximo quadro: se o botão estiver dentro do
          // menu do celular, ele precisa fechar antes — com o menu aberto a
          // página fica travada e a rolagem não sairia do lugar.
          window.requestAnimationFrame(() => scrollToAnchor(ancora));
        }}
        {...rest}
      >
        {children}
      </a>
    );
  }

  if (href) {
    const externo = href.startsWith("http");
    return (
      <a
        href={href}
        className={classes}
        style={style}
        target={externo ? "_blank" : undefined}
        rel={externo ? "noopener noreferrer" : undefined}
        onClick={onClick}
        {...rest}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} style={style} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
