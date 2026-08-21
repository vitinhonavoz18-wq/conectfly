import { cn } from "@/lib/utils";
import { perfil } from "../content";

interface PFBrandProps {
  /** Versão reduzida — usada no cabeçalho compacto. */
  compacta?: boolean;
  className?: string;
}

/**
 * Assinatura do escritório: o nome em serifada, com um fio bordô à esquerda e
 * a palavra "Advogado" em letra pequena e espaçada.
 *
 * Faz o papel de logotipo enquanto não existir uma marca desenhada. Quando o
 * logotipo chegar, só este componente muda — o cabeçalho e o rodapé continuam
 * iguais.
 */
export function PFBrand({ compacta = false, className }: PFBrandProps) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden="true"
        className="h-8 w-px shrink-0 bg-[var(--pf-accent)] transition-all duration-500"
        style={{ height: compacta ? "1.5rem" : "2rem" }}
      />
      <span className="flex flex-col leading-none">
        <span
          className="pf-numeral text-[var(--pf-fg)]"
          style={{
            fontFamily: "var(--pf-font-display)",
            fontSize: compacta ? "1.125rem" : "1.35rem",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
            transition: "font-size var(--pf-dur) var(--pf-ease-out)",
          }}
        >
          {perfil.nome}
        </span>
        <span
          className="text-[var(--pf-fg-subtle)]"
          style={{
            fontSize: "0.5625rem",
            fontWeight: 600,
            letterSpacing: "var(--pf-tracking-eyebrow)",
            textTransform: "uppercase",
            marginTop: "0.25rem",
          }}
        >
          {perfil.titulo}
        </span>
      </span>
    </span>
  );
}
