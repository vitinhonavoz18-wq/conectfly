import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PFReveal } from "./PFReveal";

interface PFSectionHeadingProps {
  /** Rótulo pequeno acima do título. Ex.: "Áreas de atuação". */
  eyebrow?: string;
  titulo: ReactNode;
  /** Frase de apoio, logo abaixo do título. */
  chamada?: ReactNode;
  /** Nível do título no documento — importante para leitores de tela e SEO. */
  nivel?: 2 | 3;
  alinhamento?: "left" | "center";
  /** Id do título, para a seção se referir a ele via aria-labelledby. */
  id?: string;
  className?: string;
}

/**
 * Cabeçalho de seção — o mesmo ritmo visual em todas as partes do site:
 * rótulo pequeno em bordô, título em serifada e frase de apoio.
 */
export function PFSectionHeading({
  eyebrow,
  titulo,
  chamada,
  nivel = 2,
  alinhamento = "left",
  id,
  className,
}: PFSectionHeadingProps) {
  const Titulo = nivel === 2 ? "h2" : "h3";

  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        alinhamento === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? (
        <PFReveal animacao="fade" indice={0}>
          <span className={cn("pf-eyebrow", alinhamento === "center" && "pf-eyebrow--plain")}>
            {eyebrow}
          </span>
        </PFReveal>
      ) : null}

      <PFReveal animacao="fade-up" indice={1}>
        <Titulo
          id={id}
          className={cn(nivel === 2 ? "pf-h2" : "pf-h3", "max-w-[22ch]", {
            "max-w-[26ch] mx-auto": alinhamento === "center",
          })}
        >
          {titulo}
        </Titulo>
      </PFReveal>

      {chamada ? (
        <PFReveal animacao="fade-up" indice={2}>
          <p className={cn("pf-lead max-w-[52ch]", alinhamento === "center" && "mx-auto")}>
            {chamada}
          </p>
        </PFReveal>
      ) : null}
    </div>
  );
}
